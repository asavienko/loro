// Phrase clips on iOS and Android (metro.config.js swaps this in for src/shared/audio/speech.ts,
// whose exports it mirrors): the clip the server's voice recorded for a phrase (plans 106, 108),
// played through expo-audio at the learner's speed and measured by its own length. There is no
// device voice: a phrase without a clip fails at once as 'no-clip'.
import { createAudioPlayer } from 'expo-audio';

export type PlaybackResult = { status: 'ended'; ms: number | null } | { status: 'timeout' } | { status: 'failed'; reason: FailureReason };
export type FailureReason = 'no-clip' | 'silent';

export interface Playback {
  done: Promise<PlaybackResult>;
  cancel: () => void;
}

/** Clips are streamed when played; the server keeps them ready. */
export function preloadClip(_url: string): void {}

/** A clip that never loads or never ends gives way after this, or twice its length. */
const CLIP_STALL_MS = 15_000;

/** How long a clip may take to answer (the server renders one it hasn't yet) and then to load. */
const CLIP_CHECK_MS = 8_000;
const CLIP_LOAD_MS = 5_000;

/**
 * Whether the clip can be fetched. expo-audio reports no load error, so a clip the server can't
 * make (offline, a voice it lacks) is found here, at once, rather than after a silent wait.
 */
async function clipAvailable(url: string, signal: AbortSignal): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD', signal });
    return response.ok;
  } catch {
    return false;
  }
}

function playClip(url: string, rate: number): Playback {
  let resolve: (r: PlaybackResult) => void = () => {};
  const done = new Promise<PlaybackResult>((r) => (resolve = r));
  const check = new AbortController();
  const checkTimer = setTimeout(() => check.abort(), CLIP_CHECK_MS);
  let cancelled = false;
  let playing: Playback | null = null;
  void clipAvailable(url, check.signal).then((ok) => {
    clearTimeout(checkTimer);
    if (cancelled) return;
    if (!ok) return resolve({ status: 'failed', reason: 'silent' });
    playing = startClip(url, rate);
    void playing.done.then(resolve);
  });
  return {
    done,
    cancel: () => {
      cancelled = true;
      clearTimeout(checkTimer);
      check.abort();
      playing?.cancel();
    },
  };
}

function startClip(url: string, rate: number): Playback {
  let resolve: (r: PlaybackResult) => void = () => {};
  const done = new Promise<PlaybackResult>((r) => (resolve = r));
  const player = createAudioPlayer({ uri: url }, { updateInterval: 100 });
  let settled = false;
  const settle = (r: PlaybackResult) => {
    if (settled) return;
    settled = true;
    clearTimeout(watchdog);
    subscription.remove();
    player.remove();
    resolve(r);
  };
  let watchdog = setTimeout(() => settle({ status: 'failed', reason: 'silent' }), CLIP_LOAD_MS);
  let started = false;
  const subscription = player.addListener('playbackStatusUpdate', (status) => {
    if (status.isLoaded && !started) {
      started = true;
      clearTimeout(watchdog);
      // The speed again once loaded: a rate set before the source is ready may not hold on Android.
      if (rate !== 1) player.setPlaybackRate(rate);
      watchdog = setTimeout(() => settle({ status: 'timeout' }), status.duration > 0 ? (status.duration * 2000) / rate + 3000 : CLIP_STALL_MS);
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
      clearTimeout(watchdog);
      subscription.remove();
      player.pause();
      player.remove();
    },
  };
}

/** Plays a phrase's clip at `rate`; without one it fails at once as 'no-clip'. */
export function speak(clipUrl: string | null | undefined, rate: number): Playback {
  if (clipUrl) return playClip(clipUrl, rate);
  return { done: Promise.resolve({ status: 'failed', reason: 'no-clip' }), cancel: () => {} };
}

export function silence(ms: number): Playback {
  let resolve: (r: PlaybackResult) => void = () => {};
  const done = new Promise<PlaybackResult>((r) => (resolve = r));
  const timer = setTimeout(() => resolve({ status: 'ended', ms }), ms);
  return { done, cancel: () => clearTimeout(timer) };
}
