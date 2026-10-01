// Keeps a signed-in learner's progress in their account (plan 106): on signing in, when the app
// comes back to the foreground or goes to the background, and a little after each change (at most a
// couple of minutes after the first, so a long session of practice is saved while it goes on). What the account had from another
// device merges into this one. Offline, it waits: the device's own copy is always the one that plays.
//
// The device remembers whose progress it holds. Signing out first saves it to that account; signing
// in as someone else keeps it on the device under the first account and loads the second's, rather
// than merging one learner's history into another's (a shared phone). The first learner's kept
// progress rejoins theirs when they sign in here again.
import { useEffect, useRef } from 'react';
import { AppState as AppLifecycle } from 'react-native';
import { kvGet, kvRemove, kvSet } from '@shared/api/kv';
import { fetchProgress, syncProgress } from '@shared/api/progress';
import { useLatest } from '@shared/lib/useLatest';
import { initialLearner } from '@shared/state/initial';
import { encodeLog } from '@shared/state/compactLog';
import { mergeLearner } from '@shared/state/merge';
import { sanitizeLearner, serializeState } from '@shared/state/persistence';
import type { AppState, LearnerState } from '@shared/state/types';
import { useAccount } from './account';
import { useStore } from './store';
import { beforeSignOut, lastSync } from './syncHooks';

/** Changes are sent this long after the last one, so a session of ratings is one write... */
const AFTER_CHANGE_MS = 20_000;
/** ...but no later than this after the first unsent one: every phrase heard is a change. */
const MAX_WAIT_MS = 2 * 60_000;
const OWNER_KEY = 'loro.progress.owner';

const stashKey = (userId: string) => `loro.progress.stash.${userId}`;

/** Keeps a learner's progress on this device under their account, merged with any kept before. */
async function stash(userId: string, learner: LearnerState): Promise<void> {
  const kept = await unstash(userId);
  const merged = kept ? mergeLearner(kept, learner) : learner;
  await kvSet(stashKey(userId), JSON.stringify({ ...merged, log: encodeLog(merged.log) }));
}

async function unstash(userId: string): Promise<LearnerState | null> {
  try {
    const raw = await kvGet(stashKey(userId));
    return raw ? sanitizeLearner(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

/**
 * After an account is deleted: nothing is kept on this device under it any more, and the progress
 * here (which stays) is no longer its, so whoever signs in next on this device keeps it.
 */
export async function forgetAccountHere(userId: string): Promise<void> {
  await kvRemove(stashKey(userId));
  if ((await kvGet(OWNER_KEY)) === userId) await kvRemove(OWNER_KEY);
}

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
          // Another account's progress is on this device. It is kept here under that account (its
          // last save may not have reached it) and never merged into this one; this account's
          // progress, with anything it left on this device before, takes its place.
          const current: AppState = latest.current;
          await stash(owner, current.learner);
          const theirs = await fetchProgress();
          const left = await unstash(userId);
          let learner = theirs ?? { ...initialLearner(), profile: { ...current.learner.profile, name: '' } };
          if (left) learner = mergeLearner(learner, left);
          actions.restore(JSON.parse(serializeState({ ...current, learner, pending: [] })));
          if (left) {
            await syncProgress(learner);
            await kvRemove(stashKey(userId));
          }
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
      // A sync already under way may have started before the latest change: wait, then save again.
      await running.current?.catch(() => {});
      await run.current().catch(() => {});
    };
  }, [run]);

  // Signing in (or in as someone else) syncs at once.
  useEffect(() => {
    if (status === 'signedIn') void run.current();
  }, [status, userId, run]);

  // A while after the learner's progress changes.
  const unsentSince = useRef<number | null>(null);
  useEffect(() => {
    if (status !== 'signedIn') return;
    const now = performance.now();
    unsentSince.current ??= now;
    const timer = setTimeout(
      () => {
        unsentSince.current = null;
        void run.current();
      },
      Math.max(0, Math.min(AFTER_CHANGE_MS, unsentSince.current + MAX_WAIT_MS - now)),
    );
    return () => clearTimeout(timer);
  }, [state.learner, status, run]);

  // Back in the foreground (another device may have practised), and on the way out.
  useEffect(() => {
    const subscription = AppLifecycle.addEventListener('change', (next) => {
      if (next === 'active' || next === 'background') void run.current();
    });
    return () => subscription.remove();
  }, [run]);
}
