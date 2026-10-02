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
      day?: LocalDay;
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
      day?: LocalDay;
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

/**
 * A local calendar day, "2026-09-24". A heard or rated entry is stamped with the learner's day
 * as it is written, and calendar rules (the first-review cap) read that, so every device replays
 * one log to the same schedule whatever its own time zone, and so does this one after travel.
 * Entries from before the stamp have none: their day is worked out where they are replayed.
 */
export type LocalDay = string;

/** What can be liked: a phrase, a set, or a song (plan 107). A like's key is `kind:id`. */
export type LikeKind = 'phrase' | 'set' | 'song';

/** A like with its time, so a like on one device and an unlike on another merge by last write. */
export interface Like {
  liked: boolean;
  at: number;
}

/**
 * Where an own phrase's text came from when the learner didn't write it: Loro's phrase bank, or
 * AI, which no native speaker has checked. It stays through the learner's own corrections.
 */
export type PhraseOrigin = 'bank' | 'ai';

/** A note written for one of the learner's own phrases, in their language (plan 105). */
export interface OwnNote {
  title: string;
  text: string;
}

/** All three notes of one of the learner's own phrases, as AI wrote them for it. */
export interface OwnNotes {
  mnemonic: OwnNote;
  grammar: OwnNote;
  pronunciation: OwnNote & { ipa: string; respelling: string };
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
  origin?: PhraseOrigin;
  /** The same phrase in Loro's phrase bank: its notes and picture are read from there. */
  bankId?: string;
  /** Notes AI wrote for this text, in the learner's language; dropped when the text changes. */
  notes?: OwnNotes;
  /** The picture AI chose for it: Material Symbols from the registry. */
  image?: string[];
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
  /** When it was given: its window and its log entry's time. */
  at: number;
  /** Its last change (grade or undo), which wins a merge between tabs. */
  changedAt: number;
  /** Undone inside its window: kept until the window closes so the undo reaches other tabs. */
  undone?: boolean;
  /**
   * Given by rating this song in the player (plan 107): its undo and its "N phrases reviewed" are the
   * song's alone. A rating the phrase loop gives the phrase afterwards makes it the loop's.
   */
  songId?: string;
  /** The local day it was given, which its log entry keeps. */
  day?: LocalDay;
}

export type PlayMode = 'repeat' | 'continue';
export type RepeatsSetting = 'auto' | 1 | 3;
export type Speed = 0.8 | 1 | 1.25;
export type SortKey = 'set' | 'az' | 'due' | 'weakest';
/** The learner's turn: the standard pause, or a longer one (about twice the phrase). */
export type PauseLength = 'standard' | 'longer';

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
  /** How long "your turn" lasts (Settings → Listening). */
  pauseLength: PauseLength;
  /** The queue's swipe-and-drag hint has done its job (a swipe or drag worked): it folds away. */
  queueHintDone: boolean;
  /** When each setting last changed, so tabs of this browser keep the newest value of each. */
  changedAt: Partial<Record<Exclude<keyof Prefs, 'changedAt'>, number>>;
}

// ---------- player ----------

export interface AudioFailure {
  lang: LanguageCode;
  /** No clip from the server for it, the server couldn’t make it (P3-01), or it didn’t load or play. */
  reason: 'no-clip' | 'unmade' | 'silent';
}

/** The steps of one repetition: prompt, the learner's turn, target, the learner's echo; then a rating hold. */
export type Phase = 'native' | 'pause' | 'target' | 'echo' | 'rate';
export type PlayerStatus = 'idle' | 'playing' | 'paused';

/** Library lists a queue can come from (the phrase views of the Library tab). */
export type LibraryListView = 'liked' | 'mine' | 'due' | 'learning' | 'missed' | 'learned';

/**
 * Where an unnamed queue came from, for its title, and whether it has a natural end:
 * a review, the first-run demo and a Library list play once and stop on an end panel.
 */
export type QueueSource = { kind: 'review' } | { kind: 'demo' } | { kind: 'library'; view: LibraryListView };

export interface Session {
  id: string;
  startedAt: number;
  /** Times the whole queue was played through in repeat mode. */
  passes: number;
  /** Phrase keys heard in this session, so its summary keeps them after they leave the queue. */
  heard?: string[];
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
  /** When the running phase started playing; null while paused or idle. */
  phaseStartedAt: number | null;
  /**
   * How long the running phase lasts when that is known in advance: the learner's turn and
   * the rating hold, fixed when the phase starts. The audio driver plays exactly this.
   */
  phaseMs: number | null;
  /** Where an unnamed queue came from (see QueueSource); null for a set or a queue built by hand. */
  source: QueueSource | null;
  /** The queue finished; Play starts the last phrase again. */
  ended: boolean;
  /**
   * This play of the current phrase has reached its target, so the learner has heard it. A queue
   * that ends shows the target only then: Next on its last phrase ends it before it is heard.
   */
  targetHeard: boolean;
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
  /** The local day of `firstHeardAt`, as the learner lived it. */
  firstHeardDay: LocalDay | null;
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
