// The app state machine. `transition(state, event)` is pure: no clock, no
// randomness, no I/O — events carry `now` and `seed`, and ids come from the
// device counter in state. The whole AppState is plain JSON.
//
// Player loop for one phrase, repeated `repeats` times:
//   native (hear it in your language) → pause (say it yourself) → target (hear it)
// then a short hold for a rating if there is none, then the next phrase. At the
// end of the queue the play mode decides: play it again, or continue with the
// next phrases of the course — except a queue with a natural end (a review, the
// demo, a Library list), which plays once and stops. The allowed events per status
// are in chart.ts.
import { findPhrase, keyOf } from './catalog';
import { clip, LIMITS, tidy } from './limits';
import { canHandle } from './chart';
import { initialPlayer, initialState } from './initial';
import { localDay } from './clock';
import { insertEntry, RATING_WINDOW_MS } from './memory';
import { committedIn, mergeLearner, mergePending, mergePrefs, ratingCommitId, ratingEntry } from './merge';
import { sanitizeState } from './persistence';
import { continuation, currentPhraseId, displayLearner, phaseDurationMs, repeatsFor } from './selectors';
import type {
  AppState,
  AudioFailure,
  Grade,
  LearnerState,
  LikeKind,
  LogEntry,
  PendingRating,
  PlayerState,
  Prefs,
  Profile,
  QueueSource,
  RepeatsSetting,
  Speed,
} from './types';

export type { AppState } from './types';

export const SPEEDS: Speed[] = [0.8, 1, 1.25];
export const REPEAT_SETTINGS: RepeatsSetting[] = ['auto', 1, 3];
/** Pressing Previous later than this restarts the phrase instead. */
export const RESTART_THRESHOLD_MS = 3000;

export type AppEvent =
  | {
      type: 'LOAD';
      phraseIds: string[];
      setId: string | null;
      startIndex?: number;
      shuffle?: boolean;
      /** Where an unnamed queue comes from; such a queue plays once (see QueueSource). */
      source?: QueueSource | null;
      now: number;
      seed: number;
    }
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
  /** Undo a rating inside its window: the current phrase's, or `phraseId`'s (the phrase has moved on). */
  | { type: 'UNRATE'; now: number; phraseId?: string }
  | { type: 'COMMIT'; now: number }
  | { type: 'SET_PREFS'; prefs: Partial<Prefs>; now: number }
  | { type: 'TOGGLE_SHUFFLE'; seed: number }
  | { type: 'REORDER_UP_NEXT'; phraseIds: string[] }
  | { type: 'REMOVE_FROM_QUEUE'; position: number }
  | { type: 'INSERT_IN_QUEUE'; position: number; phraseId: string }
  | { type: 'ENQUEUE'; phraseIds: string[]; setId: string | null; at: 'next' | 'end'; now: number }
  | { type: 'CLEAR_QUEUE' }
  /** Undo of Clear queue or Remove: back in up next, `offset` places after whatever is playing by then. */
  | { type: 'RESTORE_UP_NEXT'; phraseIds: string[]; offset?: number }
  | { type: 'TOGGLE_LIKE'; kind: LikeKind; id: string; now: number }
  /**
   * A rating for several phrases at once, from outside the phrase loop: a song rated in the player
   * reviews every phrase it sings (plan 107). Each gets a pending rating with the usual undo window.
   */
  | { type: 'RATE_PHRASES'; songId: string; phraseIds: string[]; setId: string | null; grade: Grade; now: number }
  /** Undo of a song's RATE_PHRASES inside its window: only the ratings the song gave. */
  | { type: 'UNRATE_PHRASES'; songId: string; now: number }
  /**
   * Phrases and sets made on this device, now in the learner's account under the same ids (plan
   * 108): marked deleted here, so every device stops keeping its copy. Progress stays with the ids.
   */
  | { type: 'OWN_UPLOADED'; phraseIds: string[]; setIds: string[]; now: number }
  /** The installed content changed (a pack downloaded, a set of the learner's changed). */
  | { type: 'CONTENT_CHANGED'; now: number }
  | { type: 'SET_PROFILE'; profile: Partial<Omit<Profile, 'updatedAt'>>; now: number }
  | { type: 'RESTORE'; state: unknown }
  /** Another tab's or device's copy; `pending` only from another tab of this browser. */
  | { type: 'MERGE_REMOTE'; learner: LearnerState; pending?: PendingRating[]; prefs?: Prefs; now: number }
  | { type: 'RESET' };

