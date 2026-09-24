// Prototype speech: the browser's speech synthesis. The production app plays
// recorded reference audio instead; this module is the seam to replace.
import { LanguageCode } from '../content';
import { clock } from '../state/clock';

export type PlaybackResult =
  /** Played to the end; `ms` is the real duration. */
  | { status: 'ended'; ms: number }
  /** Probably played, but the engine never reported the end, so there is no measurement. */
  | { status: 'timeout' }
  /** Could not be played (no voice for the language, synthesis error, blocked). */
  | { status: 'failed' };

export interface Playback {
  done: Promise<PlaybackResult>;
  cancel: () => void;
}

const MS_PER_CHAR_AT_1X = 75;

/** Rough spoken length; used only for timeouts and the first pause, never shown. */
export function estimateSpeechMs(text: string, rate: number): number {
  return (text.length * MS_PER_CHAR_AT_1X) / rate;
}

function pickVoice(lang: LanguageCode): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  const base = lang.split('-')[0];
  return voices.find((v) => v.lang === lang) ?? voices.find((v) => v.lang.startsWith(base)) ?? null;
}

/** The device voice used for `lang`, if any — shown instead of an invented speaker credit. */
export function voiceName(lang: LanguageCode): string | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  return pickVoice(lang)?.name ?? null;
}

export function speak(text: string, lang: LanguageCode, rate: number): Playback {
  let cancelled = false;
  let finish: (result: PlaybackResult) => void = () => {};
  const done = new Promise<PlaybackResult>((resolve) => {
    finish = resolve;
  });

  const synth = typeof window === 'undefined' ? undefined : window.speechSynthesis;
  // Voices load asynchronously; an empty list means "not known yet", not "none".
  const voices = synth?.getVoices() ?? [];
  if (!synth || (voices.length > 0 && !pickVoice(lang))) {
    finish({ status: 'failed' });
    return { done, cancel: () => {} };
  }

  const startedAt = clock.now();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = rate;
  utterance.voice = pickVoice(lang);

  // Some engines never fire `end`; don't let the lesson stall.
  const watchdog = setTimeout(() => settle({ status: 'timeout' }), estimateSpeechMs(text, rate) * 3 + 2000);
  function settle(result: PlaybackResult) {
    if (cancelled) return;
    cancelled = true;
    clearTimeout(watchdog);
    finish(result);
  }
  utterance.onend = () => settle({ status: 'ended', ms: clock.now() - startedAt });
  utterance.onerror = (event) => {
    // Our own cancel() interrupts; that is not a failure of the audio.
    if (event.error === 'interrupted' || event.error === 'canceled') return;
    settle({ status: 'failed' });
  };

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);

  return {
    done,
    cancel: () => {
      if (cancelled) return;
      cancelled = true;
      clearTimeout(watchdog);
      window.speechSynthesis.cancel();
    },
  };
}

/** Stops any speech in progress, e.g. when the app unmounts. */
export function stopSpeech(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
}

export function silence(ms: number): Playback {
  let finish: (result: PlaybackResult) => void = () => {};
  const done = new Promise<PlaybackResult>((resolve) => {
    finish = resolve;
  });
  const timer = setTimeout(() => finish({ status: 'ended', ms }), ms);
  return { done, cancel: () => clearTimeout(timer) };
}
