// Suggestions without a network. The learner's topic, keywords or text become search terms, which
// are matched against the course's phrases, the learner's own and the bundled phrase bank. Only
// phrases that exist are offered; when nothing matches, the deck is empty and the screen says so.
import { BANK_PHRASES, BANK_THEMES, TOPICS } from '../content';
import { copyFor } from '../copy';
import { coursePhrases, findSetView, phraseKey, promptOf, sameKey } from '../state/catalog';
import type { LearnerState } from '../state/types';
import { DECK_SIZE, INPUT_LIMITS, SuggestMode, SuggestRequest, Suggestion } from './types';

/** Words that say nothing about a topic, in the UI and course languages (folded as phraseKey folds). */
const STOP_WORDS = new Set(
  phraseKey(
    // English
    'a an the at in on to of for from by with about and or but not no is are was be been am do does did ' +
      'can could would should will shall may might must i me my you your we our us they them their he she it its ' +
      'this that these those there here what where when who how why which some any all very just so too ' +
      'want need like get got go going have has had make let please thanks phrase phrases say saying ' +
      // Spanish
      'el la los las un una unos unas de del en y o a al con por para que qué mi mis tu tus su sus es son ' +
      'me te se lo le les nos yo tú muy más como cómo pero sin sobre este esta esto ese esa ' +
      // Bulgarian
      'и в във на за с със от до да се е са съм си ли не по при аз ти той тя ние вие те това този тази как ' +
      'какво що но или ще би ми ти му ѝ ни ви им много още само ' +
      // Russian
      'и в во на за с со от до по не я ты он она мы вы они это этот эта как что но или у к из о об ' +
      'мне тебе мой моя твой где когда очень ещё только бы же ли',
  ).split(' '),
);

/** Enough terms to catch a pasted text's subject; beyond this, words are more noise than signal. */
const MAX_TERMS = 60;

/** The learner's input as distinct search terms: folded, no stop words, no bare numbers. */
export function termsOf(mode: SuggestMode, input: string): string[] {
  const words = phraseKey(input.slice(0, INPUT_LIMITS[mode]))
    .split(' ')
    .filter((w) => w.length >= 2 && !STOP_WORDS.has(w) && !/^\d+$/.test(w));
  return [...new Set(words)].slice(0, MAX_TERMS);
}

/**
 * How well a term matches a word: 1 for the same word, 0.75 for the same stem ("towels" for
 * "towel", "аптеки" for "аптека", "гостинице" for "гостиница"), otherwise 0. Short words must
 * match exactly, so "hot" never finds "hotel".
 */
export function matchStrength(term: string, word: string): number {
  if (term === word) return 1;
  const short = Math.min(term.length, word.length);
  if (short < 4) return 0;
  if (word.startsWith(term) || term.startsWith(word)) return 0.75;
  let common = 0;
  while (common < short && term[common] === word[common]) common++;
  return common >= 5 && common >= short - 2 ? 0.75 : 0;
}

const bestIn = (term: string, words: readonly string[]) => words.reduce((best, w) => Math.max(best, matchStrength(term, w)), 0);

const wordsOf = (...texts: (string | undefined)[]) => [...new Set(texts.filter(Boolean).flatMap((t) => phraseKey(t!).split(' ')).filter(Boolean))];

/** A phrase that could be offered, with its words by how much they say about it. */
interface Entry {
  suggestion: Suggestion;
  /** The phrase and its translations: a term found here is what the phrase is about. */
  primary: string[];
  /** Its theme in the bank: every phrase of a theme the learner names is relevant. */
  theme: string[];
  /** Word glosses, its set and topic, its tags: weaker evidence. */
  secondary: string[];
}

const TAG_LOCALES = ['en', 'bg', 'ru'] as const;