export type AppEventType = AppEvent['type'];

// ---------- helpers ----------

/** A phrase's place in the unshuffled order; one the order doesn't know goes last. */
function baseRank(baseOrder: string[], id: string): number {
  const i = baseOrder.indexOf(id);
  return i === -1 ? Number.MAX_SAFE_INTEGER : i;
}

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

/**
 * A queued phrase may be gone, even the current one: deleted on another device, or from the learner's
 * account (plan 108). Drops what's gone; if the current phrase went, pauses on the one after it
 * rather than "play" a phrase that no longer exists.
 */
function withoutGone(state: AppState, now: number): AppState {
  const current = state.player;
  const known = (id: string) => Boolean(findPhrase(state.learner, id));
  if (current.order.every(known)) return state;
  const order = current.order.filter(known);
  const currentGone = !known(current.order[current.index]);
  const index = Math.min(current.order.slice(0, current.index).filter(known).length, Math.max(0, order.length - 1));
  const cleaned: PlayerState = {
    ...(currentGone ? { ...stopClock(current, now), phase: 'native' as const, repetition: 1, targetHeard: false, cycle: current.cycle + 1 } : current),
    status: order.length === 0 ? 'idle' : currentGone ? 'paused' : current.status,
    order,
    baseOrder: current.baseOrder.filter(known),
    index,
  };
  return { ...state, player: order.length === 0 ? initialPlayer() : cleaned };
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
    targetHeard: false,
    // A failure belonged to the phrase it happened on; the next one hasn't been tried.
    audioError: null,
  };
}

function withPlayer(state: AppState, player: PlayerState): AppState {
  return { ...state, player };
}

/**
 * The phrases up next split into the rest and those coming back again (a Missed or Hard phrase's
 * second play, already heard this pass): the queue keeps the latter last.
 */
function splitAgain(played: readonly string[], upNext: readonly string[]): { rest: string[]; again: string[] } {
  const rest: string[] = [];
  const again: string[] = [];
  for (const id of upNext) (played.includes(id) ? again : rest).push(id);
  return { rest, again };
}

/** A queue with a natural end (a review, the demo, a Library list) plays once, in either mode. */
export function playsOnce(player: Pick<PlayerState, 'source'>): boolean {
  return player.source !== null;
}

/** Whether rating the current phrase `grade` brings it back at the end of this queue. */
export function requeuesOn(player: PlayerState, grade: Grade): boolean {
  const id = currentPhraseId(player);
  const upNext = player.order.slice(player.index + 1);
  // Missed or hard, with at least one other phrase first. On the last phrase there's none, so
  // it isn't re-queued: it would replay at once (and in repeat mode the queue would grow each pass).
  return id !== null && (grade === 'missed' || grade === 'hard') && upNext.length > 0 && !upNext.includes(id);
}

/** Stop on the last phrase, ready to replay it: the queue has ended. */
function stopAtTheEnd(player: PlayerState, now: number): PlayerState {
  return { ...stopClock(player, now), status: 'paused', phase: 'native', repetition: 1, cycle: player.cycle + 1, ended: true };
}

