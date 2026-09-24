import React, { createContext, useContext, useEffect, useMemo, useReducer, useState } from 'react';
import { clock } from './clock';
import { AppState, currentPhraseId, Speed, transition } from './machine';
import { Grade } from './memory';
import { loadState, saveState } from './persistence';

const newSeed = () => Math.floor(Math.random() * 2 ** 32);

function useActions(dispatch: React.Dispatch<Parameters<typeof transition>[1]>) {
  return useMemo(
    () => ({
      load: (phraseIds: string[], setId: string | null, startIndex = 0) =>
        dispatch({ type: 'LOAD', phraseIds, setId, startIndex, now: clock.now(), seed: newSeed() }),
      play: () => dispatch({ type: 'PLAY', now: clock.now() }),
      pause: () => dispatch({ type: 'PAUSE', now: clock.now() }),
      phaseDone: (cycle: number, result: { measuredMsAt1x?: number; failedLang?: string } = {}) =>
        dispatch({ type: 'PHASE_DONE', cycle, ...result, now: clock.now() }),
      next: () => dispatch({ type: 'NEXT', now: clock.now() }),
      prev: () => dispatch({ type: 'PREV', now: clock.now() }),
      jump: (index: number) => dispatch({ type: 'JUMP', index, now: clock.now() }),
      rate: (grade: Grade) => dispatch({ type: 'RATE', grade, now: clock.now() }),
      setSpeed: (speed: Speed) => dispatch({ type: 'SET_SPEED', speed }),
      toggleRepeat: () => dispatch({ type: 'TOGGLE_REPEAT' }),
      toggleShuffle: () => dispatch({ type: 'TOGGLE_SHUFFLE', seed: newSeed() }),
      reorderUpNext: (phraseIds: string[]) => dispatch({ type: 'REORDER_UP_NEXT', phraseIds }),
      removeFromQueue: (position: number) => dispatch({ type: 'REMOVE_FROM_QUEUE', position }),
      enqueue: (phraseIds: string[], setId: string | null) => dispatch({ type: 'ENQUEUE', phraseIds, setId }),
      toggleSavePhrase: (phraseId: string) => dispatch({ type: 'TOGGLE_SAVE_PHRASE', phraseId }),
      toggleLikeSet: (setId: string) => dispatch({ type: 'TOGGLE_LIKE_SET', setId }),
      restore: (state: AppState) => dispatch({ type: 'RESTORE', state }),
      reset: () => dispatch({ type: 'RESET' }),
    }),
    [dispatch],
  );
}

export type Actions = ReturnType<typeof useActions>;

interface StoreValue {
  state: AppState;
  actions: Actions;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(transition, undefined, loadState);
  const actions = useActions(dispatch);

  useEffect(() => {
    saveState(state);
  }, [state]);

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

/** Re-renders every `intervalMs` so time-derived numbers (retention, elapsed) stay current. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(clock.now);
  useEffect(() => {
    const id = setInterval(() => setNow(clock.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
