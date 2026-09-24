// The app state machine. `transition(state, event)` is pure: no clock, no
// randomness, no I/O — events carry `now` and `seed`. The whole AppState is
// plain JSON, so it can be copied, persisted and sent to a server as is.
//
// Player loop for one phrase, repeated `repeats` times:
//   native (hear it in your language) → pause (say it yourself) → target (hear it)
// Then the queue advances. A Hard/Easy rating may be given once per play of a
// phrase; starting the phrase again offers it again.
import { applyGrade, Grade, newMemory, PhraseMemory, POINTS } from './memory';

export type Phase = 'native' | 'pause' | 'target';
export type PlayerStatus = 'idle' | 'playing' | 'paused';
export type Speed = 0.8 | 1 | 1.25;
export type Repeats = 1 | 3;

export const SPEEDS: Speed[] = [0.8, 1, 1.25];
export const PHASES: Phase[] = ['native', 'pause', 'target'];
/** Pressing Previous later than this restarts the phrase instead. */
export const RESTART_THRESHOLD_MS = 3000;
const HISTORY_LIMIT = 500;

export type HistoryEvent = 'heard' | Grade | 'learned';

export interface HistoryEntry {
  at: number;
  phraseId: string;
  setId: string | null;
  event: HistoryEvent;
  points: number;
}

export interface LearnerState {
  points: number;
  phrases: Record<string, PhraseMemory>;
  savedPhraseIds: string[];
  likedSetIds: string[];
  history: HistoryEntry[];
}

export interface PlayerState {
  status: PlayerStatus;
  phase: Phase;
  /** 1-based repetition of the current phrase. */
  repetition: number;
  repeats: Repeats;
  speed: Speed;
  shuffle: boolean;
  /** Set the queue was started from; null for mixed queues such as reviews. */
  setId: string | null;
  /** Queue order as loaded, used to undo shuffle. */
  baseOrder: string[];
  order: string[];
  index: number;
  ratedCurrent: Grade | null;
  /** Bumped whenever a phase (re)starts, so stale completions are ignored. */
  cycle: number;
  playingSince: number | null;
  /** Real listening time on the current phrase, excluding the running stretch. */
  elapsedMs: number;
  /** The queue finished on the current phrase; Play starts it again from the top. */
  ended: boolean;
  /** Language whose speech failed; playback stops until the learner presses Play. */
  audioError: string | null;
}

export const STATE_VERSION = 2;

export interface AppState {
  version: typeof STATE_VERSION;
  learner: LearnerState;
  player: PlayerState;
}

export type AppEvent =
  | { type: 'LOAD'; phraseIds: string[]; setId: string | null; startIndex?: number; now: number; seed: number }
  | { type: 'PLAY'; now: number }
  | { type: 'PAUSE'; now: number }
  | {
      type: 'PHASE_DONE';
      cycle: number;
      now: number;
      /** Real duration of the target audio at 1.0x; only for a clean end. */
      measuredMsAt1x?: number;
      /** Language code whose audio could not be played. */
      failedLang?: string;
    }
  | { type: 'NEXT'; now: number }
  | { type: 'PREV'; now: number }
  | { type: 'JUMP'; index: number; now: number }
  | { type: 'RATE'; grade: Grade; now: number }
  | { type: 'SET_SPEED'; speed: Speed }
  | { type: 'TOGGLE_REPEAT' }
  | { type: 'TOGGLE_SHUFFLE'; seed: number }
  | { type: 'REORDER_UP_NEXT'; phraseIds: string[] }
  | { type: 'REMOVE_FROM_QUEUE'; position: number }
  | { type: 'ENQUEUE'; phraseIds: string[]; setId: string | null }
  | { type: 'TOGGLE_SAVE_PHRASE'; phraseId: string }
  | { type: 'TOGGLE_LIKE_SET'; setId: string }
  | { type: 'RESTORE'; state: AppState }
  | { type: 'RESET' };

export function initialState(): AppState {
  return {
    version: STATE_VERSION,
    learner: {
      points: 0,
      phrases: {},
      savedPhraseIds: [],
      likedSetIds: [],
      history: [],
    },
    player: {
      status: 'idle',
      phase: 'native',
      repetition: 1,
      repeats: 3,
      speed: 1,
      shuffle: false,
      setId: null,
      baseOrder: [],
      order: [],
      index: 0,
      ratedCurrent: null,
      cycle: 0,
      playingSince: null,
      elapsedMs: 0,
      ended: false,
      audioError: null,
    },
  };
}

export function currentPhraseId(player: PlayerState): string | null {
  return player.order[player.index] ?? null;
}

// ---------- helpers ----------

/** Deterministic Fisher–Yates (mulberry32), so shuffles replay identically. */
export function shuffled<T>(items: T[], seed: number): T[] {
  const out = [...items];
  let a = seed >>> 0;
  const random = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const toggle = (ids: string[], id: string) =>
  ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];

