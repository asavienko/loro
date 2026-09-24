// Timing of the loop: the learner's pause, the gaps between steps, the hold
// for a rating. Shared by the audio driver and the duration selectors, so a
// duration shown on screen is the one the player actually plays.

const PAUSE_FACTOR = 1.3;
const PAUSE_PADDING_MS = 600;
const PAUSE_MIN_MS = 1500;
const PAUSE_MAX_MS = 8000;
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

/** Time to say the phrase yourself: a bit longer than the target takes to say. */
export function pauseMs(targetMsAt1x: number | null, text: string, speed: number): number {
  const spoken = (targetMsAt1x ?? estimateSpeechMs(text, 1)) / speed;
  return Math.min(PAUSE_MAX_MS, Math.max(PAUSE_MIN_MS, spoken * PAUSE_FACTOR + PAUSE_PADDING_MS));
}

/**
 * The full play of one phrase at 1.0×: every repetition's prompt, gap, pause,
 * target and gap. Null until both the prompt and the target have been measured,
 * because an estimate is not a number we show.
 */
export function fullPlayMs(nativeMsAt1x: number | null, targetMsAt1x: number | null, target: string, repeats: number): number | null {
  if (nativeMsAt1x === null || targetMsAt1x === null) return null;
  const one = nativeMsAt1x + GAP_MS + pauseMs(targetMsAt1x, target, 1) + targetMsAt1x + GAP_MS;
  return Math.round(one * repeats);
}
