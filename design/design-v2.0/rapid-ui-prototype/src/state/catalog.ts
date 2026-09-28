// Content plus the learner's own phrases and sets, seen as one catalog.
import {
  BANK_PHRASES,
  CONTENT_PHRASES,
  findBankPhrase,
  findContentPhrase,
  findSet,
  LanguageCode,
  Level,
  Phrase,
  PhraseSet,
  setsForCourse,
} from '../content';
import { memoryKey } from './memory';
import type { LearnerState, OwnPhrase, OwnSet } from './types';

export const OWN_PHRASE_PREFIX = 'mine-p-';
export const OWN_SET_PREFIX = 'mine-s-';

export function ownPhraseToPhrase(own: OwnPhrase): Phrase {
  // Its notes and picture: the bank's when it is a bank phrase, else what AI wrote for it (in the
  // learner's language, so they also stand as that language's version), else none yet.
  const bank = findBankPhrase(own.bankId);
  const notes = bank?.notes ?? own.notes ?? null;
  const written =
    !bank && own.notes && own.nativeLang !== 'en-GB'
      ? Object.fromEntries(Object.entries(own.notes).map(([kind, note]) => [kind, { [own.nativeLang]: { title: note.title, text: note.text } }]))
      : {};
  return {
    id: own.id,
    setId: null,
    targetLang: own.targetLang,
    target: own.target,
    translations: { [own.nativeLang]: own.native },
    register: null,
    tags: [],
    words: {},
    image: bank?.image ?? own.image ?? null,
    notes,
    noteTranslations: bank?.noteTranslations ?? written,
    audio: null,
    durationMs: null,
    own: true,
  };
}

/** The phrase bank's phrase that says the same as `text` in the course language, if there is one. */
export function bankMatch(targetLang: LanguageCode, text: string): string | undefined {
  const key = sameKey(text);
  return key ? BANK_PHRASES.find((b) => b.targetLang === targetLang && sameKey(b.target) === key)?.id : undefined;
}

export function findPhrase(learner: LearnerState, id: string | null | undefined): Phrase | undefined {
  if (!id) return undefined;
  const content = findContentPhrase(id);
  if (content) return content;
  const own = learner.ownPhrases[id];
  return own && !own.deleted ? ownPhraseToPhrase(own) : undefined;
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

/** A content set or one the learner made, as the set page shows it. */
export interface SetView {
  id: string;
  kind: 'content' | 'own';
  title: string;
  content: PhraseSet | null;
  own: OwnSet | null;
  topicId: string | null;
  level: Level | null;
  coverIcon: string;
  targetLang: LanguageCode;
  phraseIds: string[];
}

export function findSetView(learner: LearnerState, id: string | null | undefined): SetView | undefined {
  if (!id) return undefined;
  const content = findSet(id);
  if (content) {
    return {
      id,
      kind: 'content',
      title: content.title,
      content,
      own: null,
      topicId: content.topicId,
      level: content.level,
      coverIcon: content.coverIcon,
      targetLang: content.targetLang,
      phraseIds: content.phraseIds,
    };
  }
  const own = learner.ownSets[id];
  if (!own || own.deleted) return undefined;
  return {
    id,
    kind: 'own',
    title: own.title,
    content: null,
    own,
    topicId: null,
    level: null,
    coverIcon: 'queue_music',
    targetLang: own.targetLang,
    phraseIds: own.phraseIds.filter((pid) => findPhrase(learner, pid)),
  };
}

/** Content sets of the learner's current course. */
export function courseSets(learner: LearnerState): PhraseSet[] {
  return setsForCourse(learner.profile.targetLang);
}

export function ownPhrases(learner: LearnerState): Phrase[] {
  return Object.values(learner.ownPhrases)
    .filter((p) => !p.deleted && p.targetLang === learner.profile.targetLang)
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(ownPhraseToPhrase);
}

export function ownSets(learner: LearnerState): OwnSet[] {
  return Object.values(learner.ownSets)
    .filter((s) => !s.deleted && s.targetLang === learner.profile.targetLang)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Every phrase of the current course: content in set order, then the learner's own. */
export function coursePhrases(learner: LearnerState): Phrase[] {
  const target = learner.profile.targetLang;
  return [...CONTENT_PHRASES.filter((p) => p.targetLang === target), ...ownPhrases(learner)];
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