function stopClock(player: PlayerState, now: number): PlayerState {
  if (player.playingSince === null) return player;
  return { ...player, elapsedMs: player.elapsedMs + (now - player.playingSince), playingSince: null };
}

/** Start `index` from its first phase, keeping play/pause status. */
function enterPhrase(player: PlayerState, index: number, now: number): PlayerState {
  const playing = player.status === 'playing';
  return {
    ...player,
    index,
    phase: 'native',
    repetition: 1,
    ratedCurrent: null,
    elapsedMs: 0,
    playingSince: playing ? now : null,
    cycle: player.cycle + 1,
    ended: false,
  };
}

function withHistory(learner: LearnerState, entry: HistoryEntry): LearnerState {
  const history = [...learner.history, entry];
  return {
    ...learner,
    points: learner.points + entry.points,
    history: history.length > HISTORY_LIMIT ? history.slice(-HISTORY_LIMIT) : history,
  };
}

function memoryOf(learner: LearnerState, phraseId: string, now: number): PhraseMemory {
  return learner.phrases[phraseId] ?? newMemory(now);
}

function recordRepetition(state: AppState, phraseId: string, now: number, measuredMsAt1x?: number): LearnerState {
  const memory = memoryOf(state.learner, phraseId, now);
  const learner: LearnerState = {
    ...state.learner,
    phrases: {
      ...state.learner.phrases,
      [phraseId]: {
        ...memory,
        heardCount: memory.heardCount + 1,
        lastHeardAt: now,
        targetMsAt1x: measuredMsAt1x ?? memory.targetMsAt1x,
      },
    },
  };
  return withHistory(learner, {
    at: now,
    phraseId,
    setId: state.player.setId,
    event: 'heard',
    points: POINTS.repetition,
  });
}

// ---------- the machine ----------

