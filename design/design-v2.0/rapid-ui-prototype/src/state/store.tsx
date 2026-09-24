import { createContext, ReactNode, RefObject, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useLatest } from '../lib/useLatest';
import { copyForNative, Copy } from '../copy';
import { OWN_SET_PREFIX } from './catalog';
import { clock } from './clock';
import { initialState } from './initial';
import { AppEvent, transition } from './machine';
import { loadState, parseState, saveState, STORAGE_KEY } from './persistence';
import { currentPhraseId } from './selectors';
import type { AppState, AudioFailure, Grade, LearnerState, Prefs, Profile } from './types';

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
    rate: (grade: Grade) => dispatch({ type: 'RATE', grade, now: now() }),
    unrate: () => dispatch({ type: 'UNRATE', now: now() }),
    commit: () => dispatch({ type: 'COMMIT', now: now() }),
    setPrefs: (prefs: Partial<Prefs>) => dispatch({ type: 'SET_PREFS', prefs }),
    toggleShuffle: () => dispatch({ type: 'TOGGLE_SHUFFLE', seed: newSeed() }),
    reorderUpNext: (phraseIds: string[]) => dispatch({ type: 'REORDER_UP_NEXT', phraseIds }),
    removeFromQueue: (position: number) => dispatch({ type: 'REMOVE_FROM_QUEUE', position }),
    insertInQueue: (position: number, phraseId: string) => dispatch({ type: 'INSERT_IN_QUEUE', position, phraseId }),
    enqueue: (phraseIds: string[], setId: string | null, at: 'next' | 'end') =>
      dispatch({ type: 'ENQUEUE', phraseIds, setId, at, now: now() }),
    clearQueue: () => dispatch({ type: 'CLEAR_QUEUE' }),
    toggleLike: (kind: 'phrase' | 'set', id: string) => dispatch({ type: 'TOGGLE_LIKE', kind, id, now: now() }),
    addOwnPhrase: (target: string, native: string) => dispatch({ type: 'ADD_OWN_PHRASE', target, native, now: now() }),
    deleteOwnPhrase: (id: string) => dispatch({ type: 'DELETE_OWN_PHRASE', id, now: now() }),
    /** Creates a set and returns its id (the machine takes ids from the device counter). */
    createSet: (title: string, phraseIds: string[]): string => {
      const { device } = latest.current;
      const id = `${OWN_SET_PREFIX}${device.id}.${device.instance}-${(device.seq + 1).toString(36)}`;
      dispatch({ type: 'CREATE_SET', title, phraseIds, now: now() });
      return id;
    },
    addToSet: (setId: string, phraseIds: string[]) => dispatch({ type: 'ADD_TO_SET', setId, phraseIds, now: now() }),
    removeFromSet: (setId: string, phraseId: string) => dispatch({ type: 'REMOVE_FROM_SET', setId, phraseId, now: now() }),
    renameSet: (setId: string, title: string) => dispatch({ type: 'RENAME_SET', setId, title, now: now() }),
    deleteSet: (setId: string) => dispatch({ type: 'DELETE_SET', setId, now: now() }),
    setProfile: (profile: Partial<Omit<Profile, 'updatedAt'>>) => dispatch({ type: 'SET_PROFILE', profile, now: now() }),
    mergeRemote: (learner: LearnerState) => dispatch({ type: 'MERGE_REMOTE', learner }),
    reset: () => dispatch({ type: 'RESET' }),
  };
}

export type Actions = ReturnType<typeof makeActions>;

interface StoreValue {
  state: AppState;
  actions: Actions;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(transition, undefined, () =>
    loadState((device) => initialState(device.id, device.instance)),
  );
  const latest = useLatest(state);
  const actions = useMemo(() => makeActions(dispatch, latest), [latest]);

  // Saving: debounced while things change, immediately when the page hides.
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => saveState(state), SAVE_DEBOUNCE_MS);
  }, [state]);
  useEffect(() => {
    const flush = () => {
      clearTimeout(timer.current);
      saveState(latest.current);
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
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY || !event.newValue) return;
      const remote = parseState(event.newValue, latest.current.device);
      if (remote) actions.mergeRemote(remote.learner);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [actions, latest]);

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

export function useCurrentPhraseId(): string | null {
  return currentPhraseId(useStore().state.player);
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
