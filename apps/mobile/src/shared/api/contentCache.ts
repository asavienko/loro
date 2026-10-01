// The content the app has installed, kept on the device (plan 106): every course pack it downloaded
// and the sets it opened from a link or Community. `restoreContent` installs them before the
// learner's state loads, so the app opens offline with its progress intact; `refreshCourse` asks the
// API for a course's current pack and installs it.
import { applySet, ContentPack, ExtraSets, installedCourses, installedExtras, installedPack, installExtras, installPacks, keepOnlyLoros, LanguageCode, removeSet, TARGET_LANGUAGES } from '../content';
import { fetchPack, type SetDetail } from './library';
import { kvGet, kvRemove, kvSet } from './kv';

const packKey = (lang: LanguageCode) => `loro.content.pack.${lang}`;
const EXTRAS_KEY = 'loro.content.extras';
/** The courses whose installed pack is also saved on the device. */
const saved = new Set<LanguageCode>();

const isPack = (value: unknown): value is ContentPack =>
  typeof value === 'object' && value !== null && Array.isArray((value as ContentPack).sets) && Array.isArray((value as ContentPack).phrases) && typeof (value as ContentPack).targetLang === 'string';

/** Installs every pack and extra set saved on this device; resolves to the courses it had. */
export async function restoreContent(): Promise<LanguageCode[]> {
  const packs: ContentPack[] = [];
  for (const lang of TARGET_LANGUAGES) {
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

async function download(lang: LanguageCode): Promise<boolean> {
  const pack = await fetchPack(lang);
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

/** Keeps a set opened from outside the packs, so its phrases stay playable. */
export async function keepOpenedSet(detail: SetDetail): Promise<void> {
  installExtras({ sets: [detail.set], phrases: detail.phrases });
  await kvSet(EXTRAS_KEY, JSON.stringify(installedExtras()));
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
