// Phrase clips on iOS and Android (metro.config.js swaps this in for src/shared/audio/speech.ts,
// whose exports it mirrors): the clip the server's voice recorded for a phrase (plans 106, 108),
// played through expo-audio at the learner's speed and measured by its own length. There is no
// device voice: a phrase without a clip fails at once as 'no-clip'. Nothing here waits on a React
// Native timer (its waits are timed natively, `after`) and the audio session stays up between
// clips, so the loop plays on with the screen locked or the app in the background (P3-11). A clip the
// server hasn't made yet is made when first asked about (P3-01): the player waits for it
// (@shared/audio/clipState), saying so through `onRendering`, and plays it when it is ready.
import { createAudioPlayer } from 'expo-audio';
import { awaitClip, clipStateUrl, readClipState, type ClipAnswer, type ClipIo } from '@shared/audio/clipState';
import { after } from '../audio/media';

export type PlaybackResult = { status: 'ended'; ms: number | null } | { status: 'timeout' } | { status: 'failed'; reason: FailureReason };
export type FailureReason = 'no-clip' | 'unmade' | 'silent';

export interface Playback {
  done: Promise<PlaybackResult>;
  cancel: () => void;
}

/** A clip that never loads or never ends gives way after this, or twice its length. */
const CLIP_STALL_MS = 15_000;

/** How long the server may take to say where a clip stands, and a clip then to load. */
const CLIP_CHECK_MS = 8_000;
const CLIP_LOAD_MS = 5_000;

/**
 * Asks the server where a clip stands, and calls `answer` once. expo-audio reports no load error, so
 * a clip that can't be had (offline, a voice the server lacks) is found here, at once, rather than
 * after a silent wait; one not made yet starts being made.
 *
 * A bare XMLHttpRequest, not `fetch`: React Native's `fetch` (whatwg-fetch) settles through
 * `setTimeout(…, 0)`, and on Android React Native's timers stop once the app leaves the screen, so
 * with the phone locked the check never answered and the loop stopped after the clip it was in.
 * The request's own events come straight from the native side.
 */
function askClip(url: string, answer: (a: ClipAnswer) => void): () => void {
  const request = new XMLHttpRequest();
  let answered = false;
  let stopTimer = () => {};
  const settle = (a: ClipAnswer) => {
    if (answered) return;
    answered = true;
    stopTimer();
    answer(a);
  };
  stopTimer = after(CLIP_CHECK_MS, () => {
    settle('unreachable');
    request.abort();
  });
  request.onload = () => settle(readClipState(request.status, request.responseText));
  request.onerror = () => settle('unreachable');
  request.ontimeout = () => settle('unreachable');
  request.onabort = () => settle('unreachable');
  request.open('GET', url);
  request.send();
  return () => {
    answered = true;
    stopTimer();
    request.abort();
  };
}

const nativeIo: ClipIo = { ask: askClip, wait: after };

const asked = new Set<string>();

/** Clips are streamed when played; asking about the next one has the server make it if it hasn't. */
export function preloadClip(url: string): void {
  if (asked.has(url)) return;
  asked.add(url);
  askClip(clipStateUrl(url), () => {});
}

function playClip(url: string, rate: number, onRendering?: (rendering: boolean) => void): Playback {
  let resolve: (r: PlaybackResult) => void = () => {};
  const done = new Promise<PlaybackResult>((r) => (resolve = r));
  let playing: Playback | null = null;
  const stopCheck = awaitClip(
    url,
    nativeIo,
    () => onRendering?.(true),
    (outcome) => {
      if (outcome !== 'ready') return resolve({ status: 'failed', reason: outcome === 'unmade' ? 'unmade' : 'silent' });
      onRendering?.(false);
      playing = startClip(url, rate);
      void playing.done.then(resolve);
    },
  );
  return {
    done,
    cancel: () => {
      stopCheck();
      playing?.cancel();
    },
  };
}

function startClip(url: string, rate: number): Playback {
  let resolve: (r: PlaybackResult) => void = () => {};
  const done = new Promise<PlaybackResult>((r) => (resolve = r));
  // The audio session stays active between clips: by default expo-audio ends it (iOS) once a clip
  // finishes and nothing of its own plays, which also stops the module's silent loop
  // (modules/loro-media), and iOS then suspends the locked app before the next clip.
  const player = createAudioPlayer({ uri: url }, { updateInterval: 100, keepAudioSessionActive: true });
  let settled = false;
  const settle = (r: PlaybackResult) => {
    if (settled) return;
    settled = true;
    watchdog();
    subscription.remove();
    player.remove();
    resolve(r);
  };
  let watchdog = after(CLIP_LOAD_MS, () => settle({ status: 'failed', reason: 'silent' }));
  let started = false;
  const subscription = player.addListener('playbackStatusUpdate', (status) => {
    if (status.isLoaded && !started) {
      started = true;
      watchdog();
      // The speed again once loaded: a rate set before the source is ready may not hold on Android.
      if (rate !== 1) player.setPlaybackRate(rate);
      watchdog = after(status.duration > 0 ? (status.duration * 2000) / rate + 3000 : CLIP_STALL_MS, () => settle({ status: 'timeout' }));
    }
    if (status.didJustFinish) settle({ status: 'ended', ms: (status.duration * 1000) / rate });
  });
  player.setPlaybackRate(rate);
  player.play();
  return {
    done,
    cancel: () => {
      if (settled) return;
      settled = true;
      watchdog();
      subscription.remove();
      player.pause();
      player.remove();
    },
  };
}

/**
 * Plays a phrase's clip at `rate`; without one it fails at once as 'no-clip'. `onRendering(true)` is
 * told when the server is making the clip, and `onRendering(false)` when it is made and plays.
 */
export function speak(clipUrl: string | null | undefined, rate: number, onRendering?: (rendering: boolean) => void): Playback {
  if (clipUrl) return playClip(clipUrl, rate, onRendering);
  return { done: Promise.resolve({ status: 'failed', reason: 'no-clip' }), cancel: () => {} };
}

export function silence(ms: number): Playback {
  let resolve: (r: PlaybackResult) => void = () => {};
  const done = new Promise<PlaybackResult>((r) => (resolve = r));
  const cancel = after(ms, () => resolve({ status: 'ended', ms }));
  return { done, cancel };
}
