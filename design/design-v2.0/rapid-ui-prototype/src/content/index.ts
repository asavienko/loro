// Vocabulary lives in the JSON files next to this module and is validated here
// at start-up. Nothing here is learner progress: every learner number is derived
// from the state machine in src/state/. Phrases the learner writes themselves
// live in learner state and join this content in src/state/catalog.ts.
import { z } from 'zod';
import phrasesJson from './phrases.json';
import setsJson from './sets.json';
import topicsJson from './topics.json';
import languagesJson from './languages.json';
import metaJson from './meta.json';
import noteTranslationsJson from './note-translations.json';
import {
  contentProblems,
  Language,
  LanguageCode,
  languageSchema,
  metaSchema,
  NoteTranslations,
  noteTranslationsSchema,
  PhraseJson,
  phraseSchema,
  SetJson,
  setSchema,
  Topic,
  topicSchema,
  UiLocale,
} from './schema';

export type { LanguageCode, UiLocale, Topic, Language, Localized, Tag, Level, Register, PhraseNotes } from './schema';
export type TopicTone = Topic['tone'];

function parse<T>(schema: z.ZodType<T>, value: unknown, file: string): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new Error(`Invalid ${file}: ${z.prettifyError(result.error)}`);
  return result.data;
}

const phraseJson = parse(z.array(phraseSchema), phrasesJson, 'phrases.json');
const setJson = parse(z.array(setSchema), setsJson, 'sets.json');
export const TOPICS: Topic[] = parse(z.array(topicSchema), topicsJson, 'topics.json');
export const LANGUAGES: Language[] = parse(z.array(languageSchema), languagesJson, 'languages.json');
export const META = parse(metaSchema, metaJson, 'meta.json');
export const CONTENT_VERSION = META.version;
const noteTranslations: NoteTranslations = parse(noteTranslationsSchema, noteTranslationsJson, 'note-translations.json');

const problems = contentProblems({
  phrases: phraseJson,
  sets: setJson,
  topics: TOPICS,
  languages: LANGUAGES,
  renamed: META.renamedPhraseIds,
  noteTranslations,
});
if (problems.length > 0) throw new Error(`Invalid content:\n${problems.join('\n')}`);

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
