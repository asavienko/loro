// Content plus the learner's own phrases and sets, seen as one catalog.
import {
  CONTENT_PHRASES,
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
  return {
    id: own.id,
    setId: null,
    targetLang: own.targetLang,
    target: own.target,
    translations: { [own.nativeLang]: own.native },
    register: null,
    tags: [],
    words: {},
    notes: null,
    noteTranslations: {},
    audio: null,
    durationMs: null,
    own: true,
  };
}

export function findPhrase(learner: LearnerState, id: string | null | undefined): Phrase | undefined {
  if (!id) return undefined;
  const content = findContentPhrase(id);
  if (content) return content;
  const own = learner.ownPhrases[id];
  return own && !own.deleted ? ownPhraseToPhrase(own) : undefined;
}

export function getPhrase(learner: LearnerState, id: string): Phrase {
  const phrase = findPhrase(learner, id);
  if (!phrase) throw new Error(`Unknown phrase: ${id}`);
  return phrase;
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
