// Playback of one utterance. A recorded clip plays when the content has one
// (the backend will provide them); otherwise the browser's speech synthesis
// stands in. Speech is measured from `start` to `end`, so the engine's
// start-up delay never inflates the phrase's length.
import type { LanguageCode } from '../content';
import { clock } from '../state/clock';
import { estimateSpeechMs } from '../state/timing';

export type PlaybackResult =
  /** Played to the end; `ms` is the real duration of the sound, or null if the engine gave no start time. */
  | { status: 'ended'; ms: number | null }
  /** Probably played, but the engine never confirmed the end: nothing is recorded or paid. */
  | { status: 'timeout' }
  /** Could not be played: no voice for the language, or the engine stayed silent. */
  | { status: 'failed'; reason: FailureReason };

export type FailureReason = 'no-voice' | 'silent';

export interface Playback {
  done: Promise<PlaybackResult>;
  cancel: () => void;
}

function deferred(): [Promise<PlaybackResult>, (r: PlaybackResult) => void] {
  let resolve: (r: PlaybackResult) => void = () => {};
  const promise = new Promise<PlaybackResult>((r) => (resolve = r));
  return [promise, resolve];
}

type VoiceInfo = Pick<SpeechSynthesisVoice, 'name' | 'lang' | 'localService' | 'default'>;

/**
 * The best device voice for `lang`, or null when none speaks the language.
 * Android reports "es_ES", so tags are normalised. The region matters most (Spain's
 * Spanish over Mexico's), then a higher-quality voice (Premium, Enhanced, Natural,
 * Neural), then one that works offline, then the system's default.
 */
export function bestVoice<V extends VoiceInfo>(voices: readonly V[], lang: string): V | null {
  const want = lang.toLowerCase();
  const base = want.split('-')[0];
  let best: V | null = null;
  let bestScore = -1;
  for (const v of voices) {
    const tag = v.lang.replace('_', '-').toLowerCase();
    if (tag !== want && tag.split('-')[0] !== base) continue;
    const score =
      (tag === want ? 8 : 0) +
      (/premium|enhanced|natural|neural/i.test(v.name) ? 4 : 0) +
      (v.localService ? 2 : 0) +
      (v.default ? 1 : 0);
    if (score > bestScore) {
      best = v;
      bestScore = score;
    }
  }
  return best;
}

/** The learner's choices from Settings (prefs.voiceByLang), kept in step by the shell. */
let chosen: Partial<Record<string, string>> = {};
export function setVoiceChoices(choices: Partial<Record<string, string>>): void {
  chosen = choices;
}

/** Every device voice that speaks `lang` (any region), best first. */
export function voicesFor(lang: LanguageCode): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
  const all = window.speechSynthesis.getVoices();
  const out: SpeechSynthesisVoice[] = [];
  let rest = [...all];
  for (let v = bestVoice(rest, lang); v; v = bestVoice(rest, lang)) {
    out.push(v);
    rest = rest.filter((x) => x !== v);
  }
  return out;
}

function pickVoice(lang: LanguageCode): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  const base = lang.split('-')[0];
  // A chosen voice counts only while it is installed and still speaks the language.
  const mine = chosen[lang] ? voices.find((v) => v.name === chosen[lang] && v.lang.replace('_', '-').split('-')[0] === base) : undefined;
  return mine ?? bestVoice(voices, lang);
}

/** The device voice used for `lang`, if any. */
export function voiceName(lang: LanguageCode): string | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  return pickVoice(lang)?.name ?? null;
}

/** Waits for the voice list (it loads asynchronously), up to `timeoutMs`. */
export function waitForVoices(timeoutMs = 1500): Promise<void> {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return Promise.resolve();
  if (window.speechSynthesis.getVoices().length > 0) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      window.speechSynthesis.removeEventListener('voiceschanged', done);
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(done, timeoutMs);
    window.speechSynthesis.addEventListener('voiceschanged', done);
  });
}

const clips = new Map<string, HTMLAudioElement>();

/** Starts downloading a clip so it plays without a gap when its turn comes. */
export function preloadClip(url: string): void {
  if (clips.has(url) || typeof Audio === 'undefined') return;
  const audio = new Audio();
  audio.preload = 'auto';
  audio.src = url;
  clips.set(url, audio);
}

