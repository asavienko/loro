// Full validation of the content the API seeds (packages/content/v2): each file against its zod
// schema, then the cross-file rules. It runs in the unit tests, so the app ships without zod and
// trusts content that passed here.
import { z } from 'zod';
import phrasesJson from '../../../../../packages/content/v2/phrases.json';
import setsJson from '../../../../../packages/content/v2/sets.json';
import topicsJson from '../../../../../packages/content/v2/topics.json';
import languagesJson from '../../../../../packages/content/v2/languages.json';
import metaJson from './meta.json';
import noteTranslationsJson from '../../../../../packages/content/v2/note-translations.json';
import bankJson from '../../../../../packages/content/v2/bank.json';
import bankNoteTranslationsJson from '../../../../../packages/content/v2/bank-note-translations.json';
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
