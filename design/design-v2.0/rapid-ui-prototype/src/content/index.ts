// Vocabulary lives in the JSON files next to this module. It is validated at build
// time and in the unit tests (validate.ts), so the app loads it without zod. Nothing
// here is learner progress: every learner number is derived from the state machine
// in src/state/. Phrases the learner writes themselves live in learner state and
// join this content in src/state/catalog.ts.
import phrasesJson from './phrases.json';
import setsJson from './sets.json';
import topicsJson from './topics.json';
import languagesJson from './languages.json';
import metaJson from './meta.json';
import noteTranslationsJson from './note-translations.json';
import bankJson from './bank.json';
import type { BankJson, BankTheme, Language, LanguageCode, Meta, NoteTranslations, PhraseJson, SetJson, Topic, UiLocale } from './schema';

export type { LanguageCode, UiLocale, Topic, Language, Localized, Tag, Level, Register, PhraseNotes, PhraseImage, BankTheme } from './schema';
export type TopicTone = Topic['tone'];

// The JSON's inferred types are wider (plain strings); validation has proved the narrow ones.
const phraseJson = phrasesJson as unknown as PhraseJson[];
const setJson = setsJson as unknown as SetJson[];
export const TOPICS = topicsJson as unknown as Topic[];
export const LANGUAGES = languagesJson as unknown as Language[];
export const META = metaJson as unknown as Meta;
export const CONTENT_VERSION = META.version;
const noteTranslations = noteTranslationsJson as unknown as NoteTranslations;

/** A phrase ready to play: content or the learner's own. */
export interface Phrase {
  id: string;
  /** The set it belongs to, derived from sets.json; null for the learner's own phrases. */
  setId: string | null;
  targetLang: LanguageCode;
  target: string;
  /** Prompt text per native language. */
  translations: Partial<Record<LanguageCode, string>>;
  register: PhraseJson['register'] | null;
  tags: PhraseJson['tags'];
  words: PhraseJson['words'];
  /** Its picture (plan 105); null for one of the learner's own that has none yet. */
  image: PhraseJson['image'] | null;
  notes: PhraseJson['notes'] | null;
  /** Note titles and texts in other native languages, by note kind. */
  noteTranslations: Partial<Record<keyof PhraseJson['notes'], NoteTranslations[string]>>;
  audio: PhraseJson['audio'] | null;
  /** Clip lengths from content; the device's own measurements take over once it has them. */
  durationMs: PhraseJson['durationMs'] | null;
  /** Written by the learner rather than bundled. */
  own: boolean;
}

export interface PhraseSet {
  id: string;
  title: string;
  subtitle: SetJson['subtitle'];
  topicId: string;
  level: SetJson['level'];
  coverIcon: string;
  targetLang: LanguageCode;
  phraseIds: string[];
}

export const SETS: PhraseSet[] = setJson;

const setOf = new Map<string, PhraseSet>();
for (const set of SETS) for (const id of set.phraseIds) setOf.set(id, set);

export const CONTENT_PHRASES: Phrase[] = phraseJson.map((p) => {
  const set = setOf.get(p.id)!;
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
    noteTranslations: Object.fromEntries(Object.keys(p.notes).map((kind) => [kind, noteTranslations[`${p.id}.${kind}`] ?? {}])),
    audio: p.audio ?? null,
    durationMs: p.durationMs ?? null,
    own: false,
  };
});

const phraseById = new Map(CONTENT_PHRASES.map((p) => [p.id, p]));
const setById = new Map(SETS.map((s) => [s.id, s]));

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

/** Sets of one course, in content order. */
export function setsForCourse(targetLang: LanguageCode): PhraseSet[] {
  return SETS.filter((s) => s.targetLang === targetLang);
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

const bank = bankJson as unknown as BankJson;

/** Themes of the phrase bank, in file order: the topics "Make a set" can offer offline. */
export const BANK_THEMES: BankTheme[] = bank.themes;

/** A suggestion from the bank: not in any set, and not the learner's until they add it. */
export interface BankPhrase {
  id: string;
  theme: string;
  targetLang: LanguageCode;
  target: string;
  translations: Partial<Record<LanguageCode, string>>;
}

export const BANK_PHRASES: BankPhrase[] = bank.phrases;

