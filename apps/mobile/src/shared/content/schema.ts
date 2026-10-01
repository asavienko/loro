// Runtime schema for the bundled vocabulary. The JSON files are validated when
// the app starts (and in content.test.ts), so a typo in content fails loudly
// instead of rendering `undefined`.
import { z } from 'zod';
import { idLanguage, LANGUAGE_CODES, sameLanguage, UI_LOCALES } from './codes';

export const LANGUAGE_CODE = z.enum(LANGUAGE_CODES);
export const UI_LOCALE = z.enum(UI_LOCALES);

const localized = z.object({ en: z.string().min(1), bg: z.string().min(1), ru: z.string().min(1), pl: z.string().min(1), cs: z.string().min(1) });
/** Text per native language; the phrase's own target language is never a key. */
const byLanguage = z.partialRecord(LANGUAGE_CODE, z.string().min(1));

const note = z.object({ title: z.string().min(1), text: z.string().min(1) });

/**
 * Every phrase's notes, all three (plan 105): a mnemonic (a hook for remembering it), the grammar
 * rule it shows, and its sounds, with IPA and a respelling for English readers. Written in English;
 * the other UI languages' versions sit beside them.
 */
export const notesSchema = z.object({
  mnemonic: note,
  grammar: note,
  pronunciation: note.extend({ ipa: z.string().regex(/^\[.+\]$/, 'IPA goes in [square brackets]'), respelling: z.string().min(1) }),
});

/**
 * A phrase's picture: one to three Material Symbols, drawn on its topic's colour. Drawn, as covers
 * are: offline, free to load, and never showing text. The icons must be in the registry (ui.test).
 */
export const imageSchema = z.array(z.string().regex(/^[a-z0-9_]+$/)).min(1).max(3);

export const phraseSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*-\d{2}$/, 'ids look like "cafe-01"'),
  target: z.string().min(1),
  translations: byLanguage,
  register: z.enum(['formal', 'informal', 'neutral']),
  region: z.string().length(2),
  tags: z.array(z.enum(['politeness', 'question', 'request', 'numbers', 'food', 'directions', 'social'])).min(1),
  image: imageSchema,
  /** Gloss of a word or a multi-word unit, keyed by its lower-case surface form. */
  words: z.record(z.string().min(1), byLanguage),
  notes: notesSchema,
  /** Recorded clips, once the backend provides them. Absent means device speech. */
  audio: z.partialRecord(LANGUAGE_CODE, z.string().url()).optional(),
  /** Length of each recorded clip at 1.0×, in ms, as the backend measured it. */
  durationMs: z.partialRecord(LANGUAGE_CODE, z.number().int().positive()).optional(),
});

export const setSchema = z.object({
  id: z.string().regex(/^set-[a-z0-9-]+$/),
  title: z.string().min(1),
  subtitle: localized,
  topicId: z.string(),
  level: z.enum(['A1', 'A2', 'B1']),
  coverIcon: z.string().min(1),
  targetLang: LANGUAGE_CODE,
  phraseIds: z.array(z.string()).min(1),
});

export const topicSchema = z.object({
  id: z.string(),
  title: localized,
  icon: z.string().min(1),
  tone: z.enum(['primary', 'secondary', 'tertiary']),
});

export const languageSchema = z.object({
  code: LANGUAGE_CODE,
  flag: z.string().min(1),
  /** UI locale when this is the learner's native language; null if it can't be. */
  uiLocale: UI_LOCALE.nullable(),
  canTarget: z.boolean(),
});

const noteText = z.object({ title: z.string().min(1), text: z.string().min(1) });
/** "<phraseId>.<note kind>" → the note's title and text per native language. */
export const noteTranslationsSchema = z.record(z.string(), z.partialRecord(LANGUAGE_CODE, noteText));

/**
 * The phrase bank: suggestions the "Make a set" flow can offer offline. A bank phrase belongs to no
 * set; it becomes the learner's own phrase only when they add it.
 */
export const bankThemeSchema = z.object({
  id: z.string().regex(/^[a-z]+(-[a-z]+)*$/),
  title: localized,
  /** Lower-case words, in any course or UI language, that bring this theme to mind. */
  keywords: z.array(z.string().min(2).regex(/^[^A-Z]+$/, 'keywords are lower case')).min(4),
});

export const bankPhraseSchema = z.object({
  id: z.string().regex(/^bank-[a-z]+(-[a-z]+)*-[a-z]{2}-\d{2}$/, 'ids look like "bank-hotel-es-01"'),
  theme: z.string(),
  targetLang: LANGUAGE_CODE,
  target: z.string().min(1).max(120),
  translations: byLanguage,
  image: imageSchema,
  notes: notesSchema,
});

