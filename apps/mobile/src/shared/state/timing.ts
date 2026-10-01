// Timing of the loop: the learner's pause, the gaps between steps, the hold
// for a rating. Shared by the audio driver and the duration selectors, so a
// duration shown on screen is the one the player actually plays.
import type { PauseLength } from './types';

/** The learner's turn, per setting: a factor of the phrase's length plus padding, within bounds. */
const PAUSE: Record<PauseLength, { factor: number; paddingMs: number; minMs: number; maxMs: number }> = {
  standard: { factor: 1.3, paddingMs: 600, minMs: 1500, maxMs: 8000 },
  longer: { factor: 2, paddingMs: 1000, minMs: 2500, maxMs: 12000 },
};
/**
 * The learner's echo after hearing the target: shorter than their turn, since the phrase is
 * fresh (about its own length plus a breath), within bounds.
 */
const ECHO: Record<PauseLength, { factor: number; paddingMs: number; minMs: number; maxMs: number }> = {
  standard: { factor: 1, paddingMs: 400, minMs: 1200, maxMs: 6000 },
  longer: { factor: 1.5, paddingMs: 800, minMs: 2000, maxMs: 9000 },
};
/** Rough spoken length, only for the first pause and engine timeouts, never shown. */
const MS_PER_CHAR_AT_1X = 75;

/** Silence after each spoken step, so the steps don't run into each other. */
export const GAP_MS = 300;
/** After the last repetition, hold this long for a rating if the phrase has none yet. */
export const RATE_HOLD_MS = 4000;
/** Queues started from Home's review card hold at most this many phrases. */
export const REVIEW_SESSION_SIZE = 10;

export function estimateSpeechMs(text: string, rate: number): number {
  return (text.length * MS_PER_CHAR_AT_1X) / rate;
}

/** Time to say the phrase yourself: a bit longer than the target takes to say ("longer": about twice). */
export function pauseMs(targetMsAt1x: number | null, text: string, speed: number, length: PauseLength = 'standard'): number {
  const { factor, paddingMs, minMs, maxMs } = PAUSE[length];
  const spoken = (targetMsAt1x ?? estimateSpeechMs(text, 1)) / speed;
  return Math.min(maxMs, Math.max(minMs, spoken * factor + paddingMs));
}

/** Time to say the phrase again right after hearing it: about as long as the target takes to say. */
export function echoMs(targetMsAt1x: number | null, text: string, speed: number, length: PauseLength = 'standard'): number {
  const { factor, paddingMs, minMs, maxMs } = ECHO[length];
  const spoken = (targetMsAt1x ?? estimateSpeechMs(text, 1)) / speed;
  return Math.min(maxMs, Math.max(minMs, spoken * factor + paddingMs));
}

/**
 * The full play of one phrase at 1.0×: every repetition's prompt, gap, pause,
 * target, gap and echo, then the rating hold when `holdsForRating` (the phrase has no
 * rating yet, so the player waits for one). Null until both the prompt and the
 * target have been measured, because an estimate is not a number we show.
 */
export function fullPlayMs(
  nativeMsAt1x: number | null,
  targetMsAt1x: number | null,
  target: string,
  repeats: number,
  length: PauseLength = 'standard',
  holdsForRating = false,
): number | null {
  if (nativeMsAt1x === null || targetMsAt1x === null) return null;
  const one = nativeMsAt1x + GAP_MS + pauseMs(targetMsAt1x, target, 1, length) + targetMsAt1x + GAP_MS + echoMs(targetMsAt1x, target, 1, length);
  return Math.round(one * repeats + (holdsForRating ? RATE_HOLD_MS : 0));
}
