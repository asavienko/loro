// Runtime schema for the bundled vocabulary. The JSON files are validated when
// the app starts (and in content.test.ts), so a typo in content fails loudly
// instead of rendering `undefined`.
import { z } from 'zod';

export const LANGUAGE_CODE = z.enum(['en-GB', 'es-ES', 'bg-BG', 'ru-RU']);
export const UI_LOCALE = z.enum(['en', 'bg', 'ru']);

const localized = z.object({ en: z.string().min(1), bg: z.string().min(1), ru: z.string().min(1) });
/** Text per native language; the phrase's own target language is never a key. */
const byLanguage = z.partialRecord(LANGUAGE_CODE, z.string().min(1));

const note = z.object({ title: z.string().min(1), text: z.string().min(1) });

export const phraseSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*-\d{2}$/, 'ids look like "cafe-01"'),
  target: z.string().min(1),
  translations: byLanguage,
  register: z.enum(['formal', 'informal', 'neutral']),
  region: z.string().length(2),
  tags: z.array(z.enum(['politeness', 'question', 'request', 'numbers', 'food', 'directions', 'social'])).min(1),
  /** Gloss of a word or a multi-word unit, keyed by its lower-case surface form. */
  words: z.record(z.string().min(1), byLanguage),
  notes: z
    .object({
      mnemonic: note.optional(),
      grammar: note.optional(),
      pronunciation: note.extend({ ipa: z.string().min(1), respelling: z.string().min(1) }).optional(),
    })
    .refine((n) => Boolean(n.mnemonic || n.grammar || n.pronunciation), 'every phrase has at least one note'),
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

/** Cross-file rules zod can't express on one file. Returns every problem found. */
export function contentProblems(input: {
  phrases: PhraseJson[];
  sets: SetJson[];
  topics: Topic[];
  languages: Language[];
  renamed: Record<string, string>;
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
      if (native === target) {
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

  for (const [from, to] of Object.entries(renamed)) {
    if (!phraseIds.has(to)) problems.push(`renamed ${from} → unknown phrase ${to}`);
  }
  return problems;
}
