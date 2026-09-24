// Short Web Audio cues and haptics for ratings. Speech lives in ./speech.ts.

let audioCtx: AudioContext | null = null;

function context(): AudioContext {
  if (!audioCtx) {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new Ctx();
  }
  if (audioCtx.state === 'suspended') void audioCtx.resume();
  return audioCtx;
}

function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Vibration can be unavailable or not permitted.
  }
}

/** Easy: a light tap. */
export function easyCue() {
  vibrate(15);
}

/** Hard: a short falling tone. */
export function hardCue() {
  vibrate([25, 40, 35]);
  try {
    const ctx = context();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const decay = 0.15;
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(240, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(90, ctx.currentTime + decay);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + decay);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + decay);
  } catch {
    // No Web Audio; the haptic is enough.
  }
}

/** A phrase became learned: a rising major chord. Reserved for that moment. */
export function learnedCue() {
  vibrate([15, 30, 25, 30, 40]);
  try {
    const ctx = context();
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + i * 0.06;
      const duration = 0.4;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.18, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration);
    });
  } catch {
    // No Web Audio; the haptic is enough.
  }
}