/** Past the last phrase: a one-pass queue ends; otherwise the play mode decides what happens. */
function pastTheEnd(state: AppState, player: PlayerState, now: number, fromLastPhase: boolean): AppState {
  // Next on the last phrase ends it too: the learner is done with it.
  if (playsOnce(player)) return withPlayer(state, stopAtTheEnd(player, now));
  if (state.prefs.playMode === 'repeat' && player.order.length > 0) {
    const session = player.session ? { ...player.session, passes: player.session.passes + 1 } : null;
    return withPlayer(state, enterPhrase(state, { ...player, session }, 0, now));
  }
  // Ratings still in their window count: a phrase just rated isn't due again.
  const next = continuation(displayLearner(state), player, now);
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
  // Nothing left to continue with.
  return withPlayer(state, stopAtTheEnd(player, now));
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
    day: localDay(now),
  };
  const session = next.player.session;
  const heard = session && !(session.heard ?? []).includes(entry.key) ? { ...session, heard: [...(session.heard ?? []), entry.key] } : session;
  return {
    ...next,
    player: heard === session ? next.player : { ...next.player, session: heard },
    learner: { ...next.learner, log: insertEntry(next.learner.log, entry) },
  };
}

function newSession(state: AppState, now: number): [PlayerState['session'], AppState] {
  const [id, next] = takeId(state);
  return [{ id, startedAt: now, passes: 0 }, next];
}

/** Ratings whose five-minute window has closed become `rated` log entries at their original time. */
function commitDue(state: AppState, now: number): AppState {
  const due = state.pending.filter((p) => now - p.at >= RATING_WINDOW_MS);
  if (due.length === 0) return state;
  const next: AppState = { ...state, pending: state.pending.filter((p) => !due.includes(p)) };
  let log = next.learner.log;
  for (const p of [...due].sort((a, b) => a.at - b.at)) {
    if (p.undone) continue; // an undo's tombstone: nothing to count
    // The same id in every tab of this browser (they share the device id and the pending
    // rating), so two tabs committing it, or one merging the other's commit, count it once.
    const id = ratingCommitId(state.device.id, p);
    if (log.some((e) => e.id === id)) continue;
    log = insertEntry(log, ratingEntry(state.device.id, p));
  }
  return { ...next, learner: { ...next.learner, log } };
}

/** Stored form of typed text: whitespace folded, cut to its limit. */
const trimmed = (text: string, max: number) => clip(tidy(text), max);

// ---------- the machine ----------

export function transition(state: AppState, event: AppEvent): AppState {
  return withPhaseTiming(state, step(state, event), 'now' in event ? event.now : null);
}

/**
 * The running phase's start and, for the learner's turn and the rating hold, its length,
 * fixed when it starts (a phase starts whenever the cycle moves on while playing, or
 * playback starts). Later setting changes don't stretch a phase already running, just as
 * they don't restart it. Nothing runs while paused.
 */
function withPhaseTiming(before: AppState, after: AppState, now: number | null): AppState {
  const player = after.player;
  if (player === before.player) return after;
  if (player.status !== 'playing') {
    return player.phaseStartedAt === null && player.phaseMs === null ? after : withPlayer(after, { ...player, phaseStartedAt: null, phaseMs: null });
  }
  const started = player.cycle !== before.player.cycle || before.player.status !== 'playing';
  if (!started || now === null) return after;
  return withPlayer(after, { ...player, phaseStartedAt: now, phaseMs: phaseDurationMs(after) });
}

