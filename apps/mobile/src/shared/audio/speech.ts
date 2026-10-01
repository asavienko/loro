// Playback of one utterance: the clip the server's voice recorded for it (plans 106, 108). There is
// no device voice: a phrase the server has no clip for can't be played, and says so ('no-clip').
// Clips play at the learner's speed (the browser keeps their pitch) and are measured by their own
// length.

export type PlaybackResult =
  /** Played to the end; `ms` is the real duration of the sound at this speed, or null if unknown. */
  | { status: 'ended'; ms: number | null }
  /** Probably played, but never confirmed its end: nothing is recorded or paid. */
  | { status: 'timeout' }
  /** Could not be played: no clip for it, or the clip didn't load or play. */
  | { status: 'failed'; reason: FailureReason };

export type FailureReason = 'no-clip' | 'silent';

export interface Playback {
  done: Promise<PlaybackResult>;
  cancel: () => void;
}

function deferred(): [Promise<PlaybackResult>, (r: PlaybackResult) => void] {
  let resolve: (r: PlaybackResult) => void = () => {};
  const promise = new Promise<PlaybackResult>((r) => (resolve = r));
  return [promise, resolve];
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

/** A clip that never ends (a stalled network) gives way after this, or twice its length. */
const CLIP_STALL_MS = 15_000;

function playClip(url: string, rate: number): Playback {
  const [done, finish] = deferred();
  if (typeof Audio === 'undefined') {
    finish({ status: 'failed', reason: 'silent' });
    return { done, cancel: () => {} };
  }
  // An element that failed to load keeps failing: load it afresh.
  const cached = clips.get(url);
  const audio = cached && !cached.error ? cached : new Audio(url);
  clips.set(url, audio);
  audio.currentTime = 0;
  audio.playbackRate = rate;
  let settled = false;
  const expected = Number.isFinite(audio.duration) && audio.duration > 0 ? (audio.duration * 2000) / rate + 3000 : CLIP_STALL_MS;
  const watchdog = setTimeout(() => {
    audio.pause();
    settle({ status: 'timeout' });
  }, expected);
  const settle = (r: PlaybackResult) => {
    if (settled) return;
    settled = true;
    clearTimeout(watchdog);
    if (r.status === 'failed') clips.delete(url);
    finish(r);
  };
  audio.onended = () => settle({ status: 'ended', ms: (audio.duration * 1000) / rate });
  audio.onerror = () => settle({ status: 'failed', reason: 'silent' });
  audio.play().catch(() => settle({ status: 'failed', reason: 'silent' }));
  return {
    done,
    cancel: () => {
      settled = true;
      clearTimeout(watchdog);
      audio.pause();
    },
  };
}

/** Plays a phrase's clip at `rate`; without one it fails at once as 'no-clip'. */
export function speak(clipUrl: string | null | undefined, rate: number): Playback {
  if (clipUrl) return playClip(clipUrl, rate);
  const [done, finish] = deferred();
  finish({ status: 'failed', reason: 'no-clip' });
  return { done, cancel: () => {} };
}

export function silence(ms: number): Playback {
  const [done, finish] = deferred();
  const timer = setTimeout(() => finish({ status: 'ended', ms }), ms);
  return { done, cancel: () => clearTimeout(timer) };
}
