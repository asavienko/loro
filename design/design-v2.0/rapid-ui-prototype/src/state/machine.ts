// The app state machine. `transition(state, event)` is pure: no clock, no
// randomness, no I/O — events carry `now` and `seed`, and ids come from the
// device counter in state. The whole AppState is plain JSON.
//
// Player loop for one phrase, repeated `repeats` times:
//   native (hear it in your language) → pause (say it yourself) → target (hear it)
// then a short hold for a rating if there is none, then the next phrase. At the
// end of the queue the play mode decides: play it again, or continue with the
// next phrases of the course. The allowed events per status are in chart.ts.
import { findPhrase, keyOf, OWN_PHRASE_PREFIX, OWN_SET_PREFIX } from './catalog';
import { canHandle } from './chart';
import { initialPlayer, initialState } from './initial';
import { insertEntry, RATING_WINDOW_MS } from './memory';
import { mergeLearner } from './merge';
import { sanitizeState } from './persistence';
import { continuation, currentPhraseId, repeatsFor } from './selectors';
import type {
  AppState,
  AudioFailure,
  Grade,
  LearnerState,
  LogEntry,
  PlayerState,
  Prefs,
  Profile,
  RepeatsSetting,
  Speed,
} from './types';

export type { AppState } from './types';

export const SPEEDS: Speed[] = [0.8, 1, 1.25];
export const REPEAT_SETTINGS: RepeatsSetting[] = ['auto', 1, 3];
/** Pressing Previous later than this restarts the phrase instead. */
export const RESTART_THRESHOLD_MS = 3000;
/** A missed phrase comes back this many phrases later in the same queue. */
export const RELEARN_GAP = 4;

export type AppEvent =
  | { type: 'LOAD'; phraseIds: string[]; setId: string | null; startIndex?: number; shuffle?: boolean; now: number; seed: number }
  | { type: 'PLAY'; now: number }
  | { type: 'PAUSE'; now: number }
  | {
      type: 'PHASE_DONE';
      cycle: number;
      now: number;
      /** Measured length at 1.0× of what was just spoken, excluding engine start-up. */
      measuredMs?: number;
      /** Speech that could not be played, and why. */
      failure?: AudioFailure;
      /** The engine never confirmed the end: move on, but record nothing and pay nothing. */
      unconfirmed?: boolean;
    }
  | { type: 'NEXT'; now: number }
  | { type: 'PREV'; now: number }
  | { type: 'JUMP'; index: number; now: number; play?: boolean }
  | { type: 'RATE'; grade: Grade; now: number }
  | { type: 'UNRATE'; now: number }
  | { type: 'COMMIT'; now: number }
  | { type: 'SET_PREFS'; prefs: Partial<Prefs> }
  | { type: 'TOGGLE_SHUFFLE'; seed: number }
  | { type: 'REORDER_UP_NEXT'; phraseIds: string[] }
  | { type: 'REMOVE_FROM_QUEUE'; position: number }
  | { type: 'INSERT_IN_QUEUE'; position: number; phraseId: string }
  | { type: 'ENQUEUE'; phraseIds: string[]; setId: string | null; at: 'next' | 'end'; now: number }
  | { type: 'CLEAR_QUEUE' }
  /** Undo of Clear queue: the cleared phrases, right after whatever is playing by then. */
  | { type: 'RESTORE_UP_NEXT'; phraseIds: string[] }
  | { type: 'TOGGLE_LIKE'; kind: 'phrase' | 'set'; id: string; now: number }
  | { type: 'ADD_OWN_PHRASE'; target: string; native: string; now: number }
  | { type: 'EDIT_OWN_PHRASE'; id: string; target: string; native: string; now: number }
  | { type: 'DELETE_OWN_PHRASE'; id: string; now: number }
  | { type: 'RESTORE_OWN_PHRASE'; id: string; now: number }
  | { type: 'CREATE_SET'; title: string; phraseIds: string[]; now: number }
  /** `at` inserts at that position (undoing a removal); otherwise at the end. */
  | { type: 'ADD_TO_SET'; setId: string; phraseIds: string[]; at?: number; now: number }
  | { type: 'REMOVE_FROM_SET'; setId: string; phraseId: string; now: number }
  | { type: 'MOVE_IN_SET'; setId: string; phraseId: string; delta: -1 | 1; now: number }
  | { type: 'RENAME_SET'; setId: string; title: string; now: number }
  | { type: 'DELETE_SET'; setId: string; now: number }
  | { type: 'RESTORE_SET'; setId: string; now: number }
  | { type: 'SET_PROFILE'; profile: Partial<Omit<Profile, 'updatedAt'>>; now: number }
  | { type: 'RESTORE'; state: unknown }
  | { type: 'MERGE_REMOTE'; learner: LearnerState; now: number }
  | { type: 'RESET' };

