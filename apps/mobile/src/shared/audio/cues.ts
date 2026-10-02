// The player's cues in a browser: the bundled cue sounds (sounds.ts) through Web Audio, and haptics
// where the browser has them. Every cue is soft: nothing here sounds like an error or a punishment.
// A sound still decoding when its moment comes plays as a soft sine tone instead, once.
import { Asset } from 'expo-asset';
import { CUE_VOLUME, SOUNDS, type SoundName } from './sounds';

let audioCtx: AudioContext | null = null;

function create(): AudioContext | null {
  try {
    if (!audioCtx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtx = new Ctx();
      loadSounds(audioCtx);
    }
    return audioCtx;
  } catch {
    return null;
  }
}

function context(): AudioContext | null {
  const ctx = create();
  if (ctx?.state === 'suspended') void ctx.resume().catch(() => undefined);
  return ctx;
}

const buffers: Partial<Record<SoundName, AudioBuffer>> = {};

function loadSounds(ctx: AudioContext) {
  for (const name of Object.keys(SOUNDS) as SoundName[]) {
    void fetch(Asset.fromModule(SOUNDS[name]).uri)
      .then((response) => response.arrayBuffer())
      .then((bytes) => ctx.decodeAudioData(bytes))
      .then((buffer) => (buffers[name] = buffer))
      .catch(() => undefined);
  }
}

/**
 * Starting the audio device takes ~100 ms, so the (suspended) context is
 * created while the app is idle after load; no gesture is needed for that.
 */
export function prepareAudio(): void {
  create();
}

/** Called from the first user gesture (unlock.ts): resuming is cheap, and allowed there. */
export function resumeAudio(): void {
  context();
}

function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Vibration can be unavailable or not permitted.
  }
}

/** Plays a cue sound; false if it isn't decoded yet. */
function sound(name: SoundName): boolean {
  const ctx = context();
  const buffer = buffers[name];
  if (!ctx || !buffer) return false;
  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  source.buffer = buffer;
  gain.gain.value = CUE_VOLUME;
  source.connect(gain);
  gain.connect(ctx.destination);
  source.start();
  return true;
}

/** A gentle sine tone with a soft attack and release: the stand-in while a sound decodes. */
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

/** "Your turn": a warm two-note rise, so the learner knows to speak without looking. */
export function turnCue() {
  if (sound('turn')) return;
  tone(660, 0, 0.12);
  tone(880, 0.1, 0.16);
}

/** The rating hold begins: one soft wooden tick, so the silence that follows isn't a mystery. */
export function holdCue() {
  if (!sound('hold')) tone(587.33, 0, 0.14, 0.05);
}

/** Easy: a rounded pop and a light tap. */
export function easyCue() {
  vibrate(15);
  sound('easy');
}

/** Hard or Missed: one soft felt note — information, not a buzzer. */
export function gentleCue() {
  vibrate(20);
  if (!sound('gentle')) tone(523.25, 0, 0.18, 0.06);
}

/** A phrase became learned: a rising arpeggio of soft bells. Reserved for that moment. */
export function learnedCue() {
  vibrate([15, 30, 25, 30, 40]);
  if (sound('learned')) return;
  [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => tone(freq, i * 0.06, 0.4, 0.12));
}

/** The queue was played through: a short warm jingle. Nothing, if it hasn't decoded. */
export function passCue() {
  sound('pass');
}
