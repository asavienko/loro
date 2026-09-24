// Per-phrase memory, derived by replaying the review log in time order. The
// log is the source of truth; memory is a cache that any device can rebuild,
// which is what makes merging two devices safe (see merge.ts).
import type { LanguageCode } from '../content';
import { Grade, initialize, retrievability, review } from '../core/fsrs';
import { DAY, MINUTE } from './clock';
import type { LogEntry, PhraseMemory } from './types';

/** Memory is kept per prompt language and phrase: "en-GB>es-ES:cafe-01". */
export function memoryKey(nativeLang: LanguageCode, targetLang: LanguageCode, phraseId: string): string {
  return `${nativeLang}>${targetLang}:${phraseId}`;
}

export function phraseIdOfKey(key: string): string {
  return key.slice(key.indexOf(':') + 1);
}

/** A rating can be changed or undone for this long; then it counts. */
export const RATING_WINDOW_MS = 5 * MINUTE;
/** Listening to a phrase pays at most once per this interval. */
export const LISTEN_POINTS_INTERVAL_MS = 5 * MINUTE;

export const POINTS = {
  /** A phrase listened to (at most once per phrase per 5 minutes). */
  listened: 1,
  missed: 1,
  hard: 2,
  easy: 3,
  /** Paid once per phrase, the first time it is learned. */
  learned: 10,
} as const;

/** Learned: FSRS review state, recall at 90% lasts 21+ days, and 3+ successful recalls. */
export const LEARNED_STABILITY_DAYS = 21;
export const LEARNED_MIN_SUCCESSES = 3;

/**
 * Introductory cap on the very first successful rating: a phrase heard only
 * once comes back within a day, one heard twice or more within four days, even
 * when FSRS would wait longer.
 */
export const FIRST_REVIEW_CAP_DAYS = { heardOnce: 1, heardTwice: 4 } as const;

const SAMPLE_LIMIT = 7;

export function emptyMemory(): PhraseMemory {
  return {
    fsrs: null,
    heardCount: 0,
    firstHeardAt: null,
    lastHeardAt: null,
    targetSamples: [],
    nativeSamples: [],
    successes: 0,
    lastGrade: null,
    lastGradeAt: null,
    learnedAt: null,
  };
}

export function isLearned(memory: PhraseMemory): boolean {
  return (
    memory.fsrs !== null &&
    memory.fsrs.state === 'review' &&
    memory.fsrs.stability >= LEARNED_STABILITY_DAYS &&
    memory.successes >= LEARNED_MIN_SUCCESSES
  );
}

export function isDue(memory: PhraseMemory, now: number): boolean {
  return memory.fsrs !== null && memory.fsrs.last_review !== null && memory.fsrs.due <= now;
}

export function dueAt(memory: PhraseMemory): number | null {
  return memory.fsrs && memory.fsrs.last_review !== null ? memory.fsrs.due : null;
}

export function recallNow(memory: PhraseMemory, now: number): number | null {
  return retrievability(memory.fsrs, now);
}

/** The FSRS state after `grade`, including the introductory cap. Pure: used for previews too. */
export function reviewed(memory: PhraseMemory, grade: Grade, at: number) {
  const before = memory.fsrs ?? initialize(at);
  const first = before.last_review === null;
  const next = review(before, grade, at);
  if (next.state === 'review') {
    // Prototype policy: due when predicted recall falls to 90%, i.e. after the
    // stability in whole days. The core's 50% date is years out after a few
    // good reviews, which a short listening loop can't use.
    next.due = Math.min(next.due, at + Math.max(1, Math.round(next.stability)) * DAY);
  }
  if (first && grade !== 'missed') {
    const capDays = memory.heardCount >= 2 ? FIRST_REVIEW_CAP_DAYS.heardTwice : FIRST_REVIEW_CAP_DAYS.heardOnce;
    next.due = Math.min(next.due, at + capDays * DAY);
  }
  return next;
}

function pushSample(samples: number[], value: number | null): number[] {
  if (value === null || !(value > 0)) return samples;
  return [...samples, value].slice(-SAMPLE_LIMIT);
}

/**
 * Median of recent measurements. A sample more than twice or under half the
 * median of the others is an outlier (a stalled engine, a cut-off utterance).
 */
export function typicalMs(samples: number[]): number | null {
  if (samples.length === 0) return null;
  const median = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  };
  if (samples.length < 3) return median(samples);
  const m = median(samples);
  const kept = samples.filter((x) => x <= 2 * m && x >= m / 2);
  return median(kept.length > 0 ? kept : samples);
}

