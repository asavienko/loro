// Content comes from the API (plan 106): a course's pack is Loro's sets and phrases, the learner's own
// and saved sets, the phrase bank and the albums (GET /library/pack). The app keeps the packs it has
// installed on the device (src/shared/api/contentCache.ts) and installs them before the learner's
// state loads, so it opens offline. Nothing here is learner progress: every learner number is derived
// from the state machine in src/state/. Phrases the learner writes on the device live in learner
// state and join this content in src/state/catalog.ts.
//
// The arrays below are filled in place when a pack is installed, so a module that imported them
// sees the new content; `contentRevision` changes with each install, for the store to re-render.
import languagesJson from './languages.json';
import metaJson from './meta.json';
import type { BankTheme, Language, LanguageCode, Localized, Meta, NoteTranslations, PhraseJson, SetJson, Topic, UiLocale } from './schema';

export type { LanguageCode, UiLocale, Topic, Language, Localized, Tag, Level, Register, PhraseNotes, PhraseImage, BankTheme } from './schema';
export type TopicTone = Topic['tone'];

export const LANGUAGES = languagesJson as unknown as Language[];
export const META = metaJson as unknown as Meta;
export const CONTENT_VERSION = META.version;

/** Whose a set or album is, from this learner's side. */
export type Owner = 'loro' | 'me' | 'other';
export type Visibility = 'private' | 'link' | 'public';

/** A phrase ready to play: content or the learner's own. */
export interface Phrase {
  id: string;
  /** The set it belongs to; null for the phrases the learner wrote on this device. */
  setId: string | null;
  targetLang: LanguageCode;
  target: string;
  /** Prompt text per native language. */
  translations: Partial<Record<LanguageCode, string>>;
  register: PhraseJson['register'] | null;
  tags: PhraseJson['tags'];
  words: PhraseJson['words'];
  /** Its picture (plan 105). Every phrase has one, as it has all three notes. */
  image: PhraseJson['image'];
  notes: PhraseJson['notes'];
  /** Note titles and texts in other native languages, by note kind. */
  noteTranslations: Partial<Record<keyof PhraseJson['notes'], NoteTranslations[string]>>;
  /**
   * Who wrote the notes of a learner's phrase, when not Loro: the AI writer, or the device's rules
   * (plan 105). Absent for Loro's phrases and bank phrases.
   */
  notesBy?: 'ai' | 'device';
  /** Where a phrase in a learner's set came from (plan 106); absent for Loro's. */
  source?: 'ai' | 'bank' | 'course' | 'written';
  audio: PhraseJson['audio'] | null;
  /** Clip lengths from content; the device's own measurements take over once it has them. */
  durationMs: PhraseJson['durationMs'] | null;
  /** Written by the learner on this device rather than served. */
  own: boolean;
}

export interface PhraseSet {
  id: string;
  title: string;
  /** Loro's sets have one per UI language; a learner's set has a description instead. */
  subtitle: Localized | null;
  description: string | null;
  topicId: string;
  level: SetJson['level'];
  coverIcon: string;
  /** A drawn cover (plan 106), as a path under the API; null draws the topic cover. */
  coverUrl: string | null;
  targetLang: LanguageCode;
  phraseIds: string[];
  owner: Owner;
  /** The maker's display name, for a learner's set. */
  author: string | null;
  visibility: Visibility;
  shareCode: string | null;
  /** In this learner's library without being theirs. */
  saved: boolean;
}

/** An album of songs sung from phrase sets (plan 106). Its songs load when it is opened. */
export interface Album {
  id: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  targetLang: LanguageCode;
  owner: Owner;
  author: string | null;
  visibility: Visibility;
  shareCode: string | null;
  saved: boolean;
  songCount: number;
  /** Null while a sung song's length is unknown, rather than a total that leaves it out. */
  durationMs: number | null;
  createdAt: number;
  updatedAt: number;
}

/** A served phrase: the content JSON's shape, with its set, note translations and source. */
export type PhraseWire = Omit<PhraseJson, 'region'> & {
  region?: string;
  setId: string;
  noteTranslations: Phrase['noteTranslations'];
  source: 'loro' | NonNullable<Phrase['source']>;
};

