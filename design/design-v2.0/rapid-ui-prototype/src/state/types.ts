// The whole app state is plain JSON: it can be copied, saved, merged and synced.
import type { LanguageCode } from '../content';
import type { FsrsState, Grade } from '../core/fsrs';

export type { Grade } from '../core/fsrs';

export const STATE_VERSION = 3;

// ---------- learner: synced between devices ----------

export interface Profile {
  name: string;
  nativeLang: LanguageCode;
  targetLang: LanguageCode;
  /** Onboarding finished (languages chosen, voice checked, loop explained). */
  onboarded: boolean;
  updatedAt: number;
}

/**
 * One fact in the append-only review log. Memory and points are derived from
 * the log, so two devices merge by taking the union of their entries.
 */
export type LogEntry =
  | {
      id: string;
      at: number;
      device: string;
      kind: 'heard';
      key: string;
      phraseId: string;
      setId: string | null;
      /** Measured target and prompt audio at 1.0×, excluding engine start-up; null if not measured. */
      targetMs: number | null;
      nativeMs: number | null;
    }
  | {
      id: string;
      at: number;
      device: string;
      kind: 'rated';
      key: string;
      phraseId: string;
      setId: string | null;
      grade: Grade;
    }
  | {
      id: string;
      at: number;
      device: string;
      /** Points earned before the log existed (state v2), carried over once. */
      kind: 'carryover';
      points: number;
    };

export type LogKind = LogEntry['kind'];

/** A like with its time, so a like on one device and an unlike on another merge by last write. */
export interface Like {
  liked: boolean;
  at: number;
}

export interface OwnPhrase {
  id: string;
  targetLang: LanguageCode;
  nativeLang: LanguageCode;
  target: string;
  native: string;
  createdAt: number;
  updatedAt: number;
  deleted: boolean;
}

export interface OwnSet {
  id: string;
  title: string;
  targetLang: LanguageCode;
  phraseIds: string[];
  createdAt: number;
  updatedAt: number;
  deleted: boolean;
}

export interface LearnerState {
  profile: Profile;
  log: LogEntry[];
  /** Keyed "phrase:<id>" or "set:<id>". */
  likes: Record<string, Like>;
  ownPhrases: Record<string, OwnPhrase>;
  ownSets: Record<string, OwnSet>;
}

// ---------- device: never synced ----------

export interface Device {
  /** This installation; "this device" in history and summaries. */
  id: string;
  /** This app instance (tab, launch): two tabs of one device never mint the same id. */
  instance: string;
  /** Counter for ids made by this instance. */
  seq: number;
}

/**
 * A rating waits five minutes before it counts, so the learner can change or
 * undo it. It then becomes a `rated` log entry with its original time.
 */
export interface PendingRating {
  key: string;
  phraseId: string;
  setId: string | null;
  grade: Grade;
  at: number;
}

export type PlayMode = 'repeat' | 'continue';
export type RepeatsSetting = 'auto' | 1 | 3;
export type Speed = 0.8 | 1 | 1.25;
export type SortKey = 'set' | 'az' | 'due' | 'weakest';

export interface Prefs {
  /** At the end of the queue: play it again, or continue with the next phrases of the course. */
  playMode: PlayMode;
  repeats: RepeatsSetting;
  speed: Speed;
  /** Screen reader: announce every step, or only "your turn" and the reveal. */
  announceEveryStep: boolean;
  sortBySet: Record<string, SortKey>;
  /** Onboarding's "Start without the demo": Home stops offering it. */
  skippedDemo: boolean;
  /** The learner's own choice of device voice per language, by name; otherwise the best is picked. */
  voiceByLang: Partial<Record<LanguageCode, string>>;
}

// ---------- player ----------

export interface AudioFailure {
  lang: LanguageCode;
  /** No voice for the language, or the speech engine stayed silent. */
  reason: 'no-voice' | 'silent';
}

export type Phase = 'native' | 'pause' | 'target' | 'rate';
export type PlayerStatus = 'idle' | 'playing' | 'paused';

export interface Session {
  id: string;
  startedAt: number;
  /** Times the whole queue was played through in repeat mode. */
  passes: number;
}

export interface PlayerState {
  status: PlayerStatus;
  phase: Phase;
  /** 1-based repetition of the current phrase. */
  repetition: number;
  /** Repetitions for the current phrase, from the setting (auto picks 3 or 1). */
  repeats: 1 | 3;
  shuffle: boolean;
  /** Set the queue was started from; null for mixed queues such as reviews. */
  setId: string | null;
  /** Queue order as loaded, used to undo shuffle. */
  baseOrder: string[];
  order: string[];
  index: number;
  /** Bumped whenever a phase (re)starts, so stale completions are ignored. */
  cycle: number;
  playingSince: number | null;
  /** Real listening time on the current phrase, excluding the running stretch. */
  elapsedMs: number;
  /** Measured prompt length in the current repetition, attached to its "heard" entry. */
  nativeMsThisRep: number | null;
  /** The queue finished; Play starts the last phrase again. */
  ended: boolean;
  /** Speech that failed, and why; playback stops until the learner presses Play. */
  audioError: AudioFailure | null;
  session: Session | null;
}

export interface AppState {
  version: typeof STATE_VERSION;
  /** Content version the state was last saved against. */
  contentVersion: string;
  device: Device;
  learner: LearnerState;
  pending: PendingRating[];
  prefs: Prefs;
  player: PlayerState;
}

/** Per-phrase memory, derived from the log (see memory.ts). */
export interface PhraseMemory {
  fsrs: FsrsState | null;
  heardCount: number;
  firstHeardAt: number | null;
  lastHeardAt: number | null;
  /** Recent measurements at 1.0×, newest last. */
  targetSamples: number[];
  nativeSamples: number[];
  /** Hard or Easy ratings (recalled at all). */
  successes: number;
  lastGrade: Grade | null;
  lastGradeAt: number | null;
  learnedAt: number | null;
}