export function transition(state: AppState, event: AppEvent): AppState {
  const { player, learner } = state;
  const currentId = currentPhraseId(player);

  switch (event.type) {
    case 'LOAD': {
      if (event.phraseIds.length === 0) return state;
      const start = Math.min(Math.max(0, event.startIndex ?? 0), event.phraseIds.length - 1);
      const first = event.phraseIds[start];
      const rest = event.phraseIds.filter((_, i) => i !== start);
      const order = player.shuffle ? [first, ...shuffled(rest, event.seed)] : event.phraseIds;
      return {
        ...state,
        player: {
          ...player,
          status: 'playing',
          setId: event.setId,
          baseOrder: event.phraseIds,
          order,
          index: player.shuffle ? 0 : start,
          phase: 'native',
          repetition: 1,
          ratedCurrent: null,
          elapsedMs: 0,
          playingSince: event.now,
          cycle: player.cycle + 1,
          ended: false,
          audioError: null,
        },
      };
    }

    case 'PLAY': {
      if (player.status === 'playing' || currentId === null) return state;
      const resumed: PlayerState = { ...player, status: 'playing', audioError: null };
      // A finished queue replays its last phrase from the top, as a new play.
      if (player.ended) return { ...state, player: enterPhrase(resumed, player.index, event.now) };
      // Speech cannot resume mid-utterance, so the current phase restarts.
      return {
        ...state,
        player: { ...resumed, playingSince: event.now, cycle: player.cycle + 1 },
      };
    }

    case 'PAUSE': {
      if (player.status !== 'playing') return state;
      return {
        ...state,
        player: { ...stopClock(player, event.now), status: 'paused', cycle: player.cycle + 1 },
      };
    }

    case 'PHASE_DONE': {
      if (player.status !== 'playing' || event.cycle !== player.cycle || currentId === null) return state;
      if (event.failedLang) {
        // No silent loop and no points without audio: stop and say why.
        return {
          ...state,
          player: {
            ...stopClock(player, event.now),
            status: 'paused',
            audioError: event.failedLang,
            cycle: player.cycle + 1,
          },
        };
      }
      if (player.phase === 'native') {
        return { ...state, player: { ...player, phase: 'pause', cycle: player.cycle + 1 } };
      }
      if (player.phase === 'pause') {
        return { ...state, player: { ...player, phase: 'target', cycle: player.cycle + 1 } };
      }
      // Target finished: one repetition completed.
      const nextLearner = recordRepetition(state, currentId, event.now, event.measuredMsAt1x);
      if (player.repetition < player.repeats) {
        return {
          ...state,
          learner: nextLearner,
          player: { ...player, phase: 'native', repetition: player.repetition + 1, cycle: player.cycle + 1 },
        };
      }
      if (player.index < player.order.length - 1) {
        return { ...state, learner: nextLearner, player: enterPhrase(player, player.index + 1, event.now) };
      }
      // End of the queue: stop on the last phrase, ready to replay it.
      const stopped = stopClock(player, event.now);
      return {
        ...state,
        learner: nextLearner,
        player: { ...stopped, status: 'paused', phase: 'native', repetition: 1, cycle: player.cycle + 1, ended: true },
      };
    }

    case 'NEXT': {
      if (player.index >= player.order.length - 1) return state;
      return { ...state, player: enterPhrase(player, player.index + 1, event.now) };
    }

    case 'PREV': {
      if (currentId === null) return state;
      const running = player.playingSince === null ? 0 : event.now - player.playingSince;
      const listened = player.elapsedMs + running;
      const index = listened > RESTART_THRESHOLD_MS || player.index === 0 ? player.index : player.index - 1;
      return { ...state, player: enterPhrase(player, index, event.now) };
    }

    case 'JUMP': {
      if (event.index < 0 || event.index >= player.order.length) return state;
      const jumped = enterPhrase({ ...player, status: 'playing' }, event.index, event.now);
      return { ...state, player: jumped };
    }

    case 'RATE': {
      if (currentId === null || player.ratedCurrent !== null) return state;
      const result = applyGrade(memoryOf(learner, currentId, event.now), event.grade, event.now);
      let nextLearner: LearnerState = {
        ...learner,
        phrases: { ...learner.phrases, [currentId]: result.memory },
      };
      nextLearner = withHistory(nextLearner, {
        at: event.now,
        phraseId: currentId,
        setId: player.setId,
        event: event.grade,
        points: result.points,
      });
      if (result.becameLearned) {
        nextLearner = withHistory(nextLearner, {
          at: event.now,
          phraseId: currentId,
          setId: player.setId,
          event: 'learned',
          points: result.bonus,
        });
      }
      return { ...state, learner: nextLearner, player: { ...player, ratedCurrent: event.grade } };
    }

    case 'SET_SPEED':
      return { ...state, player: { ...player, speed: event.speed } };

    case 'TOGGLE_REPEAT': {
      const repeats: Repeats = player.repeats === 3 ? 1 : 3;
      return {
        ...state,
        player: { ...player, repeats, repetition: Math.min(player.repetition, repeats) },
      };
    }

    case 'TOGGLE_SHUFFLE': {
      const played = player.order.slice(0, player.index + 1);
      const upNext = player.order.slice(player.index + 1);
      const reordered = player.shuffle
        ? player.baseOrder.filter((id) => upNext.includes(id))
        : shuffled(upNext, event.seed);
      return {
        ...state,
        player: { ...player, shuffle: !player.shuffle, order: [...played, ...reordered] },
      };
    }

    case 'REORDER_UP_NEXT': {
      const upNext = player.order.slice(player.index + 1);
      const sorted = (ids: string[]) => [...ids].sort().join('\n');
      if (sorted(event.phraseIds) !== sorted(upNext)) return state;
      return {
        ...state,
        player: { ...player, order: [...player.order.slice(0, player.index + 1), ...event.phraseIds] },
      };
    }

    case 'REMOVE_FROM_QUEUE': {
      const at = event.position;
      if (at < 0 || at >= player.order.length || at === player.index) return state;
      return {
        ...state,
        player: {
          ...player,
          order: player.order.filter((_, i) => i !== at),
          index: at < player.index ? player.index - 1 : player.index,
        },
      };
    }

    case 'ENQUEUE': {
      const upNext = player.order.slice(player.index + 1);
      const added = event.phraseIds.filter((id) => id !== currentId && !upNext.includes(id));
      if (added.length === 0) return state;
      return {
        ...state,
        player: {
          ...player,
          order: [...player.order, ...added],
          baseOrder: [...player.baseOrder, ...added.filter((id) => !player.baseOrder.includes(id))],
          // A queue that mixes sets no longer plays "from" one set.
          setId: player.order.length === 0 || player.setId === event.setId ? event.setId : null,
        },
      };
    }

    case 'TOGGLE_SAVE_PHRASE':
      return { ...state, learner: { ...learner, savedPhraseIds: toggle(learner.savedPhraseIds, event.phraseId) } };

    case 'TOGGLE_LIKE_SET':
      return { ...state, learner: { ...learner, likedSetIds: toggle(learner.likedSetIds, event.setId) } };

    case 'RESTORE':
      return restored(event.state);

    case 'RESET':
      return initialState();
  }
}

/** A saved state never resumes mid-playback: audio needs a fresh user gesture. */
export function restored(state: AppState): AppState {
  const player = state.player;
  return {
    ...state,
    player: {
      ...player,
      status: player.order.length > 0 ? 'paused' : 'idle',
      playingSince: null,
      phase: 'native',
      repetition: 1,
      audioError: null,
    },
  };
}
