// Keeps a signed-in learner's progress in their account (plan 106): on signing in, when the app
// comes back to the foreground, and a little after each change. What the account had from another
// device merges into this one. Offline, it waits: the device's own copy is always the one that plays.
import { useEffect, useRef } from 'react';
import { AppState as AppLifecycle } from 'react-native';
import { syncProgress } from '@shared/api/progress';
import { useLatest } from '@shared/lib/useLatest';
import { useAccount } from './account';
import { useStore } from './store';

/** Changes are sent this long after the last one, so a session of ratings is one write. */
const AFTER_CHANGE_MS = 20_000;

export function useProgressSync(): void {
  const { state, actions } = useStore();
  const { status, account } = useAccount();
  const learner = useLatest(state.learner);
  const running = useRef(false);

  const run = useLatest(async () => {
    if (running.current || status !== 'signedIn') return;
    running.current = true;
    try {
      const before = learner.current;
      const merged = await syncProgress(before);
      if (merged !== before) actions.mergeRemote(merged);
    } catch {
      // Offline or refused: the next change, foreground or sign-in tries again.
    } finally {
      running.current = false;
    }
  });

  // Signing in (or in as someone else) merges at once.
  useEffect(() => {
    if (status === 'signedIn') void run.current();
  }, [status, account?.userId, run]);

  // A while after the learner's progress changes.
  useEffect(() => {
    if (status !== 'signedIn') return;
    const timer = setTimeout(() => void run.current(), AFTER_CHANGE_MS);
    return () => clearTimeout(timer);
  }, [state.learner, status, run]);

  useEffect(() => {
    const subscription = AppLifecycle.addEventListener('change', (next) => {
      if (next === 'active') void run.current();
    });
    return () => subscription.remove();
  }, [run]);
}
