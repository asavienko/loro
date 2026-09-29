// The learner's progress in their account (plan 106, F-04): the same learner state the device saves,
// merged as the device merges another tab's (a union of logs, the latest of each field). The server
// keeps the merged copy with a revision; a write made on an older revision is refused and merged
// again, so no device's progress is lost.
import { encodeLog } from '../state/compactLog';
import { mergeLearner } from '../state/merge';
import { sanitizeLearner } from '../state/persistence';
import type { LearnerState } from '../state/types';
import { api, ApiError } from './client';

interface Stored {
  progress: Record<string, unknown> | null;
  revision: number;
}

/** Tries this many times when another device keeps writing in between. */
const ATTEMPTS = 3;

/**
 * Merges the account's progress into `learner` and the result back into the account. Resolves to the
 * merged state, the same object as `learner` when the account had nothing new.
 */
export async function syncProgress(learner: LearnerState): Promise<LearnerState> {
  for (let attempt = 1; ; attempt++) {
    const stored = await api<Stored>('/library/progress', { auth: 'required' });
    const theirs = stored.progress ? sanitizeLearner(stored.progress) : null;
    const merged = theirs ? mergeLearner(learner, theirs) : learner;
    // The account already holds everything this device has: nothing to write.
    if (theirs && mergeLearner(theirs, learner) === theirs) return merged;
    try {
      await api('/library/progress', {
        method: 'POST',
        auth: 'required',
        body: { progress: { ...merged, log: encodeLog(merged.log) }, baseRevision: stored.revision },
      });
      return merged;
    } catch (error) {
      const conflict = error instanceof ApiError && error.status === 409;
      if (!conflict || attempt >= ATTEMPTS) throw error;
    }
  }
}
