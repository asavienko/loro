// The content the app has installed, kept on the device (plan 106): the server's languages, every
// course pack it downloaded and the sets it opened from a link or Community. `restoreContent`
// installs them before the learner's state loads, so the app opens offline with its progress intact;
// `refreshCourse` asks the API for the languages and a course's current pack and installs them.
import {
  applySet,
  ContentPack,
  ExtraSets,
  installedCourses,
  installedExtras,
  installedLanguages,
  installedPack,
  installExtras,
  installLanguages,
  installPacks,
  keepOnlyLoros,
  LANGUAGE_CODES,
  LanguageCode,
  LanguageList,
  removeSet,
} from '../content';
import { fetchLanguages, fetchPack, type SetDetail } from './library';
import { kvGet, kvRemove, kvSet } from './kv';

const packKey = (lang: LanguageCode) => `loro.content.pack.${lang}`;
const EXTRAS_KEY = 'loro.content.extras';
const LANGUAGES_KEY = 'loro.content.languages';
/** Whether the installed languages are also saved on the device. */
let languagesSaved = false;
/** The courses whose installed pack is also saved on the device. */
const saved = new Set<LanguageCode>();

const isLanguageList = (value: unknown): value is LanguageList =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as LanguageList).version === 'string' &&
  Array.isArray((value as LanguageList).languages) &&
  (value as LanguageList).languages.every((l) => typeof l === 'object' && l !== null && typeof l.code === 'string' && typeof l.flag === 'string' && typeof l.canTarget === 'boolean');

const isPack = (value: unknown): value is ContentPack =>
  typeof value === 'object' && value !== null && Array.isArray((value as ContentPack).sets) && Array.isArray((value as ContentPack).phrases) && typeof (value as ContentPack).targetLang === 'string';

/** Installs every pack and extra set saved on this device; resolves to the courses it had. */
export async function restoreContent(): Promise<LanguageCode[]> {
  try {
    const raw = await kvGet(LANGUAGES_KEY);
    const list: unknown = raw ? JSON.parse(raw) : null;
    if (isLanguageList(list)) {
      installLanguages(list);
      languagesSaved = true;
    }
  } catch {
    // Downloaded again with the course.
  }
  const packs: ContentPack[] = [];
  // Every language the app handles: a pack saved before the device had the server's list still opens.
  for (const lang of LANGUAGE_CODES) {
    try {
      const raw = await kvGet(packKey(lang));
      const pack: unknown = raw ? JSON.parse(raw) : null;
      if (isPack(pack)) packs.push(pack);
    } catch {
      // An unreadable copy is downloaded again.
    }
  }
  if (packs.length > 0) installPacks(packs);
  for (const pack of packs) saved.add(pack.targetLang);
  try {
    const raw = await kvGet(EXTRAS_KEY);
    const extras = raw ? (JSON.parse(raw) as ExtraSets) : null;
    if (extras && Array.isArray(extras.sets) && Array.isArray(extras.phrases)) installExtras(extras);
  } catch {
    // Opened sets are fetched again when opened.
  }
  return installedCourses();
}

const downloading = new Map<LanguageCode, Promise<boolean>>();

/**
 * Downloads a course's pack and installs it; resolves to whether anything changed. A download of
 * the same course already on its way is shared ("Try again" tapped twice starts one), unless `fresh`
 * asks for a new one (the session changed, so the pack it brings would be another learner's).
 */
export function refreshCourse(lang: LanguageCode, fresh = false): Promise<boolean> {
  const running = downloading.get(lang);
  if (running && !fresh) return running;
  const next = download(lang).finally(() => {
    if (downloading.get(lang) === next) downloading.delete(lang);
  });
  downloading.set(lang, next);
  return next;
}

/**
 * Downloads the server's languages and installs them when they changed. A device that already has
 * a copy keeps it when the server can't be reached; one without fails, as it can't go on.
 */
async function refreshLanguages(): Promise<void> {
  let list: LanguageList;
  try {
    list = await fetchLanguages();
  } catch (error) {
    if (installedLanguages()) return;
    throw error;
  }
  if (!isLanguageList(list)) {
    if (installedLanguages()) return;
    throw new Error('Unreadable languages');
  }
  const same = installedLanguages()?.version === list.version;
  if (!same) installLanguages(list);
  if (!same || !languagesSaved) {
    await kvSet(LANGUAGES_KEY, JSON.stringify(list));
    languagesSaved = true;
  }
}

async function download(lang: LanguageCode): Promise<boolean> {
  const [pack] = await Promise.all([fetchPack(lang), refreshLanguages()]);
  const same = installedPack(lang)?.version === pack.version;
  if (!same) installPacks([pack]);
  // Saved again after signing out forgot it, even when nothing in it changed.
  if (!same || !saved.has(lang)) {
    await kvSet(packKey(lang), JSON.stringify(pack));
    saved.add(lang);
  }
  return !same;
}

/** A change to one of the learner's sets, shown at once and kept with the course's saved pack. */
export async function keepSetChange(detail: SetDetail): Promise<void> {
  const pack = applySet(detail);
  if (pack) await kvSet(packKey(pack.targetLang), JSON.stringify(pack));
}

/** A deleted set of the learner's, gone at once and from the saved pack. */
export async function forgetSet(id: string): Promise<void> {
  const pack = removeSet(id);
  if (pack) await kvSet(packKey(pack.targetLang), JSON.stringify(pack));
}

/**
 * Keeps a set opened from outside the packs, so its phrases stay playable. It is open at once; a
 * device that can't save it (storage full or refused) only fetches it again next time, so that
 * failure never stops the set from opening.
 */
export async function keepOpenedSet(detail: SetDetail): Promise<void> {
  installExtras({ sets: [detail.set], phrases: detail.phrases });
  await kvSet(EXTRAS_KEY, JSON.stringify(installedExtras())).catch(() => {});
}

/**
 * After signing out: the packs keep only Loro's sets and albums, on the device as in memory, and the
 * sets opened from links are forgotten (they held the learner's own and saved sets). The courses stay
 * playable offline; progress on the forgotten phrases stays with the learner's log.
 */
export async function forgetAccountContent(): Promise<void> {
  const packs = keepOnlyLoros();
  await Promise.all([...packs.map((pack) => kvSet(packKey(pack.targetLang), JSON.stringify(pack))), kvRemove(EXTRAS_KEY)]);
}
