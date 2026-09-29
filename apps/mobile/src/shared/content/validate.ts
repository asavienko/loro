// Full validation of the bundled content: each file against its zod schema, then
// the cross-file rules. It runs at build time (vite.config.ts) and in the unit
// tests, so the app itself ships without zod and trusts content that passed here.
import { z } from 'zod';
import phrasesJson from './phrases.json';
import setsJson from './sets.json';
import topicsJson from './topics.json';
import languagesJson from './languages.json';
import metaJson from './meta.json';
import noteTranslationsJson from './note-translations.json';
import bankJson from './bank.json';
import bankNoteTranslationsJson from './bank-note-translations.json';
import { bankProblems, bankSchema, contentProblems, languageSchema, metaSchema, noteTranslationsSchema, phraseSchema, setSchema, topicSchema } from './schema';

/** Every problem with the content; empty when it is valid. */
export function validateContent(): string[] {
  const problems: string[] = [];
  const check = <T,>(schema: z.ZodType<T>, value: unknown, file: string): T | null => {
    const result = schema.safeParse(value);
    if (result.success) return result.data;
    problems.push(`${file}: ${z.prettifyError(result.error)}`);
    return null;
  };
  const phrases = check(z.array(phraseSchema), phrasesJson, 'phrases.json');
  const sets = check(z.array(setSchema), setsJson, 'sets.json');
  const topics = check(z.array(topicSchema), topicsJson, 'topics.json');
  const languages = check(z.array(languageSchema), languagesJson, 'languages.json');
  const meta = check(metaSchema, metaJson, 'meta.json');
  const noteTranslations = check(noteTranslationsSchema, noteTranslationsJson, 'note-translations.json');
  if (phrases && sets && topics && languages && meta && noteTranslations) {
    problems.push(...contentProblems({ phrases, sets, topics, languages, renamed: meta.renamedPhraseIds, noteTranslations }));
  }
  const bank = check(bankSchema, bankJson, 'bank.json');
  const bankNotes = check(noteTranslationsSchema, bankNoteTranslationsJson, 'bank-note-translations.json');
  if (bank && bankNotes && phrases && sets && languages) problems.push(...bankProblems(bank, phrases, sets, languages, bankNotes));
  return problems;
}