export type AppEventType = AppEvent['type'];

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

/** A new id from the instance counter: "<device>.<instance>-<n>". */
function takeId(state: AppState): [string, AppState] {
  const seq = state.device.seq + 1;
  const { id, instance } = state.device;
  return [`${id}.${instance}-${seq.toString(36)}`, { ...state, device: { ...state.device, seq } }];
}

function stopClock(player: PlayerState, now: number): PlayerState {
  if (player.playingSince === null) return player;
  return { ...player, elapsedMs: player.elapsedMs + (now - player.playingSince), playingSince: null };
}

/** Start `index` from its first phase, keeping play/pause status. */
function enterPhrase(state: AppState, player: PlayerState, index: number, now: number): PlayerState {
  const playing = player.status === 'playing';
  const id = player.order[index];
  return {
    ...player,
    index,
    phase: 'native',
    repetition: 1,
    repeats: id ? repeatsFor({ ...state, player }, id) : player.repeats,
    elapsedMs: 0,
    nativeMsThisRep: null,
    playingSince: playing ? now : null,
    cycle: player.cycle + 1,
    ended: false,
  };
}

function withPlayer(state: AppState, player: PlayerState): AppState {
  return { ...state, player };
}

/** Past the last phrase: the play mode decides what happens. */
function pastTheEnd(state: AppState, player: PlayerState, now: number, fromLastPhase: boolean): AppState {
  if (state.prefs.playMode === 'repeat' && player.order.length > 0) {
    const session = player.session ? { ...player.session, passes: player.session.passes + 1 } : null;
    return withPlayer(state, enterPhrase(state, { ...player, session }, 0, now));
  }
  const next = continuation(state.learner, player, now);
  if (next) {
    const order = [...player.order, ...next.phraseIds];
    const extended: PlayerState = {
      ...player,
      order,
      baseOrder: [...player.baseOrder, ...next.phraseIds],
      setId: next.setId,
    };
    return withPlayer(state, enterPhrase(state, extended, player.index + 1, now));
  }
  if (!fromLastPhase) return state;
  // Nothing left to continue with: stop on the last phrase, ready to replay it.
  return withPlayer(state, {
    ...stopClock(player, now),
    status: 'paused',
    phase: 'native',
    repetition: 1,
    cycle: player.cycle + 1,
    ended: true,
  });
}

function advance(state: AppState, player: PlayerState, now: number, fromLastPhase: boolean): AppState {
  if (player.index < player.order.length - 1) return withPlayer(state, enterPhrase(state, player, player.index + 1, now));
  return pastTheEnd(state, player, now, fromLastPhase);
}

function recordHeard(state: AppState, phraseId: string, now: number, targetMs: number | null): AppState {
  const [id, next] = takeId(state);
  const entry: LogEntry = {
    id,
    at: now,
    device: state.device.id,
    kind: 'heard',
    key: keyOf(state.learner, phraseId),
    phraseId,
    setId: state.player.setId,
    targetMs,
    nativeMs: state.player.nativeMsThisRep,
  };
  return { ...next, learner: { ...next.learner, log: insertEntry(next.learner.log, entry) } };
}

function newSession(state: AppState, now: number): [PlayerState['session'], AppState] {
  const [id, next] = takeId(state);
  return [{ id, startedAt: now, passes: 0 }, next];
}

/** Ratings whose five-minute window has closed become `rated` log entries at their original time. */
function commitDue(state: AppState, now: number): AppState {
  const due = state.pending.filter((p) => now - p.at >= RATING_WINDOW_MS);
  if (due.length === 0) return state;
  let next: AppState = { ...state, pending: state.pending.filter((p) => !due.includes(p)) };
  let log = next.learner.log;
  for (const p of [...due].sort((a, b) => a.at - b.at)) {
    const [id, withId] = takeId(next);
    next = withId;
    log = insertEntry(log, {
      id,
      at: p.at,
      device: state.device.id,
      kind: 'rated',
      key: p.key,
      phraseId: p.phraseId,
      setId: p.setId,
      grade: p.grade,
    });
  }
  return { ...next, learner: { ...next.learner, log } };
}

