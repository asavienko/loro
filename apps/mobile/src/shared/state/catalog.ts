// The content the app has installed, seen as one catalog: Loro's sets, the learner's own and saved
// ones, all from the API (plan 108). Phrases and sets made on a device before they lived in the
// learner's account are in learner state only until they are uploaded (state/upload.ts).
import {
  BANK_PHRASES,
  CONTENT_PHRASES,
  findContentPhrase,
  findSet,
  inLibrary,
  LanguageCode,
  Level,
  librarySets,
  Phrase,
  PhraseSet,
  setsForCourse,
} from '../content';
import { memoryKey } from './memory';
import type { LearnerState } from './types';

/** The ids a device gave the learner's phrases and sets before they were uploaded (plan 108). */
export const OWN_PHRASE_PREFIX = 'mine-p-';
export const OWN_SET_PREFIX = 'mine-s-';

/** The phrase bank's phrase that says the same as `text` in the course language, if there is one. */
export function bankMatch(targetLang: LanguageCode, text: string): string | undefined {
  const key = sameKey(text);
  return key ? BANK_PHRASES.find((b) => b.targetLang === targetLang && sameKey(b.target) === key)?.id : undefined;
}

export function findPhrase(_learner: LearnerState, id: string | null | undefined): Phrase | undefined {
  return findContentPhrase(id);
}

/** The prompt in the learner's language, falling back to whatever the phrase has. */
export function promptOf(phrase: Phrase, nativeLang: LanguageCode): { lang: LanguageCode; text: string } {
  const own = phrase.translations[nativeLang];
  if (own) return { lang: nativeLang, text: own };
  const [lang, text] = Object.entries(phrase.translations)[0] as [LanguageCode, string];
  return { lang, text };
}

export function keyOf(learner: LearnerState, phraseId: string): string {
  const phrase = findPhrase(learner, phraseId);
  const target = phrase?.targetLang ?? learner.profile.targetLang;
  return memoryKey(learner.profile.nativeLang, target, phraseId);
}

/** A set as the set page shows it: Loro's, the learner's own, or one they saved or opened. */
export interface SetView {
  id: string;
  title: string;
  content: PhraseSet | null;
  topicId: string | null;
  level: Level | null;
  coverIcon: string;
  targetLang: LanguageCode;
  phraseIds: string[];
}

export function findSetView(_learner: LearnerState, id: string | null | undefined): SetView | undefined {
  const content = findSet(id);
  if (!content) return undefined;
  return {
    id: content.id,
    title: content.title,
    content,
    topicId: content.topicId,
    level: content.level,
    coverIcon: content.coverIcon,
    targetLang: content.targetLang,
    phraseIds: content.phraseIds,
  };
}

/** Content sets of the learner's current course. */
export function courseSets(learner: LearnerState): PhraseSet[] {
  return setsForCourse(learner.profile.targetLang);
}

/** The phrases the learner holds in their own sets, in the current course: theirs to edit and delete. */
export function ownPhrases(learner: LearnerState): Phrase[] {
  return CONTENT_PHRASES.filter((p) => p.own && p.targetLang === learner.profile.targetLang);
}

/** The learner's own sets of the current course, their "My phrases" set among them. */
export function ownSets(learner: LearnerState): PhraseSet[] {
  return librarySets(learner.profile.targetLang).filter((s) => s.owner === 'me');
}

/** Every phrase of the current course in the learner's library: Loro's, their own and saved sets' (plan 106). */
export function coursePhrases(learner: LearnerState): Phrase[] {
  const target = learner.profile.targetLang;
  // Not a shared set only opened once.
  const kept = (p: Phrase) => {
    const set = findSet(p.setId);
    return set !== undefined && inLibrary(set);
  };
  return CONTENT_PHRASES.filter((p) => p.targetLang === target && kept(p));
}

/** Case, accents, punctuation and spacing don't make a phrase different (search: "ano" finds "año"). */
export function phraseKey(text: string): string {
  return foldKey(text.normalize('NFD'));
}

/**
 * For "you already have this": as phraseKey, but ñ and й stay letters of their own
 * (año ≠ ano, мой ≠ мои). An accent (dónde / donde) or ё written as е still matches.
 */
export function sameKey(text: string): string {
  const kept = text
    .normalize('NFD')
    .replace(/([nN])\u0303/g, (_, n: string) => (n === 'n' ? '\u00f1' : '\u00d1'))
    .replace(/([иИ])\u0306/g, (_, i: string) => (i === 'и' ? 'й' : 'Й'));
  return foldKey(kept);
}

function foldKey(decomposed: string): string {
  return decomposed
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** A phrase of the current course that says the same as `text` (not `exceptId`), if any. */
export function findSamePhrase(learner: LearnerState, text: string, exceptId?: string): Phrase | undefined {
  const key = sameKey(text);
  if (!key) return undefined;
  return coursePhrases(learner).find((p) => p.id !== exceptId && sameKey(p.target) === key);
}
