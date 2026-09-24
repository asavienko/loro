// Short Web Audio cues and haptics. Every cue is soft: nothing here sounds
// like an error or a punishment.
let audioCtx: AudioContext | null = null;

function context(): AudioContext | null {
  try {
    if (!audioCtx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtx = new Ctx();
    }
    if (audioCtx.state === 'suspended') void audioCtx.resume();
    return audioCtx;
  } catch {
    return null;
  }
}

function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Vibration can be unavailable or not permitted.
  }
}

/** A gentle sine tone with a soft attack and release. */
function tone(freq: number, start: number, duration: number, gain = 0.08) {
  const ctx = context();
  if (!ctx) return;
  const t = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, t);
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain, t + 0.02);
  env.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(env);
  env.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

/** "Your turn": two quick rising notes, so the learner knows to speak without looking. */
export function turnCue() {
  tone(660, 0, 0.12);
  tone(880, 0.1, 0.16);
}

/** Easy: a light tap. */
export function easyCue() {
  vibrate(15);
}

/** Hard or Missed: one soft, neutral note — information, not a buzzer. */
export function gentleCue() {
  vibrate(20);
  tone(523.25, 0, 0.18, 0.06);
}

/** A phrase became learned: a rising major chord. Reserved for that moment. */
export function learnedCue() {
  vibrate([15, 30, 25, 30, 40]);
  [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => tone(freq, i * 0.06, 0.4, 0.12));
}
