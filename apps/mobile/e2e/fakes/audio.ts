// expo-audio, faked: players that "play" in the test's fake time. A phrase clip, a song and a cue each
// load at once, report their length, and finish after it (scaled by the playback rate), sending the
// same `playbackStatusUpdate`s the native player does. The suite reads what was heard (`audio.heard`)
// and can make a clip never load (`audio.silent`) or change a length (`audio.lengths`).
import { useEffect, useState } from 'react';

export interface Heard {
  uri: string;
  rate: number;
  /** 'clip' (a phrase's, from /library/speech), 'song', or 'cue'. */
  kind: 'clip' | 'song' | 'cue';
}

/** Default lengths, in ms. */
export const CLIP_MS = 1200;
export const SONG_MS = 30_000;
export const CUE_MS = 300;

export const audio = {
  /** Every start of a sound, in order. */
  heard: [] as Heard[],
  /** A URI containing one of these never loads (the native player reports nothing). */
  silent: new Set<string>(),
  /** A URI containing a key here lasts that many ms. */
  lengths: new Map<string, number>(),
  /** The players alive now. */
  players: new Set<FakePlayer>(),
  /** What setAudioModeAsync was last given. */
  mode: null as unknown,
  reset() {
    this.heard = [];
    this.silent.clear();
    this.lengths.clear();
    this.players.clear();
    this.mode = null;
  },
  /** The phrase clips heard, as "<lang>-<phraseId>" (from /library/speech/<lang>-<id>.mp3). */
  clips(): string[] {
    return this.heard.filter((h) => h.kind === 'clip').map((h) => /speech\/([^.?]+)/.exec(h.uri)?.[1] ?? h.uri);
  },
  /** The song player (the one useAudioPlayer made), if any. */
  songPlayer(): FakePlayer | undefined {
    return [...this.players].find((p) => p.hook);
  },
};

type Source = string | number | { uri?: string } | null | undefined;

const uriOf = (source: Source): string | null => {
  if (source === null || source === undefined) return null;
  if (typeof source === 'string') return source;
  if (typeof source === 'number') return `asset:${source}`;
  return source.uri ?? null;
};

const kindOf = (uri: string): Heard['kind'] => (uri.includes('/library/speech/') ? 'clip' : uri.startsWith('asset:') || !/^https?:/.test(uri) ? 'cue' : 'song');

function lengthOf(uri: string): number {
  for (const [key, ms] of audio.lengths) if (uri.includes(key)) return ms;
  const kind = kindOf(uri);
  return kind === 'clip' ? CLIP_MS : kind === 'song' ? SONG_MS : CUE_MS;
}

export interface Status {
  id: string;
  isLoaded: boolean;
  playing: boolean;
  didJustFinish: boolean;
  currentTime: number;
  duration: number;
  isBuffering: boolean;
  playbackRate: number;
}

let playerIds = 0;

export class FakePlayer {
  readonly id = `player-${++playerIds}`;
  volume = 1;
  playbackRate = 1;
  uri: string | null;
  /** Made by useAudioPlayer (the song player). */
  hook = false;
  private listeners = new Set<(status: Status) => void>();
  private loaded = false;
  private positionMs = 0;
  private startedAt = 0;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private released = false;
  playing = false;
  private updateInterval: number;

  constructor(source: Source, options: { updateInterval?: number } = {}) {
    this.uri = uriOf(source);
    this.updateInterval = options.updateInterval ?? 500;
    audio.players.add(this);
  }

  get duration(): number {
    return this.loaded && this.uri ? lengthOf(this.uri) / 1000 : 0;
  }
  get currentTime(): number {
    return this.position() / 1000;
  }
  get isLoaded(): boolean {
    return this.loaded;
  }
  get isBuffering(): boolean {
    return false;
  }

  private position(): number {
    if (!this.playing) return this.positionMs;
    return Math.min(this.positionMs + (Date.now() - this.startedAt) * this.playbackRate, this.uri ? lengthOf(this.uri) : 0);
  }