function step(state: AppState, event: AppEvent): AppState {
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
        source: event.source ?? null,
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
          // The target plays and shows from here: heard, even if Next cuts it short.
          return withPlayer(state, { ...player, phase: 'target', targetHeard: true, cycle: player.cycle + 1 });
        case 'rate':
          return advance(state, player, event.now, true);
        case 'target': {
          // One repetition completed — unless the engine never confirmed it played.
          const next = event.unconfirmed ? state : recordHeard(state, currentId, event.now, event.measuredMs ?? null);
          // recordHeard notes the phrase in the session: carry its player on, not the one before.
          const heard = next.player;
          if (player.repetition < player.repeats) {
            return withPlayer(next, {
              ...heard,
              phase: 'native',
              repetition: player.repetition + 1,
              nativeMsThisRep: null,
              cycle: player.cycle + 1,
            });
          }
          // An undone rating's tombstone isn't a rating: the phrase waits to be rated again.
          const rated = next.pending.some((p) => p.key === keyOf(learner, currentId) && !p.undone);
          if (!rated) return withPlayer(next, { ...heard, phase: 'rate', cycle: player.cycle + 1 });
          return advance(next, heard, event.now, true);
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
      if (existing && !existing.undone) {
        // Inside the window: change the grade, keep the original time and window. A song's rating
        // the loop changes becomes the loop's.
        const { songId: _song, ...kept } = existing;
        const changed = { ...kept, grade: event.grade, changedAt: event.now };
        next = { ...committed, pending: committed.pending.map((p) => (p === existing ? changed : p)) };
      } else {
        // New, or rated again after an undo: a fresh rating in place of the undo's tombstone.
        const rating = { key, phraseId: currentId, setId: player.setId, grade: event.grade, at: event.now, changedAt: event.now, day: localDay(event.now) };
        next = { ...committed, pending: [...committed.pending.filter((p) => p !== existing), rating] };
      }
      // Missed or hard: bring it back at the end of this queue, after any other phrase coming back.
      let nextPlayer = player;
      if (requeuesOn(player, event.grade)) nextPlayer = { ...player, order: [...player.order, currentId] };
      if (player.phase === 'rate') return advance(next, nextPlayer, event.now, true);
      return withPlayer(next, nextPlayer);
    }

    case 'UNRATE': {
      const id = event.phraseId ?? currentId;
      if (id === null) return state;
      const key = keyOf(learner, id);
      const committed = commitDue(state, event.now);
      // A tombstone until the window closes, so the undo wins over another tab's copy.
      return {
        ...committed,
        pending: committed.pending.map((p) => (p.key === key && !p.undone ? { ...p, undone: true, changedAt: event.now } : p)),
      };
    }

    case 'RATE_PHRASES': {
      let next = commitDue(state, event.now);
      for (const phraseId of new Set(event.phraseIds)) {
        if (!findPhrase(learner, phraseId)) continue;
        const key = keyOf(learner, phraseId);
        const existing = next.pending.find((p) => p.key === key);
        if (existing && !existing.undone) {
          // The song's own rating changes grade; any other (the loop's, another song's) stands.
          if (existing.songId !== event.songId) continue;
          const changed = { ...existing, grade: event.grade, changedAt: event.now };
          next = { ...next, pending: next.pending.map((p) => (p === existing ? changed : p)) };
        } else {
          const rating = { key, phraseId, setId: event.setId, grade: event.grade, at: event.now, changedAt: event.now, day: localDay(event.now), songId: event.songId };
          next = { ...next, pending: [...next.pending.filter((p) => p !== existing), rating] };
        }
      }
      return next;
    }

    case 'UNRATE_PHRASES': {
      const committed = commitDue(state, event.now);
      return {
        ...committed,
        pending: committed.pending.map((p) => (p.songId === event.songId && !p.undone ? { ...p, undone: true, changedAt: event.now } : p)),
      };
    }

    case 'COMMIT':
      return commitDue(state, event.now);

    case 'SET_PREFS': {
      const changed = Object.fromEntries(Object.keys(event.prefs).map((k) => [k, event.now]));
      const prefs = { ...state.prefs, ...event.prefs, changedAt: { ...state.prefs.changedAt, ...changed } };
      if (event.prefs.repeats === undefined || currentId === null) return { ...state, prefs };
      // A new repetitions setting applies now, finishing the repetition in progress.
      const repeats = repeatsFor({ ...state, prefs }, currentId);
      return { ...state, prefs, player: { ...player, repeats, repetition: Math.min(player.repetition, repeats) } };
    }

    case 'TOGGLE_SHUFFLE': {
      const played = player.order.slice(0, player.index + 1);
      const upNext = player.order.slice(player.index + 1);
      // Only the rest reorder: the phrases coming back again stay last, in the order they were rated.
      const { rest, again } = splitAgain(played, upNext);
      const sortedRest = player.shuffle
        ? [...rest].sort((a, b) => baseRank(player.baseOrder, a) - baseRank(player.baseOrder, b))
        : shuffled(rest, event.seed);
      return withPlayer(state, { ...player, shuffle: !player.shuffle, order: [...played, ...sortedRest, ...again] });
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
      const at = Math.min(player.order.length, player.index + 1 + Math.max(0, event.offset ?? 0));
      // The unshuffled order learns them too, just before the phrase they now precede,
      // so turning shuffle off keeps them where they came back.
      const missing = ids.filter((id) => !player.baseOrder.includes(id));
      const after = player.order.slice(at).find((id) => player.baseOrder.includes(id));
      const baseAt = after === undefined ? player.baseOrder.length : player.baseOrder.indexOf(after);
      const baseOrder = [...player.baseOrder.slice(0, baseAt), ...missing, ...player.baseOrder.slice(baseAt)];
      return withPlayer(state, { ...player, order: [...player.order.slice(0, at), ...ids, ...player.order.slice(at)], baseOrder });
    }

    case 'ENQUEUE': {
      // This course's phrases only: another's would play in the wrong language pair.
      const ids = event.phraseIds.filter((id) => findPhrase(learner, id)?.targetLang === learner.profile.targetLang);
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
      // Added to the end, they still play before the phrases coming back again.
      const { rest, again } = splitAgain(played, upNext);
      const order =
        event.at === 'next'
          ? [...played, ...adding, ...upNext.filter((id) => !adding.includes(id))]
          : [...played, ...rest, ...adding.filter((id) => !upNext.includes(id)), ...again];
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

    case 'OWN_UPLOADED': {
      const phrases = event.phraseIds.filter((id) => learner.ownPhrases[id] && !learner.ownPhrases[id].deleted);
      const sets = event.setIds.filter((id) => learner.ownSets[id] && !learner.ownSets[id].deleted);
      if (phrases.length === 0 && sets.length === 0) return state;
      const gone = <T extends { deleted: boolean; updatedAt: number }>(record: Record<string, T>, ids: string[]) =>
        ({ ...record, ...Object.fromEntries(ids.map((id) => [id, { ...record[id], deleted: true, updatedAt: event.now }])) });
      return { ...state, learner: { ...learner, ownPhrases: gone(learner.ownPhrases, phrases), ownSets: gone(learner.ownSets, sets) } };
    }

    case 'SET_PROFILE': {
      const profile: Profile = { ...learner.profile, ...event.profile, updatedAt: event.now };
      if (typeof profile.name === 'string') profile.name = trimmed(profile.name, LIMITS.name);
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
      const pending = event.pending
        ? mergePending(state.pending, event.pending, committedIn(merged.log, state.device.id), event.now)
        : state.pending;
      if (pending !== state.pending) state = { ...state, pending };
      const prefs = event.prefs ? mergePrefs(state.prefs, event.prefs) : state.prefs;
      if (prefs !== state.prefs) {
        // A repetitions change from another tab applies here as it would locally (SET_PREFS).
        const repeatsChanged = prefs.repeats !== state.prefs.repeats && currentId !== null;
        state = { ...state, prefs };
        if (repeatsChanged) {
          const repeats = repeatsFor(state, currentId);
          state = { ...state, player: { ...state.player, repeats, repetition: Math.min(state.player.repetition, repeats) } };
        }
      }
      if (merged === learner) return state;
      // The course switched on another tab or device: this queue belongs to the old one, as
      // with a switch here (SET_PROFILE).
      if (merged.profile.nativeLang !== learner.profile.nativeLang || merged.profile.targetLang !== learner.profile.targetLang) {
        return { ...state, learner: merged, player: { ...initialPlayer(), cycle: player.cycle + 1 } };
      }
      return withoutGone({ ...state, learner: merged }, event.now);
    }

    case 'CONTENT_CHANGED':
      return withoutGone(state, event.now);

    case 'RESET':
      // Progress goes; the device keeps its identity so ids stay unique.
      return { ...initialState(state.device.id, state.device.instance), device: state.device };
  }
}

