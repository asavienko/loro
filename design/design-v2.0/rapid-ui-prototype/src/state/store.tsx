import { createContext, ReactNode, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useLatest } from '../lib/useLatest';
import { copyForNative, Copy } from '../copy';
import { clock } from './clock';
import { initialState } from './initial';
import { transition } from './machine';
import { mergeLearner, mergePending, mergePrefs } from './merge';
import { flushState, loadState, parseState, saveState } from './persistence';
import { onOtherTabSave, readRaw, Stored } from './storage';
import type { AppState } from './types';
import { Actions, makeActions } from './actions';

export type { Actions } from './actions';

/** Saves wait this long for more changes; a hidden page saves at once. */
const SAVE_DEBOUNCE_MS = 400;
/** Pending ratings are checked this often and counted once their window closes. */
const COMMIT_EVERY_MS = 15_000;

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
