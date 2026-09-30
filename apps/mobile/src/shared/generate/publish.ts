// Kept suggestions as phrases of a set in the learner's account (plan 106). Each carries its picture
// and all three notes in the learner's language, as the server keeps a learner's phrases; a bank
// phrase names itself, so the server keeps the bank's notes with every translation.
import type { NewPhrase } from '../api/library';
import { findBankPhrase, LanguageCode, Phrase } from '../content';
import { findPhrase } from '../state/catalog';
import type { LearnerState, OwnNotes } from '../state/types';
import type { Suggestion } from './types';

/** A phrase's notes in `native`, where it has them, keeping the IPA and respelling. */
export function notesIn(phrase: Pick<Phrase, 'notes' | 'noteTranslations'>, native: LanguageCode): OwnNotes {
  const pick = (kind: keyof OwnNotes) => phrase.noteTranslations[kind]?.[native] ?? { title: phrase.notes[kind].title, text: phrase.notes[kind].text };
  const sounds = pick('pronunciation');
  return {
    mnemonic: pick('mnemonic'),
    grammar: pick('grammar'),
    pronunciation: { title: sounds.title, text: sounds.text, ipa: phrase.notes.pronunciation.ipa, respelling: phrase.notes.pronunciation.respelling },
  };
}

export function newPhrasesOf(learner: LearnerState, kept: readonly Suggestion[]): NewPhrase[] {
  const native = learner.profile.nativeLang;
  return kept.flatMap((card): NewPhrase[] => {
    const bank = findBankPhrase(card.bankId);
    if (card.source === 'bank' && bank) {
      return [{ target: card.target, native: card.native, image: [...bank.image], notes: notesIn(bank, native), source: 'bank', bankId: bank.id }];
    }
    if (card.source === 'ai' && card.notes) {
      return [{ target: card.target, native: card.native, image: [...(card.image ?? ['forum'])], notes: card.notes, source: 'ai' }];
    }
    const phrase = findPhrase(learner, card.phraseId);
    // A corrected card is a phrase the learner wrote: the server writes its notes and picture.
    if (!phrase) return [{ target: card.target, native: card.native, source: 'written' }];
    return [{ target: card.target, native: card.native, image: [...phrase.image], notes: notesIn(phrase, native), source: card.source === 'course' ? 'course' : 'written' }];
  });
}
