// Everything a screen can ask of the state machine, as functions: each builds its event with the
// time from the clock (and a seed or promised id where it needs one) and dispatches it. Shared by
// the web store (store.tsx) and the React Native app's.
import type { RefObject } from 'react';
import { OWN_PHRASE_PREFIX, OWN_SET_PREFIX } from './catalog';
import { clock } from './clock';
import type { AppEvent } from './machine';
import type { AppState, AudioFailure, Grade, LearnerState, OwnNotes, PendingRating, PhrasePick, Prefs, Profile, QueueSource } from './types';

const newSeed = () => Math.floor(Math.random() * 2 ** 32);

export function makeActions(dispatch: (event: AppEvent) => void, latest: RefObject<AppState>) {
  const now = clock.now;
  return {
    load: (phraseIds: string[], setId: string | null, startIndex = 0, shuffle = false, source: QueueSource | null = null) =>
      dispatch({ type: 'LOAD', phraseIds, setId, startIndex, shuffle, source, now: now(), seed: newSeed() }),
    play: () => dispatch({ type: 'PLAY', now: now() }),
    pause: () => dispatch({ type: 'PAUSE', now: now() }),
    phaseDone: (cycle: number, result: { measuredMs?: number; failure?: AudioFailure; unconfirmed?: boolean } = {}) =>
      dispatch({ type: 'PHASE_DONE', cycle, ...result, now: now() }),
    next: () => dispatch({ type: 'NEXT', now: now() }),
    prev: () => dispatch({ type: 'PREV', now: now() }),
    jump: (index: number, play = false) => dispatch({ type: 'JUMP', index, play, now: now() }),
    /** Start the current phrase again from its prompt. */
    restart: () => dispatch({ type: 'JUMP', index: latest.current.player.index, now: now() }),
    rate: (grade: Grade) => dispatch({ type: 'RATE', grade, now: now() }),
    /** Undo the current phrase's rating, or `phraseId`'s once the player has moved on. */
    unrate: (phraseId?: string) => dispatch({ type: 'UNRATE', phraseId, now: now() }),
    commit: () => dispatch({ type: 'COMMIT', now: now() }),
    setPrefs: (prefs: Partial<Prefs>) => dispatch({ type: 'SET_PREFS', prefs, now: now() }),
    toggleShuffle: () => dispatch({ type: 'TOGGLE_SHUFFLE', seed: newSeed() }),
    reorderUpNext: (phraseIds: string[]) => dispatch({ type: 'REORDER_UP_NEXT', phraseIds }),
    removeFromQueue: (position: number) => dispatch({ type: 'REMOVE_FROM_QUEUE', position }),
    restoreUpNext: (phraseIds: string[], offset?: number) => dispatch({ type: 'RESTORE_UP_NEXT', phraseIds, offset }),
    enqueue: (phraseIds: string[], setId: string | null, at: 'next' | 'end') =>
      dispatch({ type: 'ENQUEUE', phraseIds, setId, at, now: now() }),
    clearQueue: () => dispatch({ type: 'CLEAR_QUEUE' }),
    toggleLike: (kind: 'phrase' | 'set', id: string) => dispatch({ type: 'TOGGLE_LIKE', kind, id, now: now() }),
    /**
     * Adds your own phrase and returns its id: one from the device counter as last rendered, sent
     * with the event, since the speech may take the counter's next id first (as createSet).
     */
    addOwnPhrase: (target: string, native: string): string => {
      const { device } = latest.current;
      const id = `${OWN_PHRASE_PREFIX}${device.id}.${device.instance}-${(device.seq + 1).toString(36)}`;
      dispatch({ type: 'ADD_OWN_PHRASE', target, native, now: now(), id });
      return id;
    },
    /** Notes and a picture AI wrote for one of the learner's own phrases, for the text it had then. */
    setOwnNotes: (id: string, target: string, notes: OwnNotes, image: string[]) => dispatch({ type: 'SET_OWN_NOTES', id, target, notes, image, now: now() }),
    editOwnPhrase: (id: string, target: string, native: string) =>
      dispatch({ type: 'EDIT_OWN_PHRASE', id, target, native, now: now() }),
    deleteOwnPhrase: (id: string) => dispatch({ type: 'DELETE_OWN_PHRASE', id, now: now() }),
    restoreOwnPhrase: (id: string) => dispatch({ type: 'RESTORE_OWN_PHRASE', id, now: now() }),
    /** Creates a set and returns its id, sent with the event as addOwnPhrase's is. */
    createSet: (title: string, phraseIds: string[]): string => {
      const { device } = latest.current;
      const id = `${OWN_SET_PREFIX}${device.id}.${device.instance}-${(device.seq + 1).toString(36)}`;
      dispatch({ type: 'CREATE_SET', title, phraseIds, now: now(), id });
      return id;
    },
    /**
     * Saves what the learner kept in "Make a set" in one event: new phrases become their own, and
     * all of them a new set (`into.title`) or join their set (`into.setId`). Returns the set's id.
     * Ids are promised from the device counter as last rendered, in the order the event takes them.
     */
    savePicks: (picks: PhrasePick[], into: { title: string } | { setId: string }): string => {
      const { device } = latest.current;
      let seq = device.seq;
      const nextId = (prefix: string) => `${prefix}${device.id}.${device.instance}-${(++seq).toString(36)}`;
      const withIds = picks.map((p) => ('phraseId' in p ? p : { ...p, id: nextId(OWN_PHRASE_PREFIX) }));
      if ('setId' in into) {
        dispatch({ type: 'ADD_PICKS', picks: withIds, setId: into.setId, now: now() });
        return into.setId;
      }
      const id = nextId(OWN_SET_PREFIX);
      dispatch({ type: 'ADD_PICKS', picks: withIds, title: into.title, id, now: now() });
      return id;
    },
    addToSet: (setId: string, phraseIds: string[], at?: number) => dispatch({ type: 'ADD_TO_SET', setId, phraseIds, at, now: now() }),
    removeFromSet: (setId: string, phraseId: string) => dispatch({ type: 'REMOVE_FROM_SET', setId, phraseId, now: now() }),
    moveInSet: (setId: string, phraseId: string, delta: -1 | 1) =>
      dispatch({ type: 'MOVE_IN_SET', setId, phraseId, delta, now: now() }),
    renameSet: (setId: string, title: string) => dispatch({ type: 'RENAME_SET', setId, title, now: now() }),
    deleteSet: (setId: string) => dispatch({ type: 'DELETE_SET', setId, now: now() }),
    restoreSet: (setId: string) => dispatch({ type: 'RESTORE_SET', setId, now: now() }),
    setProfile: (profile: Partial<Omit<Profile, 'updatedAt'>>) => dispatch({ type: 'SET_PROFILE', profile, now: now() }),
    mergeRemote: (learner: LearnerState, pending?: PendingRating[], prefs?: Prefs) => dispatch({ type: 'MERGE_REMOTE', learner, pending, prefs, now: now() }),
    reset: () => dispatch({ type: 'RESET' }),
  };
}

export type Actions = ReturnType<typeof makeActions>;
