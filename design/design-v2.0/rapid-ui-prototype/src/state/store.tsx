import { createContext, ReactNode, RefObject, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useLatest } from '../lib/useLatest';
import { copyForNative, Copy } from '../copy';
import { OWN_PHRASE_PREFIX, OWN_SET_PREFIX } from './catalog';
import { clock } from './clock';
import { initialState } from './initial';
import { AppEvent, transition } from './machine';
import { mergeLearner, mergePending, mergePrefs } from './merge';
import { flushState, loadState, parseState, saveState } from './persistence';
import { onOtherTabSave, readRaw, Stored } from './storage';
import type { AppState, AudioFailure, Grade, LearnerState, PendingRating, Prefs, Profile } from './types';

const newSeed = () => Math.floor(Math.random() * 2 ** 32);
/** Saves wait this long for more changes; a hidden page saves at once. */
const SAVE_DEBOUNCE_MS = 400;
/** Pending ratings are checked this often and counted once their window closes. */
const COMMIT_EVERY_MS = 15_000;

function makeActions(dispatch: (event: AppEvent) => void, latest: RefObject<AppState>) {
  const now = clock.now;
  return {
    load: (phraseIds: string[], setId: string | null, startIndex = 0, shuffle = false) =>
      dispatch({ type: 'LOAD', phraseIds, setId, startIndex, shuffle, now: now(), seed: newSeed() }),
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
    unrate: () => dispatch({ type: 'UNRATE', now: now() }),
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
    /** Adds your own phrase and returns its id (from the device counter, as createSet). */
    addOwnPhrase: (target: string, native: string): string => {
      const { device } = latest.current;
      const id = `${OWN_PHRASE_PREFIX}${device.id}.${device.instance}-${(device.seq + 1).toString(36)}`;
      dispatch({ type: 'ADD_OWN_PHRASE', target, native, now: now() });
      return id;
    },
    editOwnPhrase: (id: string, target: string, native: string) =>
      dispatch({ type: 'EDIT_OWN_PHRASE', id, target, native, now: now() }),
    deleteOwnPhrase: (id: string) => dispatch({ type: 'DELETE_OWN_PHRASE', id, now: now() }),
    restoreOwnPhrase: (id: string) => dispatch({ type: 'RESTORE_OWN_PHRASE', id, now: now() }),
    /** Creates a set and returns its id (the machine takes ids from the device counter). */
    createSet: (title: string, phraseIds: string[]): string => {
      const { device } = latest.current;
      const id = `${OWN_SET_PREFIX}${device.id}.${device.instance}-${(device.seq + 1).toString(36)}`;
      dispatch({ type: 'CREATE_SET', title, phraseIds, now: now() });
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

interface StoreValue {
  state: AppState;
  actions: Actions;
}

const StoreContext = createContext<StoreValue | null>(null);

/** `stored` is what storage held before the first render (main.tsx). */
export function StoreProvider({ children, stored }: { children: ReactNode; stored: Stored }) {
  const [state, dispatch] = useReducer(transition, stored, (s) =>
    loadState(s, (device) => initialState(device.id, device.instance)),
  );
  const latest = useLatest(state);
  const actions = useMemo(() => makeActions(dispatch, latest), [latest]);

  // Saving: debounced while things change, immediately when the page hides.
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void saveState(state), SAVE_DEBOUNCE_MS);
  }, [state]);
  useEffect(() => {
    const flush = () => {
      clearTimeout(timer.current);
      flushState(latest.current);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [latest]);

  // Another tab saved: merge its learner data into ours.
  useEffect(
    () =>
      onOtherTabSave(() => {
        void readRaw().then((json) => {
          const remote = json ? parseState(json, latest.current.device) : null;
          if (!remote) return;
          // Its pending ratings too (another tab of this browser): a rating or undo there
          // counts here, and commits once whichever tab gets to it.
          actions.mergeRemote(remote.learner, remote.pending, remote.prefs);
          // Two tabs saving at once: the other's write may have been based on a copy from
          // before ours, and dropped our progress. If storage lacks anything we have, save
          // again (a save merges what's stored), or it would be lost when this tab closes.
          const ours = latest.current;
          const missing =
            mergeLearner(remote.learner, ours.learner) !== remote.learner ||
            mergePending(remote.pending, ours.pending, () => false, clock.now()) !== remote.pending ||
            mergePrefs(remote.prefs, ours.prefs) !== remote.prefs;
          if (missing) void saveState(ours);
        });
      }),
    [actions, latest],
  );

  // Ratings count once their five-minute window closes.
  useEffect(() => {
    actions.commit();
    const id = setInterval(actions.commit, COMMIT_EVERY_MS);
    return () => clearInterval(id);
  }, [actions]);

  const value = useMemo(() => ({ state, actions }), [state, actions]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const value = useContext(StoreContext);
  if (!value) throw new Error('useStore must be used inside StoreProvider');
  return value;
}

/** UI copy in the learner's native language. */
export function useCopy(): Copy {
  return copyForNative(useStore().state.learner.profile.nativeLang);
}

/** Re-renders every `intervalMs` so time-derived numbers stay current. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(clock.now);
  useEffect(() => {
    const id = setInterval(() => setNow(clock.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
