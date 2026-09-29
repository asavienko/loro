// "Make a set": what the learner asks for, and the phrases offered back. A suggestion is only an
// offer; nothing becomes the learner's until they add it (plan 103, after plan 97's boundary).
import type { LanguageCode, TopicTone } from '../content';
import type { OwnNotes } from '../state/types';

/** A topic ("at the pharmacy"), a few keywords ("hotel, towel") or a pasted text. */
export type SuggestMode = 'topic' | 'keywords' | 'text';

export const SUGGEST_MODES: SuggestMode[] = ['topic', 'keywords', 'text'];

/** How much each kind of input may hold, in UTF-16 units (what maxLength counts). */
export const INPUT_LIMITS: Record<SuggestMode, number> = { topic: 80, keywords: 200, text: 2000 };

/** At most this many suggestions to one deck. */
export const DECK_SIZE = 12;

export interface SuggestRequest {
  mode: SuggestMode;
  input: string;
  targetLang: LanguageCode;
  nativeLang: LanguageCode;
}

/**
 * Where a suggestion comes from, which the card says: a phrase of the course, one of the learner's
 * own, the bundled phrase bank, or written just now by AI (not checked by a native speaker).
 */
export type SuggestionSource = 'course' | 'mine' | 'bank' | 'ai';

export interface Suggestion {
  /** Unique within a deck: "course:cafe-01", "bank:bank-hotel-es-02", "ai:3". */
  key: string;
  source: SuggestionSource;
  target: string;
  /** The meaning in the learner's language. */
  native: string;
  /** Added by this id: a course phrase or one of the learner's own. Absent when adding makes a new phrase. */
  phraseId?: string;
  /** A course phrase's set, which the card names. */
  setTitle?: string;
  /** Its picture (plan 105), when it has one, and the colour it sits on. */
  image?: readonly string[];
  tone?: TopicTone;
  /** A phrase-bank suggestion: the phrase added keeps it, and reads its notes and picture from the bank. */
  bankId?: string;
  /** An AI suggestion's notes, in the learner's language: the phrase added keeps them. */
  notes?: OwnNotes;
}