export interface BankPhraseWire {
  id: string;
  theme: string;
  targetLang: LanguageCode;
  target: string;
  translations: Partial<Record<LanguageCode, string>>;
  image: PhraseJson['image'];
  notes: PhraseJson['notes'];
  noteTranslations: Phrase['noteTranslations'];
}

/** One course's content as the API serves it (GET /library/pack). */
export interface ContentPack {
  version: string;
  targetLang: LanguageCode;
  topics: Topic[];
  sets: PhraseSet[];
  phrases: PhraseWire[];
  bank: { themes: BankTheme[]; phrases: BankPhraseWire[] };
  albums: Album[];
}

/** Sets opened from outside the learner's packs (a shared link, Community), kept so their phrases stay known. */
export interface ExtraSets {
  sets: PhraseSet[];
  phrases: PhraseWire[];
}

export const SETS: PhraseSet[] = [];
export const CONTENT_PHRASES: Phrase[] = [];
export const TOPICS: Topic[] = [];
/** Themes of the phrase bank: the topics "Make a set" can offer offline. */
export const BANK_THEMES: BankTheme[] = [];
export const BANK_PHRASES: BankPhrase[] = [];
export const ALBUMS: Album[] = [];

const phraseById = new Map<string, Phrase>();
const setById = new Map<string, PhraseSet>();
const bankById = new Map<string, BankPhrase>();
const packs = new Map<LanguageCode, ContentPack>();
let extras: ExtraSets = { sets: [], phrases: [] };
let revision = 0;
const listeners = new Set<() => void>();

/** Changes whenever installed content does. */
export function contentRevision(): number {
  return revision;
}

export function onContentChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The pack installed for a course, if any. */
export function installedPack(targetLang: LanguageCode): ContentPack | undefined {
  return packs.get(targetLang);
}

export function installedCourses(): LanguageCode[] {
  return [...packs.keys()];
}

export function installedExtras(): ExtraSets {
  return extras;
}

const replace = <T,>(array: T[], items: T[]) => {
  array.length = 0;
  array.push(...items);
};

function phraseOf(p: PhraseWire, set: PhraseSet): Phrase {
  return {
    id: p.id,
    setId: set.id,
    targetLang: set.targetLang,
    target: p.target,
    translations: p.translations,
    register: p.register,
    tags: p.tags,
    words: p.words,
    image: p.image,
    notes: p.notes,
    noteTranslations: p.noteTranslations,
    ...(p.source === 'loro' ? {} : { source: p.source, ...(p.source === 'ai' ? { notesBy: 'ai' as const } : {}) }),
    audio: p.audio ?? null,
    durationMs: p.durationMs ?? null,
    own: false,
  };
}

/** Rebuilds every array and map from the installed packs and extras, then tells the listeners. */
function rebuild(): void {
  const all = [...packs.values()];
  const sets: PhraseSet[] = all.flatMap((pack) => pack.sets);
  const inPacks = new Set(sets.map((s) => s.id));
  const extraSets = extras.sets.filter((s) => !inPacks.has(s.id));
  const wires = [...all.flatMap((pack) => pack.phrases), ...extras.phrases.filter((p) => extraSets.some((s) => s.id === p.setId))];
  setById.clear();
  for (const set of [...sets, ...extraSets]) setById.set(set.id, set);
  replace(SETS, [...sets, ...extraSets]);
  phraseById.clear();
  const phrases: Phrase[] = [];
  for (const wire of wires) {
    const set = setById.get(wire.setId);
    if (!set || phraseById.has(wire.id)) continue;
    const phrase = phraseOf(wire, set);
    phraseById.set(phrase.id, phrase);
    phrases.push(phrase);
  }
  replace(CONTENT_PHRASES, phrases);
  replace(TOPICS, all[0]?.topics ?? []);
  const themes = new Map<string, BankTheme>();
  for (const pack of all) for (const theme of pack.bank.themes) themes.set(theme.id, theme);
  replace(BANK_THEMES, [...themes.values()]);
  replace(
    BANK_PHRASES,
    all.flatMap((pack) => pack.bank.phrases),
  );
  bankById.clear();
  for (const phrase of BANK_PHRASES) bankById.set(phrase.id, phrase);
  replace(
    ALBUMS,
    all.flatMap((pack) => pack.albums),
  );
  revision += 1;
  for (const listener of listeners) listener();
}

