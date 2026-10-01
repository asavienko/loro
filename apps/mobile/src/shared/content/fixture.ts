// The server's seed (packages/content/v2) as the packs GET /library/pack serves, for the unit tests:
// `installFixture()` gives every test the content the app would download. Never imported by the app.
import phrasesJson from '../../../../../packages/content/v2/phrases.json';
import setsJson from '../../../../../packages/content/v2/sets.json';
import topicsJson from '../../../../../packages/content/v2/topics.json';
import noteTranslationsJson from '../../../../../packages/content/v2/note-translations.json';
import bankJson from '../../../../../packages/content/v2/bank.json';
import bankNoteTranslationsJson from '../../../../../packages/content/v2/bank-note-translations.json';
import languagesJson from '../../../../../packages/content/v2/languages.json';
import { applySet, ContentPack, installLanguages, installPacks, LanguageCode, Phrase, removeSet, TARGET_LANGUAGES } from './index';
import type { BankJson, Language, NoteTranslations, PhraseJson, SetJson, Topic } from './schema';

export const FIXTURE = {
  phrases: phrasesJson as unknown as PhraseJson[],
  sets: setsJson as unknown as SetJson[],
  topics: topicsJson as unknown as Topic[],
  noteTranslations: noteTranslationsJson as unknown as NoteTranslations,
  bank: bankJson as unknown as BankJson,
  bankNoteTranslations: bankNoteTranslationsJson as unknown as NoteTranslations,
  languages: languagesJson as unknown as Language[],
};

const notesOf = (id: string, all: NoteTranslations): Phrase['noteTranslations'] =>
  Object.fromEntries((['mnemonic', 'grammar', 'pronunciation'] as const).flatMap((kind) => (all[`${id}.${kind}`] ? [[kind, all[`${id}.${kind}`]]] : [])));

/** One course's pack, as the API builds it for someone signed out. */
export function fixturePack(targetLang: LanguageCode): ContentPack {
  const sets = FIXTURE.sets.filter((s) => s.targetLang === targetLang);
  return {
    version: `fixture-${targetLang}`,
    targetLang,
    topics: FIXTURE.topics,
    sets: sets.map((s) => ({ ...s, description: null, coverUrl: null, owner: 'loro', author: null, visibility: 'public', shareCode: null, saved: false })),
    phrases: sets.flatMap((s) =>
      s.phraseIds.map((id) => {
        const phrase = FIXTURE.phrases.find((p) => p.id === id)!;
        return { ...phrase, setId: s.id, noteTranslations: notesOf(id, FIXTURE.noteTranslations), source: 'loro' as const };
      }),
    ),
    bank: {
      themes: FIXTURE.bank.themes,
      phrases: FIXTURE.bank.phrases.filter((p) => p.targetLang === targetLang).map((p) => ({ ...p, noteTranslations: notesOf(p.id, FIXTURE.bankNoteTranslations) })),
    },
    albums: [],
  };
}

/** Installs the server's languages (GET /library/languages) and every course's pack. */
export function installFixture(): void {
  installLanguages({ version: 'fixture', languages: FIXTURE.languages });
  installPacks(TARGET_LANGUAGES.map(fixturePack));
}

/**
 * A set of the learner's in their account (plan 108) put into the installed content, holding the
 * phrases given (written by them) and listing `refs`; `removeOwnSet` takes it out again.
 */
export function installOwnSet(id: string, phrases: { id: string; target: string; native: string }[], refs: string[] = [], targetLang: LanguageCode = 'es-ES'): void {
  const template = FIXTURE.phrases[0];
  applySet({
    set: {
      id,
      title: 'Mine',
      subtitle: null,
      description: null,
      topicId: 'everyday',
      level: 'A2',
      coverIcon: 'edit_note',
      coverUrl: null,
      targetLang,
      phraseIds: [...phrases.map((p) => p.id), ...refs],
      owner: 'me',
      author: null,
      visibility: 'private',
      shareCode: 'abcdefghij',
      saved: false,
    },
    phrases: phrases.map((p) => ({ ...template, id: p.id, setId: id, target: p.target, translations: { 'en-GB': p.native }, noteTranslations: {}, source: 'written' as const, notesBy: 'rules' as const })),
  });
}

export function removeOwnSet(id: string): void {
  removeSet(id);
}
