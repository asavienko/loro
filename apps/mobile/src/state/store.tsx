// The app's state: the web prototype's own state machine, actions and persistence (@shared/state),
// run in React Native. Only the lifecycle differs from the web store (its src/state/store.tsx):
// the app going to the background saves at once, where the web listens for the page hiding.
import { createContext, ReactNode, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { AppState as AppLifecycle } from 'react-native';
import { contentRevision, onContentChange } from '@shared/content';
import { copyForNative, Copy } from '@shared/copy';
import { Actions, makeActions } from '@shared/state/actions';
import { clock } from '@shared/state/clock';
import { initialState } from '@shared/state/initial';
import { transition } from '@shared/state/machine';
import { mergeLearner, mergePending, mergePrefs } from '@shared/state/merge';
import { flushState, loadState, parseState, saveState, SaveResult } from '@shared/state/persistence';
import { onOtherTabSave, readRaw, Stored } from '@shared/state/storage';
import type { AppState } from '@shared/state/types';
import { useLatest } from '@shared/lib/useLatest';

export type { Actions } from '@shared/state/actions';

/** Saves wait this long for more changes; going to the background saves at once. */
const SAVE_DEBOUNCE_MS = 400;
/** Pending ratings are checked this often and counted once their window closes. */
const COMMIT_EVERY_MS = 15_000;

interface StoreValue {
  state: AppState;
  actions: Actions;
  /** The last save that didn't reach storage, for the shell to say once. */
  saveProblem: SaveResult | null;
  /** Changes when content from the API is installed, so every screen reads it again (plan 106). */
  content: number;
}

const StoreContext = createContext<StoreValue | null>(null);

/** `stored` is what storage held before the first render (app/_layout.tsx). */
export function StoreProvider({ children, stored }: { children: ReactNode; stored: Stored }) {
  const [state, dispatch] = useReducer(transition, stored, (s) => loadState(s, (device) => initialState(device.id, device.instance)));
  const latest = useLatest(state);
  const actions = useMemo(() => makeActions(dispatch, latest), [latest]);
  const [saveProblem, setSaveProblem] = useState<SaveResult | null>(null);
  const record = (result: SaveResult) => setSaveProblem(result === 'saved' ? null : result);
  const recordRef = useLatest(record);

  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void saveState(state).then((r) => recordRef.current(r)), SAVE_DEBOUNCE_MS);
  }, [state, recordRef]);

  useEffect(() => {
    const subscription = AppLifecycle.addEventListener('change', (next) => {
      if (next === 'active') return;
      clearTimeout(timer.current);
      flushState(latest.current);
    });
    return () => subscription.remove();
  }, [latest]);

  // On the web, another tab's save merges in, as in the web prototype; native has one copy.
  useEffect(
    () =>
      onOtherTabSave(() => {
        void readRaw().then((json) => {
          const remote = json ? parseState(json, latest.current.device) : null;
          if (!remote) return;
          actions.mergeRemote(remote.learner, remote.pending, remote.prefs);
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

  useEffect(() => {
    actions.commit();
    const id = setInterval(actions.commit, COMMIT_EVERY_MS);
    return () => clearInterval(id);
  }, [actions]);

  const [content, setContent] = useState(contentRevision);
  useEffect(() => onContentChange(() => setContent(contentRevision())), []);

  const value = useMemo(() => ({ state, actions, saveProblem, content }), [state, actions, saveProblem, content]);
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
