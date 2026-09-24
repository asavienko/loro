// Per-phrase memory model: a forgetting curve plus the points rules.
//
// Forgetting curve: the FSRS power form R(t) = (1 + F·t/S)^C with C = -0.5 and
// F = 19/81, chosen so that R(S) = 0.9 — a phrase's stability S is the number
// of days after which recall probability has fallen to 90%. That is also when
// it becomes due again.
import { DAY, MINUTE } from './clock';

export type Grade = 'hard' | 'easy';

export interface PhraseMemory {
  firstHeardAt: number;
  lastHeardAt: number;
  /** Completed repetitions (native → pause → target). */
  heardCount: number;
  hardCount: number;
  easyCount: number;
  /** Days until recall falls to TARGET_RETENTION. null until first graded. */
  stabilityDays: number | null;
  lastReviewedAt: number | null;
  /** First time the phrase reached learned; the learned bonus is paid once. */
  learnedAt: number | null;
  /** Measured duration of the target audio at 1.0x, used to size the pause. */
  targetMsAt1x: number | null;
}

export const TARGET_RETENTION = 0.9;
export const LEARNED_STABILITY_DAYS = 21;

const DECAY = -0.5;
const FACTOR = 19 / 81;
const FIRST_EASY_DAYS = 4;
const HARD_MIN_DAYS = (10 * MINUTE) / DAY;
/** Easy growth per unit of forgetting: ×2.3 when rated at 90% recall, ×1 when rated at 100%. */
const EASY_GAIN = 13;
const EASY_MAX_GROWTH = 5;

/** Points: 1 per repetition listened, more for an active rating, a bonus when learned. */
export const POINTS = {
  repetition: 1,
  hard: 2,
  easy: 3,
  learned: 10,
} as const;

export function newMemory(now: number): PhraseMemory {
  return {
    firstHeardAt: now,
    lastHeardAt: now,
    heardCount: 0,
    hardCount: 0,
    easyCount: 0,
    stabilityDays: null,
    lastReviewedAt: null,
    learnedAt: null,
    targetMsAt1x: null,
  };
}

/** Probability of recall right now, 0..1; null if the phrase was never graded. */
export function retrievability(memory: PhraseMemory, now: number): number | null {
  if (memory.stabilityDays === null || memory.lastReviewedAt === null) return null;
  const elapsedDays = Math.max(0, now - memory.lastReviewedAt) / DAY;
  return Math.pow(1 + (FACTOR * elapsedDays) / memory.stabilityDays, DECAY);
}

export function dueAt(memory: PhraseMemory): number | null {
  if (memory.stabilityDays === null || memory.lastReviewedAt === null) return null;
  return memory.lastReviewedAt + memory.stabilityDays * DAY;
}

export function isDue(memory: PhraseMemory, now: number): boolean {
  const due = dueAt(memory);
  return due !== null && due <= now;
}

/** Learned while stability is at least LEARNED_STABILITY_DAYS; a lapse (Hard) un-learns it. */
export function isLearned(memory: PhraseMemory): boolean {
  return memory.stabilityDays !== null && memory.stabilityDays >= LEARNED_STABILITY_DAYS;
}

/**
 * Next stability after a grade. Easy grows the interval in proportion to how
 * much had been forgotten (spacing effect), as FSRS does: rated on time at 90%
 * recall it grows ×2.3, rated again seconds later it barely moves. Hard
 * shrinks it and brings the phrase back within minutes while it is still being
 * learned.
 */
export function nextStabilityDays(memory: PhraseMemory, grade: Grade, now: number): number {
  const r = retrievability(memory, now);
  if (memory.stabilityDays === null || r === null) {
    return grade === 'easy' ? FIRST_EASY_DAYS : HARD_MIN_DAYS;
  }
  if (grade === 'easy') {
    const growth = Math.min(EASY_MAX_GROWTH, 1 + EASY_GAIN * (1 - r));
    return Math.max(FIRST_EASY_DAYS, memory.stabilityDays * growth);
  }
  return Math.max(HARD_MIN_DAYS, memory.stabilityDays * 0.25);
}

/** Interval in ms the learner will get for `grade` — shown on the rating buttons. */
export function previewInterval(memory: PhraseMemory | undefined, grade: Grade, now: number): number {
  return nextStabilityDays(memory ?? newMemory(now), grade, now) * DAY;
}

export interface GradeResult {
  memory: PhraseMemory;
  /** Points for the rating itself. */
  points: number;
  /** POINTS.learned the first time the phrase is learned, otherwise 0. */
  bonus: number;
  becameLearned: boolean;
}

export function applyGrade(memory: PhraseMemory, grade: Grade, now: number): GradeResult {
  const stabilityDays = nextStabilityDays(memory, grade, now);
  const becameLearned = memory.learnedAt === null && stabilityDays >= LEARNED_STABILITY_DAYS;
  return {
    memory: {
      ...memory,
      stabilityDays,
      lastReviewedAt: now,
      hardCount: memory.hardCount + (grade === 'hard' ? 1 : 0),
      easyCount: memory.easyCount + (grade === 'easy' ? 1 : 0),
      learnedAt: becameLearned ? now : memory.learnedAt,
    },
    points: POINTS[grade],
    bonus: becameLearned ? POINTS.learned : 0,
    becameLearned,
  };
}