export const bankSchema = z.object({ themes: z.array(bankThemeSchema).min(1), phrases: z.array(bankPhraseSchema).min(1) });

export const metaSchema = z.object({
  version: z.string().min(1),
  review: z.record(z.string(), z.string()),
  renamedPhraseIds: z.record(z.string(), z.string()),
});

export type LanguageCode = z.infer<typeof LANGUAGE_CODE>;
export type UiLocale = z.infer<typeof UI_LOCALE>;
export type Localized = z.infer<typeof localized>;
export type PhraseJson = z.infer<typeof phraseSchema>;
export type SetJson = z.infer<typeof setSchema>;
export type Topic = z.infer<typeof topicSchema>;
export type Language = z.infer<typeof languageSchema>;
export type Tag = PhraseJson['tags'][number];
export type Level = SetJson['level'];
export type Register = PhraseJson['register'];
export type PhraseNotes = PhraseJson['notes'];
export type PhraseImage = PhraseJson['image'];
export type NoteTranslations = z.infer<typeof noteTranslationsSchema>;
export type Meta = z.infer<typeof metaSchema>;
export type BankJson = z.infer<typeof bankSchema>;
export type BankTheme = z.infer<typeof bankThemeSchema>;
export type BankPhraseJson = z.infer<typeof bankPhraseSchema>;

/** At most this many words to a suggested phrase: something to say in one breath. */
export const MAX_PHRASE_WORDS = 12;

/** Case, accents and punctuation folded away, to find the same phrase written twice. */
const textKey = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

/**
 * The bank's rules: known themes and course languages, every native translation but the phrase's
 * own, one breath long, and never a phrase the course or the bank already has.
 */
export function bankProblems(bank: BankJson, phrases: PhraseJson[], sets: SetJson[], languages: Language[], noteTranslations?: NoteTranslations): string[] {
  const problems: string[] = [];
  const themeIds = bank.themes.map((t) => t.id);
  for (const id of themeIds.filter((t, i) => themeIds.indexOf(t) !== i)) problems.push(`bank: duplicate theme ${id}`);
  const ids = bank.phrases.map((p) => p.id);
  for (const id of ids.filter((p, i) => ids.indexOf(p) !== i)) problems.push(`bank: duplicate phrase id ${id}`);
  for (const theme of bank.themes) {
    if (!bank.phrases.some((p) => p.theme === theme.id)) problems.push(`bank: theme ${theme.id} has no phrases`);
  }

  const natives = languages.filter((l) => l.uiLocale !== null).map((l) => l.code);
  const catalog = new Map<string, string>();
  for (const set of sets) for (const id of set.phraseIds) {
    const phrase = phrases.find((p) => p.id === id);
    if (phrase) catalog.set(`${set.targetLang} ${textKey(phrase.target)}`, id);
  }
  const seen = new Map<string, string>();
  for (const phrase of bank.phrases) {
    if (!themeIds.includes(phrase.theme)) problems.push(`${phrase.id}: unknown theme ${phrase.theme}`);
    if (!languages.find((l) => l.code === phrase.targetLang)?.canTarget) problems.push(`${phrase.id}: ${phrase.targetLang} is not a course language`);
    if (!phrase.id.includes(`-${idLanguage(phrase.targetLang)}-`)) problems.push(`${phrase.id}: id doesn't name its language ${phrase.targetLang}`);
    if (!phrase.id.startsWith(`bank-${phrase.theme}-`)) problems.push(`${phrase.id}: id doesn't name its theme ${phrase.theme}`);
    const words = phrase.target.trim().split(/\s+/).length;
    if (words > MAX_PHRASE_WORDS) problems.push(`${phrase.id}: ${words} words, at most ${MAX_PHRASE_WORDS}`);
    for (const native of natives) {
      if (sameLanguage(native, phrase.targetLang)) {
        if (phrase.translations[native]) problems.push(`${phrase.id}: translation into its own language`);
      } else if (!phrase.translations[native]) problems.push(`${phrase.id}: missing ${native} translation`);
    }
    for (const text of Object.values(phrase.translations)) if (text && text.length > 120) problems.push(`${phrase.id}: a translation is over 120 characters`);
    const key = `${phrase.targetLang} ${textKey(phrase.target)}`;
    const inCatalog = catalog.get(key);
    if (inCatalog) problems.push(`${phrase.id}: the course already has it as ${inCatalog}`);
    const twin = seen.get(key);
    if (twin) problems.push(`${phrase.id}: the same phrase as ${twin}`);
    seen.set(key, phrase.id);
    // Every note in every UI language but English (the original) and the phrase's own.
    if (noteTranslations) {
      for (const kind of Object.keys(phrase.notes)) {
        for (const native of natives) {
          if (sameLanguage(native, 'en-GB') || sameLanguage(native, phrase.targetLang)) continue;
          if (!noteTranslations[`${phrase.id}.${kind}`]?.[native]) problems.push(`${phrase.id}.${kind}: missing ${native} note`);
        }
      }
    }
  }
  if (noteTranslations) {
    const kinds = new Set(bank.phrases.flatMap((p) => Object.keys(p.notes).map((kind) => `${p.id}.${kind}`)));
    for (const key of Object.keys(noteTranslations)) if (!kinds.has(key)) problems.push(`bank: note translation for unknown note ${key}`);
  }
  return problems;
}

