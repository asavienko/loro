// The scheduler is Loro's canonical FSRS-6 in packages/core-rs, called through
// the synchronous browser WASM build (`core_call`). The prototype keeps no
// scheduling maths of its own: memory updates, difficulty and due dates are the
// same numbers the production app computes.
//
// Only `retrievability` is mirrored here, for display: core-rs exports no bridge
// method for it, so this is the same FSRS-6 power curve with the same weight
// (w20) and 8-decimal rounding as `scheduler.rs::retrievability`.
import { core_call } from '../../../../../packages/core-rs/browser/loro_core.js';

/** What the learner says about their own recall. */
export type Grade = 'missed' | 'hard' | 'easy';

/**
 * Missed → FSRS Again, Hard → Hard, Easy → Good. The learner's "Easy" means
 * "I said it", which is FSRS Good; FSRS Easy ("instantly, effortlessly") would
 * multiply the first interval by more than three and is not offered.
 */
const FSRS_GRADE: Record<Grade, 1 | 2 | 3> = { missed: 1, hard: 2, easy: 3 };

export type CardState = 'new' | 'learning' | 'review' | 'relearning';

/** core-rs `FsrsState`, exactly as it crosses the JSON boundary. */
export interface FsrsState {
  /** Days until recall falls to 90%. */
  stability: number;
  /** Intrinsic difficulty, 1..10. */
  difficulty: number;
  /** Next review, epoch ms. */
  due: number;
  last_review: number | null;
  lapses: number;
  state: CardState;
  algorithm: string;
}

function call<T>(method: string, input: unknown): T {
  return JSON.parse(core_call(method, JSON.stringify(input))) as T;
}

/** A card with no review evidence; adding a phrase is not a recall observation. */
export function initialize(at: number): FsrsState {
  return call<FsrsState>('fsrs_initialize', { declared: 'med', tags: [], at });
}

export function review(state: FsrsState, grade: Grade, at: number): FsrsState {
  return call<FsrsState>('fsrs_review', { state, grade: FSRS_GRADE[grade], at });
}

const W20 = 0.1542;
const round8 = (x: number) => Math.round(x * 1e8) / 1e8;
const FACTOR = round8(Math.exp(Math.log(0.9) / -W20) - 1);
const DAY_MS = 86_400_000;

/** Recall probability now, 0..1, on the FSRS-6 power curve; null before the first review. */
export function retrievability(state: FsrsState | null, now: number): number | null {
  if (!state || state.last_review === null || state.stability <= 0) return null;
  const days = Math.max(0, now - state.last_review) / DAY_MS;
  return round8(Math.pow(1 + (FACTOR * days) / state.stability, -W20));
}

/**
 * Loro's authored review threshold: a phrase is due when predicted recall
 * falls to 50% (core-rs `DESIRED_RETENTION`). Stability is still defined at 90%.
 */
export const DESIRED_RETENTION = 0.5;