/** Installs courses' packs, replacing what was installed for those courses. */
export function installPacks(next: ContentPack[]): void {
  for (const pack of next) packs.set(pack.targetLang, pack);
  rebuild();
}

/** Adds sets opened from outside the packs (a shared link, Community), replacing older copies. */
export function installExtras(more: ExtraSets): void {
  const ids = new Set(more.sets.map((s) => s.id));
  extras = {
    sets: [...extras.sets.filter((s) => !ids.has(s.id)), ...more.sets],
    phrases: [...extras.phrases.filter((p) => !ids.has(p.setId)), ...more.phrases],
  };
  rebuild();
}

/** Forgets the sets opened from outside the packs. */
export function forgetExtras(): void {
  extras = { sets: [], phrases: [] };
  rebuild();
}

/** Forgets every installed pack and extra: for tests. */
export function resetContent(): void {
  packs.clear();
  extras = { sets: [], phrases: [] };
  rebuild();
}

export function findContentPhrase(id: string | null | undefined): Phrase | undefined {
  return id ? phraseById.get(id) : undefined;
}

export function findSet(id: string | null | undefined): PhraseSet | undefined {
  return id ? setById.get(id) : undefined;
}

export function getSet(id: string): PhraseSet {
  const set = setById.get(id);
  if (!set) throw new Error(`Unknown set: ${id}`);
  return set;
}

export function getTopic(id: string): Topic | undefined {
  return TOPICS.find((t) => t.id === id);
}

/** Loro's sets of one course, in content order: the course itself. */
export function setsForCourse(targetLang: LanguageCode): PhraseSet[] {
  return SETS.filter((s) => s.targetLang === targetLang && s.owner === 'loro');
}

/** The learner's own served sets and the ones they saved, newest first. */
export function librarySets(targetLang: LanguageCode): PhraseSet[] {
  return SETS.filter((s) => s.targetLang === targetLang && (s.owner === 'me' || s.saved));
}

/** A set that belongs in the learner's library or course, rather than one only opened once. */
export function inLibrary(set: PhraseSet): boolean {
  return set.owner === 'loro' || set.owner === 'me' || set.saved;
}

/** The albums of one course: Loro's first, then the learner's own and saved ones. */
export function albumsForCourse(targetLang: LanguageCode): Album[] {
  return ALBUMS.filter((a) => a.targetLang === targetLang);
}

export function findAlbum(id: string | null | undefined): Album | undefined {
  return id ? ALBUMS.find((a) => a.id === id) : undefined;
}

export function getLanguage(code: LanguageCode): Language {
  const language = LANGUAGES.find((l) => l.code === code);
  if (!language) throw new Error(`Unknown language: ${code}`);
  return language;
}

export const NATIVE_LANGUAGES = LANGUAGES.filter((l) => l.uiLocale !== null).map((l) => l.code);
export const TARGET_LANGUAGES = LANGUAGES.filter((l) => l.canTarget).map((l) => l.code);

export function uiLocaleOf(native: LanguageCode): UiLocale {
  return getLanguage(native).uiLocale ?? 'en';
}

/** Courses a learner with this native language can take. */
export function coursesFor(native: LanguageCode): LanguageCode[] {
  return TARGET_LANGUAGES.filter((code) => code !== native);
}

export const RENAMED_PHRASE_IDS: Record<string, string> = META.renamedPhraseIds;

// ---------- the phrase bank ----------

/** A suggestion from the bank: not in any set, and not the learner's until they add it. */
export interface BankPhrase {
  id: string;
  theme: string;
  targetLang: LanguageCode;
  target: string;
  translations: Partial<Record<LanguageCode, string>>;
  image: PhraseJson['image'];
  notes: PhraseJson['notes'];
  /** Note titles and texts in other native languages, by note kind. */
  noteTranslations: Partial<Record<keyof PhraseJson['notes'], NoteTranslations[string]>>;
}

export function findBankPhrase(id: string | null | undefined): BankPhrase | undefined {
  return id ? bankById.get(id) : undefined;
}