/** Cross-file rules zod can't express on one file. Returns every problem found. */
export function contentProblems(input: {
  phrases: PhraseJson[];
  sets: SetJson[];
  topics: Topic[];
  languages: Language[];
  renamed: Record<string, string>;
  noteTranslations?: NoteTranslations;
}): string[] {
  const problems: string[] = [];
  const { phrases, sets, topics, languages, renamed } = input;
  const dupes = (ids: string[]) => ids.filter((id, i) => ids.indexOf(id) !== i);
  for (const id of dupes(phrases.map((p) => p.id))) problems.push(`duplicate phrase id ${id}`);
  for (const id of dupes(sets.map((s) => s.id))) problems.push(`duplicate set id ${id}`);
  for (const id of dupes(topics.map((t) => t.id))) problems.push(`duplicate topic id ${id}`);

  const phraseIds = new Set(phrases.map((p) => p.id));
  const owners = new Map<string, string[]>();
  for (const set of sets) {
    if (!topics.some((t) => t.id === set.topicId)) problems.push(`${set.id}: unknown topic ${set.topicId}`);
    const language = languages.find((l) => l.code === set.targetLang);
    if (!language?.canTarget) problems.push(`${set.id}: ${set.targetLang} is not a course language`);
    for (const id of set.phraseIds) {
      if (!phraseIds.has(id)) problems.push(`${set.id}: unknown phrase ${id}`);
      owners.set(id, [...(owners.get(id) ?? []), set.id]);
    }
  }

  const natives = languages.filter((l) => l.uiLocale !== null).map((l) => l.code);
  for (const phrase of phrases) {
    const setIds = owners.get(phrase.id) ?? [];
    if (setIds.length !== 1) problems.push(`${phrase.id}: belongs to ${setIds.length} sets, needs exactly 1`);
    const target = sets.find((s) => s.id === setIds[0])?.targetLang;
    if (!target) continue;
    for (const native of natives) {
      if (sameLanguage(native, target)) {
        if (phrase.translations[native]) problems.push(`${phrase.id}: translation into its own language`);
        continue;
      }
      if (!phrase.translations[native]) problems.push(`${phrase.id}: missing ${native} translation`);
      for (const [word, gloss] of Object.entries(phrase.words)) {
        if (!gloss[native]) problems.push(`${phrase.id}: word "${word}" has no ${native} gloss`);
      }
    }
    const text = phrase.target.toLocaleLowerCase(target);
    for (const word of Object.keys(phrase.words)) {
      if (!text.includes(word)) problems.push(`${phrase.id}: glossed word "${word}" is not in the phrase`);
    }
  }

  // Every note has a translation into every native language except English (the original) and the phrase's own.
  if (input.noteTranslations) {
    const kinds = new Set<string>();
    for (const phrase of phrases) {
      const target = sets.find((s) => s.phraseIds.includes(phrase.id))?.targetLang;
      for (const kind of Object.keys(phrase.notes)) {
        const key = `${phrase.id}.${kind}`;
        kinds.add(key);
        for (const native of natives) {
          if (sameLanguage(native, 'en-GB') || (target && sameLanguage(native, target))) continue;
          if (!input.noteTranslations[key]?.[native]) problems.push(`${key}: missing ${native} note`);
        }
      }
    }
    for (const key of Object.keys(input.noteTranslations)) if (!kinds.has(key)) problems.push(`note translation for unknown note ${key}`);
  }

  for (const [from, to] of Object.entries(renamed)) {
    if (!phraseIds.has(to)) problems.push(`renamed ${from} → unknown phrase ${to}`);
  }
  return problems;
}