export function applyEntry(memory: PhraseMemory, entry: LogEntry): PhraseMemory {
  if (entry.kind === 'heard') {
    return {
      ...memory,
      heardCount: memory.heardCount + 1,
      firstHeardAt: memory.firstHeardAt ?? entry.at,
      lastHeardAt: entry.at,
      targetSamples: pushSample(memory.targetSamples, entry.targetMs),
      nativeSamples: pushSample(memory.nativeSamples, entry.nativeMs),
    };
  }
  if (entry.kind === 'rated') {
    let fsrs;
    try {
      fsrs = reviewed(memory, entry.grade, entry.at);
    } catch {
      // The core refuses impossible input (a time before the last review, out of
      // range). One bad entry is skipped rather than breaking every screen.
      return memory;
    }
    const next: PhraseMemory = {
      ...memory,
      fsrs,
      successes: memory.successes + (entry.grade === 'missed' ? 0 : 1),
      lastGrade: entry.grade,
      lastGradeAt: entry.at,
    };
    return next.learnedAt === null && isLearned(next) ? { ...next, learnedAt: entry.at } : next;
  }
  return memory;
}

/** Log order: by time, then id, so every device replays the same sequence. */
export function compareEntries(a: LogEntry, b: LogEntry): number {
  return a.at - b.at || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

export interface Derived {
  memories: Map<string, PhraseMemory>;
  /** Points each log entry paid, by entry id. */
  awards: Map<string, number>;
  /** Learned bonuses: key → time it was paid. */
  learnedBonuses: Map<string, number>;
  points: number;
}

// Replaying calls into the WASM core for every rating, so results are cached
// per log array and per key: appending a "heard" entry only replays that key.
const cache = new WeakMap<LogEntry[], Derived>();
let lastByKey = new Map<string, { entries: LogEntry[]; memory: PhraseMemory }>();

function sameEntries(a: LogEntry[], b: LogEntry[]): boolean {
  return a.length === b.length && a.every((entry, i) => entry.id === b[i].id);
}

/** Memory, points and per-entry awards, derived from a log sorted by `compareEntries`. */
export function derive(log: LogEntry[]): Derived {
  const cached = cache.get(log);
  if (cached) return cached;

  const byKey = new Map<string, LogEntry[]>();
  for (const entry of log) {
    if (entry.kind === 'carryover') continue;
    const list = byKey.get(entry.key);
    if (list) list.push(entry);
    else byKey.set(entry.key, [entry]);
  }

  const memories = new Map<string, PhraseMemory>();
  const nextByKey = new Map<string, { entries: LogEntry[]; memory: PhraseMemory }>();
  for (const [key, entries] of byKey) {
    const previous = lastByKey.get(key);
    let memory: PhraseMemory;
    if (previous && sameEntries(previous.entries, entries)) {
      memory = previous.memory;
    } else if (previous && sameEntries(previous.entries, entries.slice(0, previous.entries.length))) {
      memory = entries.slice(previous.entries.length).reduce(applyEntry, previous.memory);
    } else {
      memory = entries.reduce(applyEntry, emptyMemory());
    }
    memories.set(key, memory);
    nextByKey.set(key, { entries, memory });
  }
  lastByKey = nextByKey;

  const awards = new Map<string, number>();
  const lastPaid = new Map<string, number>();
  let points = 0;
  for (const entry of log) {
    let award = 0;
    if (entry.kind === 'carryover') {
      award = entry.points;
    } else {
      const slot = `${entry.kind}|${entry.key}`;
      const paidAt = lastPaid.get(slot);
      if (paidAt === undefined || entry.at - paidAt >= LISTEN_POINTS_INTERVAL_MS) {
        award = entry.kind === 'heard' ? POINTS.listened : POINTS[entry.grade];
        lastPaid.set(slot, entry.at);
      }
    }
    if (award !== 0) awards.set(entry.id, award);
    points += award;
  }

  const learnedBonuses = new Map<string, number>();
  for (const [key, memory] of memories) {
    if (memory.learnedAt !== null) {
      learnedBonuses.set(key, memory.learnedAt);
      points += POINTS.learned;
    }
  }

  const result: Derived = { memories, awards, learnedBonuses, points };
  cache.set(log, result);
  return result;
}

/** Inserts an entry keeping the log sorted; the log is never rewritten otherwise. */
export function insertEntry(log: LogEntry[], entry: LogEntry): LogEntry[] {
  let i = log.length;
  while (i > 0 && compareEntries(log[i - 1], entry) > 0) i--;
  return [...log.slice(0, i), entry, ...log.slice(i)];
}