function playClip(url: string, rate: number): Playback {
  const [done, finish] = deferred();
  const audio = clips.get(url) ?? new Audio(url);
  clips.set(url, audio);
  audio.currentTime = 0;
  audio.playbackRate = rate;
  let settled = false;
  const settle = (r: PlaybackResult) => {
    if (settled) return;
    settled = true;
    finish(r);
  };
  audio.onended = () => settle({ status: 'ended', ms: (audio.duration * 1000) / rate });
  audio.onerror = () => settle({ status: 'failed', reason: 'silent' });
  audio.play().catch(() => settle({ status: 'failed', reason: 'silent' }));
  return {
    done,
    cancel: () => {
      settled = true;
      audio.pause();
    },
  };
}

/**
 * An `end` without a `start` that arrives this fast (relative to the text's
 * likely length) means the engine said nothing — a stalled or backgrounded
 * speech service ends utterances instantly.
 */
const SILENT_END_SHARE = 0.4;
const RETRY_DELAY_MS = 150;

export function speak(text: string, lang: LanguageCode, rate: number, clipUrl?: string | null): Playback {
  if (clipUrl) return playClip(clipUrl, rate);
  const [done, finish] = deferred();
  const synth = typeof window === 'undefined' ? undefined : window.speechSynthesis;
  // Voices load asynchronously; an empty list means "not known yet", not "none".
  const voices = synth?.getVoices() ?? [];
  if (!synth || (voices.length > 0 && !pickVoice(lang))) {
    finish({ status: 'failed', reason: 'no-voice' });
    return { done, cancel: () => {} };
  }

  let settled = false;
  let current: SpeechSynthesisUtterance | null = null;
  let retry: ReturnType<typeof setTimeout> | undefined;
  const expectedMs = estimateSpeechMs(text, rate);
  // Some engines never fire `end`; don't let the lesson stall.
  const watchdog = setTimeout(() => settle({ status: 'timeout' }), expectedMs * 3 + 2000);
  function settle(result: PlaybackResult) {
    if (settled) return;
    settled = true;
    clearTimeout(watchdog);
    clearTimeout(retry);
    finish(result);
  }

  const attempt = (tries: number) => {
    const utterance = new SpeechSynthesisUtterance(text);
    current = utterance;
    utterance.lang = lang;
    utterance.rate = rate;
    utterance.voice = pickVoice(lang);
    const calledAt = clock.now();
    let startedAt: number | null = null;
    utterance.onstart = () => {
      startedAt = clock.now();
    };
    utterance.onend = () => {
      if (current !== utterance) return;
      if (startedAt !== null) return settle({ status: 'ended', ms: clock.now() - startedAt });
      // No start event. Long enough to have been spoken: it played, unmeasured.
      if (clock.now() - calledAt >= expectedMs * SILENT_END_SHARE) return settle({ status: 'ended', ms: null });
      // Instant: nothing was said. Nudge the engine and try once more, then give up honestly.
      if (tries > 0) return settle({ status: 'failed', reason: 'silent' });
      synth.cancel();
      synth.resume();
      retry = setTimeout(() => attempt(tries + 1), RETRY_DELAY_MS);
    };
    utterance.onerror = (event) => {
      // Our own cancel() interrupts; that is not a failure of the audio.
      if (event.error === 'interrupted' || event.error === 'canceled') return;
      settle({ status: 'failed', reason: event.error === 'language-unavailable' || event.error === 'voice-unavailable' ? 'no-voice' : 'silent' });
    };
    // Cancelling an idle engine right before speaking can drop the new utterance in Chrome.
    if (synth.speaking || synth.pending) synth.cancel();
    synth.speak(utterance);
  };
  attempt(0);

  return {
    done,
    cancel: () => {
      if (settled) return;
      settled = true;
      clearTimeout(watchdog);
      clearTimeout(retry);
      synth.cancel();
    },
  };
}

/** Stops any speech in progress, e.g. when the app unmounts. */
export function stopSpeech(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
  for (const audio of clips.values()) audio.pause();
}

export function silence(ms: number): Playback {
  const [done, finish] = deferred();
  const timer = setTimeout(() => finish({ status: 'ended', ms }), ms);
  return { done, cancel: () => clearTimeout(timer) };
}
