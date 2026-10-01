// The one player's place on the lock screen and in the notification shade (P3-11), through the
// LoroMedia module (modules/loro-media): what is playing goes out as text, and each press there comes
// back as a command. On the web, and in a build without the module, it does nothing.
import { requireOptionalNativeModule } from 'expo-modules-core';
import type { Grade } from '@shared/state/types';

/** One grade as the lock screen shows it: its name, and what it says once given. */
export interface NowPlayingGrade {
  grade: Grade;
  label: string;
  /** The grade given ("Rated Easy — back in 3 days"): the selected button's spoken label. */
  detail: string;
  selected: boolean;
}

/** What the lock screen and the notification show, and what they offer. Text only, never audio. */
export interface NowPlaying {
  /** The phrase's or song's id: a rating pressed there names it, so it never lands on the next item. */
  id: string;
  title: string;
  artist: string;
  album: string;
  /** A raster cover the system can draw; the drawn (SVG) covers have none. */
  artworkUrl: string | null;
  playing: boolean;
  canNext: boolean;
  canPrevious: boolean;
  /** A song's place and length, for its seek bar; a phrase has neither. */
  positionMs: number | null;
  durationMs: number | null;
  /** Missed, Hard and Easy, or null where nothing can be rated. */
  grades: NowPlayingGrade[] | null;
  nextLabel: string;
  /** The Android notification channel's name, in the learner's language. */
  channelName: string;
  /** The phrase loop has silences between its clips (the learner's turn); a song has none. */
  hasSilences: boolean;
}

export type MediaCommand =
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'next' }
  | { type: 'previous' }
  | { type: 'seek'; positionMs: number }
  | { type: 'rate'; grade: Grade; id: string };

interface NativeMedia {
  show(nowPlaying: NowPlaying): void;
  hide(): void;
  wait(ms: number): Promise<void>;
  addListener(event: 'onCommand', listener: (command: MediaCommand) => void): { remove(): void };
}

const native = requireOptionalNativeModule<NativeMedia>('LoroMedia');

/** Whether this build has the lock-screen controls: then the player plays on in the background. */
export const backgroundPlayback = native !== null;

export function showNowPlaying(nowPlaying: NowPlaying): void {
  native?.show(nowPlaying);
}

export function hideNowPlaying(): void {
  native?.hide();
}

export function onMediaCommand(listener: (command: MediaCommand) => void): () => void {
  const subscription = native?.addListener('onCommand', listener);
  return () => subscription?.remove();
}

/**
 * Runs `run` after `ms`, also while the app is in the background: React Native's timers stop on
 * Android once the app leaves the screen, and the phrase loop's silences must keep time with the
 * screen locked. Returns a cancel.
 */
export function after(ms: number, run: () => void): () => void {
  if (!native) {
    const timer = setTimeout(run, ms);
    return () => clearTimeout(timer);
  }
  let live = true;
  void native.wait(ms).then(() => {
    if (live) run();
  });
  return () => {
    live = false;
  };
}
