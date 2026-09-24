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
  /** Could not be played (no voice for the language, synthesis error, blocked). */
  | { status: 'failed' };

export interface Playback {
  done: Promise<PlaybackResult>;
  cancel: () => void;
}

function deferred(): [Promise<PlaybackResult>, (r: PlaybackResult) => void] {
  let resolve: (r: PlaybackResult) => void = () => {};
  const promise = new Promise<PlaybackResult>((r) => (resolve = r));
  return [promise, resolve];
}

function pickVoice(lang: LanguageCode): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  const base = lang.split('-')[0];
  return voices.find((v) => v.lang === lang) ?? voices.find((v) => v.lang.replace('_', '-').startsWith(base)) ?? null;
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
  audio.onerror = () => settle({ status: 'failed' });
  audio.play().catch(() => settle({ status: 'failed' }));
  return {
    done,
    cancel: () => {
      settled = true;
      audio.pause();
    },
  };
}

export function speak(text: string, lang: LanguageCode, rate: number, clipUrl?: string | null): Playback {
  if (clipUrl) return playClip(clipUrl, rate);
  const [done, finish] = deferred();
  const synth = typeof window === 'undefined' ? undefined : window.speechSynthesis;
  // Voices load asynchronously; an empty list means "not known yet", not "none".
  const voices = synth?.getVoices() ?? [];
  if (!synth || (voices.length > 0 && !pickVoice(lang))) {
    finish({ status: 'failed' });
    return { done, cancel: () => {} };
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = rate;
  utterance.voice = pickVoice(lang);

  let settled = false;
  let startedAt: number | null = null;
  // Some engines never fire `end`; don't let the lesson stall.
  const watchdog = setTimeout(() => settle({ status: 'timeout' }), estimateSpeechMs(text, rate) * 3 + 2000);
  function settle(result: PlaybackResult) {
    if (settled) return;
    settled = true;
    clearTimeout(watchdog);
    finish(result);
  }
  utterance.onstart = () => {
    startedAt = clock.now();
  };
  utterance.onend = () =>
    // Some engines skip the start event: the phrase still played, but there is no clean measurement.
    settle({ status: 'ended', ms: startedAt === null ? null : clock.now() - startedAt });
  utterance.onerror = (event) => {
    // Our own cancel() interrupts; that is not a failure of the audio.
    if (event.error === 'interrupted' || event.error === 'canceled') return;
    settle({ status: 'failed' });
  };

  // Cancelling an idle engine right before speaking can drop the new utterance in Chrome.
  if (synth.speaking || synth.pending) synth.cancel();
  synth.speak(utterance);

  return {
    done,
    cancel: () => {
      if (settled) return;
      settled = true;
      clearTimeout(watchdog);
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