function entries(learner: LearnerState): Entry[] {
  const { nativeLang, targetLang } = learner.profile;
  const out: Entry[] = [];
  for (const p of coursePhrases(learner)) {
    const set = findSetView(learner, p.setId);
    const topic = TOPICS.find((t) => t.id === set?.topicId);
    out.push({
      suggestion: {
        key: `${p.own ? 'mine' : 'course'}:${p.id}`,
        source: p.own ? 'mine' : 'course',
        target: p.target,
        native: promptOf(p, nativeLang).text,
        phraseId: p.id,
        ...(set ? { setTitle: set.title } : {}),
        ...(p.image ? { image: p.image, tone: topic?.tone ?? 'secondary' } : {}),
      },
      primary: wordsOf(p.target, ...Object.values(p.translations)),
      theme: [],
      secondary: wordsOf(
        ...Object.entries(p.words).flatMap(([word, gloss]) => [word, ...Object.values(gloss)]),
        set?.title,
        ...Object.values(set?.content?.subtitle ?? {}),
        ...Object.values(topic?.title ?? {}),
        ...p.tags.flatMap((tag) => TAG_LOCALES.map((l) => copyFor(l).common.tag[tag])),
      ),
    });
  }
  for (const p of BANK_PHRASES) {
    if (p.targetLang !== targetLang) continue;
    const theme = BANK_THEMES.find((t) => t.id === p.theme);
    out.push({
      suggestion: {
        key: `bank:${p.id}`,
        source: 'bank',
        target: p.target,
        native: p.translations[nativeLang] ?? Object.values(p.translations)[0] ?? '',
        image: p.image,
        bankId: p.id,
      },
      primary: wordsOf(p.target, ...Object.values(p.translations)),
      theme: wordsOf(...(theme?.keywords ?? []), ...Object.values(theme?.title ?? {})),
      secondary: [],
    });
  }
  return out;
}

/** The share of the best score a suggestion needs: a topic keeps to its subject; keywords and texts range wider. */
const KEEP_SHARE: Record<SuggestMode, number> = { topic: 0.5, keywords: 0.25, text: 0.25 };

/** Course phrases first, then the learner's own, then the bank: the same phrase is offered once, as the one they may already know. */
const SOURCE_RANK = { course: 0, mine: 1, bank: 2, ai: 3 } as const;

export interface LocalOptions {
  /** Phrases not to offer, by sameKey: already in the set being filled, or already seen. */
  exclude?: ReadonlySet<string>;
  limit?: number;
}

/** Ranked suggestions for the request from what is on the device; empty when nothing matches. */
export function suggestLocal(learner: LearnerState, request: SuggestRequest, options: LocalOptions = {}): Suggestion[] {
  const terms = termsOf(request.mode, request.input);
  if (terms.length === 0) return [];
  // One phrase written twice (a bank phrase the learner also wrote) is offered once, as the phrase
  // they have, with the better of the two scores, so adding it never makes a duplicate.
  const byText = new Map<string, { entry: Entry; score: number; order: number }>();
  entries(learner).forEach((entry, order) => {
    let score = 0;
    for (const term of terms) {
      score += Math.max(3 * bestIn(term, entry.primary), 2 * bestIn(term, entry.theme), bestIn(term, entry.secondary));
    }
    const key = sameKey(entry.suggestion.target);
    const twin = byText.get(key);
    if (!twin) byText.set(key, { entry, score, order });
    else if (SOURCE_RANK[entry.suggestion.source] < SOURCE_RANK[twin.entry.suggestion.source]) byText.set(key, { entry, score: Math.max(score, twin.score), order });
    else twin.score = Math.max(score, twin.score);
  });
  const excluded = options.exclude ?? new Set<string>();
  const scored = [...byText].filter(([key, s]) => s.score > 0 && !excluded.has(key)).map(([, s]) => s);
  if (scored.length === 0) return [];
  const top = Math.max(...scored.map((s) => s.score));
  const floor = Math.max(request.mode === 'text' ? 2 : 0, top * KEEP_SHARE[request.mode]);
  return scored
    .filter((s) => s.score >= floor)
    .sort((a, b) => b.score - a.score || SOURCE_RANK[a.entry.suggestion.source] - SOURCE_RANK[b.entry.suggestion.source] || a.order - b.order)
    .slice(0, options.limit ?? DECK_SIZE)
    .map((s) => s.entry.suggestion);
}