  status(didJustFinish = false): Status {
    return {
      id: this.id,
      isLoaded: this.loaded,
      playing: this.playing,
      didJustFinish,
      currentTime: this.currentTime,
      duration: this.duration,
      isBuffering: false,
      playbackRate: this.playbackRate,
    };
  }

  private emit(didJustFinish = false) {
    const status = this.status(didJustFinish);
    for (const listener of [...this.listeners]) listener(status);
  }

  private clearTimers() {
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
  }

  private schedule() {
    this.clearTimers();
    if (!this.playing || !this.uri) return;
    const uri = this.uri;
    const left = (lengthOf(uri) - this.positionMs) / this.playbackRate;
    this.timers.push(
      setTimeout(() => {
        if (!this.playing || this.uri !== uri) return;
        this.positionMs = lengthOf(uri);
        this.playing = false;
        this.clearTimers();
        this.emit(true);
      }, Math.max(0, left)),
    );
    // Position updates while it plays, as the native player sends them.
    const tick = () => {
      if (!this.playing || this.uri !== uri) return;
      this.emit();
      this.timers.push(setTimeout(tick, this.updateInterval));
    };
    this.timers.push(setTimeout(tick, this.updateInterval));
  }

  play() {
    if (this.released || !this.uri || this.playing) return;
    const uri = this.uri;
    if ([...audio.silent].some((s) => uri.includes(s))) return;
    audio.heard.push({ uri, rate: this.playbackRate, kind: kindOf(uri) });
    if (this.positionMs >= lengthOf(uri)) this.positionMs = 0;
    this.loaded = true;
    this.playing = true;
    this.startedAt = Date.now();
    // Loaded and playing on the next turn, as the native player reports it.
    this.timers.push(setTimeout(() => this.playing && this.emit(), 0));
    this.schedule();
  }

  pause() {
    if (!this.playing) return;
    this.positionMs = this.position();
    this.playing = false;
    this.clearTimers();
    this.emit();
  }

  replace(source: Source) {
    this.clearTimers();
    this.playing = false;
    this.positionMs = 0;
    this.loaded = false;
    this.uri = uriOf(source);
  }

  async seekTo(seconds: number) {
    this.positionMs = Math.max(0, seconds * 1000);
    if (this.playing) {
      this.startedAt = Date.now();
      this.schedule();
    }
    this.emit();
  }

  setPlaybackRate(rate: number) {
    if (this.playing) {
      this.positionMs = this.position();
      this.startedAt = Date.now();
    }
    this.playbackRate = rate;
    this.schedule();
  }

  addListener(event: string, listener: (status: Status) => void) {
    if (event !== 'playbackStatusUpdate') return { remove: () => {} };
    this.listeners.add(listener);
    return { remove: () => this.listeners.delete(listener) };
  }

  remove() {
    audio.players.delete(this);
  }

  release() {
    this.released = true;
    this.playing = false;
    this.clearTimers();
    this.listeners.clear();
    audio.players.delete(this);
  }
}

export function createAudioPlayer(source: Source = null, options?: { updateInterval?: number }): FakePlayer {
  return new FakePlayer(source, options);
}

export function useAudioPlayer(source: Source = null, options?: { updateInterval?: number }): FakePlayer {
  // One player for the component's life, as expo-audio's hook keeps.
  const [player] = useState(() => {
    const made = new FakePlayer(source, options);
    made.hook = true;
    return made;
  });
  useEffect(() => () => player.release(), [player]);
  return player;
}

export function useAudioPlayerStatus(player: FakePlayer): Status {
  const [status, setStatus] = useState(() => player.status());
  useEffect(() => {
    const sub = player.addListener('playbackStatusUpdate', setStatus);
    return () => sub.remove();
  }, [player]);
  return status;
}

export async function setAudioModeAsync(mode: unknown): Promise<void> {
  audio.mode = mode;
}

export async function setIsAudioActiveAsync(): Promise<void> {}

export type AudioPlayer = FakePlayer;
export type AudioStatus = Status;
