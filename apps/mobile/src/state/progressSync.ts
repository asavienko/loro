// Keeps a signed-in learner's progress in their account (plan 106): on signing in, when the app
// comes back to the foreground, and a little after each change. What the account had from another
// device merges into this one. Offline, it waits: the device's own copy is always the one that plays.
//
// The device remembers whose progress it holds. Signing out first saves it to that account; signing
// in as someone else then replaces it with that account's progress rather than merging one learner's
// history into another's (a shared phone).
import { useEffect, useRef } from 'react';
import { AppState as AppLifecycle } from 'react-native';
import { kvGet, kvSet } from '@shared/api/kv';
import { fetchProgress, syncProgress } from '@shared/api/progress';
import { useLatest } from '@shared/lib/useLatest';
import { initialLearner } from '@shared/state/initial';
import { serializeState } from '@shared/state/persistence';
import type { AppState } from '@shared/state/types';
import { useAccount } from './account';
import { useStore } from './store';
import { beforeSignOut, lastSync } from './syncHooks';

/** Changes are sent this long after the last one, so a session of ratings is one write. */
const AFTER_CHANGE_MS = 20_000;
const OWNER_KEY = 'loro.progress.owner';

export function useProgressSync(): void {
  const { state, actions } = useStore();
  const { status, account } = useAccount();
  const latest = useLatest(state);
  const running = useRef<Promise<void> | null>(null);
  const userId = account?.userId ?? null;

  const run = useLatest(async () => {
    if (status !== 'signedIn' || !userId) return;
    if (running.current) return running.current;
    running.current = (async () => {
      try {
        const owner = await kvGet(OWNER_KEY);
        if (owner && owner !== userId) {
          // Another account's progress is on this device: this account's replaces it.
          const current: AppState = latest.current;
          const theirs = await fetchProgress();
          const learner = theirs ?? { ...initialLearner(), profile: { ...current.learner.profile, name: '' } };
          actions.restore(JSON.parse(serializeState({ ...current, learner, pending: [] })));
        } else {
          const before = latest.current.learner;
          const merged = await syncProgress(before);
          if (merged !== before) actions.mergeRemote(merged);
        }
        await kvSet(OWNER_KEY, userId);
        lastSync.done = true;
        lastSync.failed = false;
      } catch {
        // Offline or refused: the next change, foreground or sign-in tries again.
        lastSync.failed = true;
      } finally {
        running.current = null;
      }
    })();
    return running.current;
  });

  useEffect(() => {
    beforeSignOut.run = async () => {
      await run.current().catch(() => {});
    };
  }, [run]);

  // Signing in (or in as someone else) syncs at once.
  useEffect(() => {
    if (status === 'signedIn') void run.current();
  }, [status, userId, run]);

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
