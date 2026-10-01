// Everything a screen can ask of the state machine, as functions: each builds its event with the
// time from the clock (and a seed or promised id where it needs one) and dispatches it. Shared by
// the web store (store.tsx) and the React Native app's.
import type { RefObject } from 'react';
import { clock } from './clock';
import type { AppEvent } from './machine';
import type { AppState, AudioFailure, Grade, LearnerState, LikeKind, PendingRating, Prefs, Profile, QueueSource } from './types';

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
    /** Closes the paused player: the queue goes, ratings and progress stay. */
    close: () => dispatch({ type: 'CLOSE' }),
    toggleLike: (kind: LikeKind, id: string) => dispatch({ type: 'TOGGLE_LIKE', kind, id, now: now() }),
    /** Rate every phrase a song sings (plan 107); `unratePhrases` undoes it inside the window. */
    ratePhrases: (songId: string, phraseIds: string[], setId: string | null, grade: Grade) =>
      dispatch({ type: 'RATE_PHRASES', songId, phraseIds, setId, grade, now: now() }),
    unratePhrases: (songId: string) => dispatch({ type: 'UNRATE_PHRASES', songId, now: now() }),
    /** What this device made is in the learner's account now, under the same ids (plan 108). */
    ownUploaded: (phraseIds: string[], setIds: string[]) => dispatch({ type: 'OWN_UPLOADED', phraseIds, setIds, now: now() }),
    contentChanged: () => dispatch({ type: 'CONTENT_CHANGED', now: now() }),
    setProfile: (profile: Partial<Omit<Profile, 'updatedAt'>>) => dispatch({ type: 'SET_PROFILE', profile, now: now() }),
    mergeRemote: (learner: LearnerState, pending?: PendingRating[], prefs?: Prefs) => dispatch({ type: 'MERGE_REMOTE', learner, pending, prefs, now: now() }),
    reset: () => dispatch({ type: 'RESET' }),
    /** Replaces the whole state with a saved one (checked as a load is); another account's progress. */
    restore: (state: unknown) => dispatch({ type: 'RESTORE', state }),
  };
}

export type Actions = ReturnType<typeof makeActions>;