const trimmed = (text: string) => text.trim().replace(/\s+/g, ' ');

// ---------- the machine ----------

export function transition(state: AppState, event: AppEvent): AppState {
  if (!canHandle(state.player.status, event.type)) return state;
  const { player, learner } = state;
  const currentId = currentPhraseId(player);

  switch (event.type) {
    case 'LOAD': {
      const ids = event.phraseIds.filter((id) => findPhrase(learner, id));
      if (ids.length === 0) return state;
      const start = Math.min(Math.max(0, event.startIndex ?? 0), ids.length - 1);
      const shuffle = event.shuffle ?? false;
      const first = ids[start];
      const order = shuffle ? [first, ...shuffled(ids.filter((_, i) => i !== start), event.seed)] : ids;
      const [session, next] = newSession(state, event.now);
      const loaded: PlayerState = {
        ...initialPlayer(),
        status: 'playing',
        shuffle,
        setId: event.setId,
        baseOrder: ids,
        order,
        cycle: player.cycle + 1,
        session,
      };
      return withPlayer(next, enterPhrase(next, loaded, shuffle ? 0 : start, event.now));
    }

    case 'PLAY': {
      if (currentId === null) return state;
      const resumed: PlayerState = { ...player, status: 'playing', audioError: null };
      // A finished queue replays its last phrase from the top, as a new play.
      if (player.ended) return withPlayer(state, enterPhrase(state, resumed, player.index, event.now));
      // Speech cannot resume mid-utterance, so the current phase restarts.
      return withPlayer(state, { ...resumed, playingSince: event.now, cycle: player.cycle + 1 });
    }

    case 'PAUSE':
      return withPlayer(state, { ...stopClock(player, event.now), status: 'paused', cycle: player.cycle + 1 });

    case 'PHASE_DONE': {
      if (event.cycle !== player.cycle || currentId === null) return state;
      if (event.failure) {
        // No silent loop and no points without audio: stop and say why.
        return withPlayer(state, {
          ...stopClock(player, event.now),
          status: 'paused',
          audioError: event.failure,
          cycle: player.cycle + 1,
        });
      }
      switch (player.phase) {
        case 'native':
          return withPlayer(state, {
            ...player,
            phase: 'pause',
            nativeMsThisRep: event.unconfirmed ? null : (event.measuredMs ?? null),
            cycle: player.cycle + 1,
          });
        case 'pause':
          return withPlayer(state, { ...player, phase: 'target', cycle: player.cycle + 1 });
        case 'rate':
          return advance(state, player, event.now, true);
        case 'target': {
          // One repetition completed — unless the engine never confirmed it played.
          const next = event.unconfirmed ? state : recordHeard(state, currentId, event.now, event.measuredMs ?? null);
          if (player.repetition < player.repeats) {
            return withPlayer(next, {
              ...player,
              phase: 'native',
              repetition: player.repetition + 1,
              nativeMsThisRep: null,
              cycle: player.cycle + 1,
            });
          }
          const rated = next.pending.some((p) => p.key === keyOf(learner, currentId));
          if (!rated) return withPlayer(next, { ...player, phase: 'rate', cycle: player.cycle + 1 });
          return advance(next, player, event.now, true);
        }
      }
      return state;
    }

    case 'NEXT':
      return advance(state, player, event.now, false);

    case 'PREV': {
      if (currentId === null) return state;
      const running = player.playingSince === null ? 0 : event.now - player.playingSince;
      const listened = player.elapsedMs + running;
      const index = listened > RESTART_THRESHOLD_MS || player.index === 0 ? player.index : player.index - 1;
      return withPlayer(state, enterPhrase(state, player, index, event.now));
    }

    case 'JUMP': {
      // Moving in the queue keeps play or pause, like Next and Previous. "Play now" also plays.
      if (event.index < 0 || event.index >= player.order.length) return state;
      const status = event.play ? 'playing' : player.status;
      return withPlayer(state, enterPhrase(state, { ...player, status, audioError: null }, event.index, event.now));
    }

    case 'RATE': {
      if (currentId === null) return state;
      const key = keyOf(learner, currentId);
      // A rating whose window has closed counts before a new one starts.
      const committed = commitDue(state, event.now);
      const existing = committed.pending.find((p) => p.key === key);
      let next: AppState;
      if (existing) {
        // Inside the window: change the grade, keep the original time and window.
        next = { ...committed, pending: committed.pending.map((p) => (p === existing ? { ...p, grade: event.grade } : p)) };
      } else {
        next = {
          ...committed,
          pending: [...committed.pending, { key, phraseId: currentId, setId: player.setId, grade: event.grade, at: event.now }],
        };
      }
      // Missed or hard: bring it back a few phrases later in this queue, with at least one
      // other phrase first. On the last phrase there's none, so it isn't re-queued: it would
      // replay at once (and in repeat mode the queue would grow each pass).
      let nextPlayer = player;
      const upNext = player.order.slice(player.index + 1);
      if ((event.grade === 'missed' || event.grade === 'hard') && upNext.length > 0 && !upNext.includes(currentId)) {
        const at = Math.min(player.order.length, player.index + 1 + RELEARN_GAP);
        nextPlayer = { ...player, order: [...player.order.slice(0, at), currentId, ...player.order.slice(at)] };
      }
      if (player.phase === 'rate') return advance(next, nextPlayer, event.now, true);
      return withPlayer(next, nextPlayer);
    }

    case 'UNRATE': {
      if (currentId === null) return state;
      const key = keyOf(learner, currentId);
      const committed = commitDue(state, event.now);
      return { ...committed, pending: committed.pending.filter((p) => p.key !== key) };
    }

    case 'COMMIT':
      return commitDue(state, event.now);

    case 'SET_PREFS': {
      const prefs = { ...state.prefs, ...event.prefs };
      if (event.prefs.repeats === undefined || currentId === null) return { ...state, prefs };
      // A new repetitions setting applies now, finishing the repetition in progress.
      const repeats = repeatsFor({ ...state, prefs }, currentId);
      return { ...state, prefs, player: { ...player, repeats, repetition: Math.min(player.repetition, repeats) } };
    }

    case 'TOGGLE_SHUFFLE': {
      const played = player.order.slice(0, player.index + 1);
      const upNext = player.order.slice(player.index + 1);
      const reordered = player.shuffle
        ? [...upNext].sort((a, b) => player.baseOrder.indexOf(a) - player.baseOrder.indexOf(b))
        : shuffled(upNext, event.seed);
      return withPlayer(state, { ...player, shuffle: !player.shuffle, order: [...played, ...reordered] });
    }

    case 'REORDER_UP_NEXT': {
      const upNext = player.order.slice(player.index + 1);
      const sorted = (ids: string[]) => [...ids].sort().join('\n');
      if (sorted(event.phraseIds) !== sorted(upNext)) return state;
      return withPlayer(state, { ...player, order: [...player.order.slice(0, player.index + 1), ...event.phraseIds] });
    }

    case 'REMOVE_FROM_QUEUE': {
      const at = event.position;
      if (at < 0 || at >= player.order.length || at === player.index) return state;
      return withPlayer(state, {
        ...player,
        order: player.order.filter((_, i) => i !== at),
        index: at < player.index ? player.index - 1 : player.index,
      });
    }

    case 'INSERT_IN_QUEUE': {
      // Undo of a removal: put the phrase back where it was.
      if (!findPhrase(learner, event.phraseId)) return state;
      const at = Math.max(0, Math.min(event.position, player.order.length));
      return withPlayer(state, {
        ...player,
        order: [...player.order.slice(0, at), event.phraseId, ...player.order.slice(at)],
        index: at <= player.index ? player.index + 1 : player.index,
      });
    }

    case 'RESTORE_UP_NEXT': {
      const ids = event.phraseIds.filter((id) => findPhrase(learner, id));
      if (ids.length === 0 || player.order.length === 0) return state;
      const at = player.index + 1;
      return withPlayer(state, { ...player, order: [...player.order.slice(0, at), ...ids, ...player.order.slice(at)] });
    }

    case 'ENQUEUE': {
      const ids = event.phraseIds.filter((id) => findPhrase(learner, id));
      if (ids.length === 0) return state;
      if (player.order.length === 0) {
        // An empty queue adopts the phrases without playing them.
        const [session, next] = newSession(state, event.now);
        const queued: PlayerState = {
          ...initialPlayer(),
          status: 'paused',
          setId: event.setId,
          baseOrder: ids,
          order: ids,
          cycle: player.cycle + 1,
          session,
        };
        return withPlayer(next, enterPhrase(next, queued, 0, event.now));
      }
      const played = player.order.slice(0, player.index + 1);
      const upNext = player.order.slice(player.index + 1);
      const adding = ids.filter((id) => id !== currentId);
      if (adding.length === 0) return state;
      const order =
        event.at === 'next'
          ? [...played, ...adding, ...upNext.filter((id) => !adding.includes(id))]
          : [...played, ...upNext, ...adding.filter((id) => !upNext.includes(id))];
      return withPlayer(state, {
        ...player,
        order,
        baseOrder: [...player.baseOrder, ...adding.filter((id) => !player.baseOrder.includes(id))],
        // A queue that mixes sets no longer plays "from" one set.
        setId: player.setId === event.setId ? event.setId : null,
      });
    }

    case 'CLEAR_QUEUE': {
      if (currentId === null) return state;
      return withPlayer(state, { ...player, order: [currentId], baseOrder: [currentId], index: 0 });
    }

    case 'TOGGLE_LIKE': {
      const k = `${event.kind}:${event.id}`;
      const liked = !(learner.likes[k]?.liked ?? false);
      return { ...state, learner: { ...learner, likes: { ...learner.likes, [k]: { liked, at: event.now } } } };
    }

    case 'ADD_OWN_PHRASE': {
      const target = trimmed(event.target);
      const native = trimmed(event.native);
      if (!target || !native) return state;
      const [seqId, next] = takeId(state);
      const id = `${OWN_PHRASE_PREFIX}${seqId}`;
      const { nativeLang, targetLang } = learner.profile;
      const phrase = { id, target, native, nativeLang, targetLang, createdAt: event.now, updatedAt: event.now, deleted: false };
      return { ...next, learner: { ...next.learner, ownPhrases: { ...next.learner.ownPhrases, [id]: phrase } } };
    }

    case 'EDIT_OWN_PHRASE': {
      // A correction keeps the phrase's id, so its history and memory stay with it.
      const own = learner.ownPhrases[event.id];
      const target = trimmed(event.target);
      const native = trimmed(event.native);
      if (!own || own.deleted || !target || !native) return state;
      if (target === own.target && native === own.native) return state;
      const updated = { ...own, target, native, updatedAt: event.now };
      return { ...state, learner: { ...learner, ownPhrases: { ...learner.ownPhrases, [own.id]: updated } } };
    }

    case 'DELETE_OWN_PHRASE': {
      const own = learner.ownPhrases[event.id];
      if (!own || own.deleted || event.id === currentId) return state;
      const index = player.order.indexOf(event.id);
      const order = player.order.filter((id) => id !== event.id);
      const removedBefore = player.order.slice(0, player.index).filter((id) => id === event.id).length;
      return {
        ...state,
        player: index === -1 ? player : { ...player, order, baseOrder: player.baseOrder.filter((id) => id !== event.id), index: player.index - removedBefore },
        learner: {
          ...learner,
          ownPhrases: { ...learner.ownPhrases, [event.id]: { ...own, deleted: true, updatedAt: event.now } },
        },
      };
    }

    // Undo of a delete: the later timestamp wins the merge, so the restore syncs too.
    case 'RESTORE_OWN_PHRASE': {
      const own = learner.ownPhrases[event.id];
      if (!own || !own.deleted) return state;
      return { ...state, learner: { ...learner, ownPhrases: { ...learner.ownPhrases, [event.id]: { ...own, deleted: false, updatedAt: event.now } } } };
    }

    case 'RESTORE_SET': {
      const set = learner.ownSets[event.setId];
      if (!set || !set.deleted) return state;
      return { ...state, learner: { ...learner, ownSets: { ...learner.ownSets, [event.setId]: { ...set, deleted: false, updatedAt: event.now } } } };
    }

    case 'CREATE_SET': {
      const title = trimmed(event.title);
      if (!title) return state;
      const [seqId, next] = takeId(state);
      const id = `${OWN_SET_PREFIX}${seqId}`;
      const phraseIds = [...new Set(event.phraseIds.filter((pid) => findPhrase(learner, pid)))];
      const set = {
        id,
        title,
        targetLang: learner.profile.targetLang,
        phraseIds,
        createdAt: event.now,
        updatedAt: event.now,
        deleted: false,
      };
      return { ...next, learner: { ...next.learner, ownSets: { ...next.learner.ownSets, [id]: set } } };
    }

    case 'ADD_TO_SET':
    case 'REMOVE_FROM_SET':
    case 'MOVE_IN_SET':
    case 'RENAME_SET':
    case 'DELETE_SET': {
      const set = learner.ownSets[event.setId];
      if (!set || set.deleted) return state;
      let updated = set;
      if (event.type === 'ADD_TO_SET') {
        const adding = [...new Set(event.phraseIds)].filter((id) => findPhrase(learner, id) && !set.phraseIds.includes(id));
        if (adding.length === 0) return state;
        const at = event.at === undefined ? set.phraseIds.length : Math.max(0, Math.min(event.at, set.phraseIds.length));
        updated = { ...set, phraseIds: [...set.phraseIds.slice(0, at), ...adding, ...set.phraseIds.slice(at)] };
      } else if (event.type === 'MOVE_IN_SET') {
        const from = set.phraseIds.indexOf(event.phraseId);
        const to = from + event.delta;
        if (from === -1 || to < 0 || to >= set.phraseIds.length) return state;
        const phraseIds = [...set.phraseIds];
        [phraseIds[from], phraseIds[to]] = [phraseIds[to], phraseIds[from]];
        updated = { ...set, phraseIds };
      } else if (event.type === 'REMOVE_FROM_SET') {
        updated = { ...set, phraseIds: set.phraseIds.filter((id) => id !== event.phraseId) };
      } else if (event.type === 'RENAME_SET') {
        const title = trimmed(event.title);
        if (!title) return state;
        updated = { ...set, title };
      } else {
        updated = { ...set, deleted: true };
      }
      return {
        ...state,
        learner: { ...learner, ownSets: { ...learner.ownSets, [set.id]: { ...updated, updatedAt: event.now } } },
      };
    }

    case 'SET_PROFILE': {
      const profile: Profile = { ...learner.profile, ...event.profile, updatedAt: event.now };
      if (typeof profile.name === 'string') profile.name = trimmed(profile.name);
      const courseChanged =
        profile.nativeLang !== learner.profile.nativeLang || profile.targetLang !== learner.profile.targetLang;
      return {
        ...state,
        learner: { ...learner, profile },
        // Another course: the queue belongs to the old one.
        player: courseChanged ? { ...initialPlayer(), cycle: player.cycle + 1 } : player,
      };
    }

    case 'RESTORE':
      return sanitizeState(event.state, state.device) ?? state;

    case 'MERGE_REMOTE': {
      const merged = mergeLearner(learner, event.learner);
      if (merged === learner) return state;
      // Another device may have deleted one of your queued phrases, even the current one
      // (a local delete refuses that). Drop what's gone; if the current phrase went, pause
      // on the one after it rather than "play" a phrase that no longer exists.
      const known = (id: string) => Boolean(findPhrase(merged, id));
      if (player.order.every(known)) return { ...state, learner: merged };
      const order = player.order.filter(known);
      const currentGone = !known(player.order[player.index]);
      const index = Math.min(player.order.slice(0, player.index).filter(known).length, Math.max(0, order.length - 1));
      const cleaned: PlayerState = {
        ...(currentGone ? { ...stopClock(player, event.now), phase: 'native' as const, repetition: 1, cycle: player.cycle + 1 } : player),
        status: order.length === 0 ? 'idle' : currentGone ? 'paused' : player.status,
        order,
        baseOrder: player.baseOrder.filter(known),
        index,
      };
      return { ...state, learner: merged, player: order.length === 0 ? initialPlayer() : cleaned };
    }

    case 'RESET':
      // Progress goes; the device keeps its identity so ids stay unique.
      return { ...initialState(state.device.id, state.device.instance), device: state.device };
  }
}

