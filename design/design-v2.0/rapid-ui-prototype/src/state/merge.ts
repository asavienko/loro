// Merging two copies of learner state — another tab, another device, the
// server — without losing either side's progress.
//
// Field classes (the same idea as packages/core/src/sync/fieldPolicy.ts):
// - log: grow-only set. The union of entries by id; memory and points are
//   re-derived from it, so a review made on either device counts once.
// - likes, own phrases, own sets: last writer wins per item, by its own
//   timestamp. Deletion is a tombstone (`deleted: true`), so it merges too.
// - profile: last writer wins as a whole, by `updatedAt`.
// Pending ratings, prefs and the player are per device and never merged.
import { compareEntries } from './memory';
import type { LearnerState, Like, LogEntry } from './types';

function mergeLog(a: LogEntry[], b: LogEntry[]): LogEntry[] {
  const ids = new Set(a.map((e) => e.id));
  const added = b.filter((e) => !ids.has(e.id));
  if (added.length === 0) return a;
  return [...a, ...added].sort(compareEntries);
}

function mergeByTime<T>(a: Record<string, T>, b: Record<string, T>, time: (x: T) => number): Record<string, T> {
  let out = a;
  for (const [id, theirs] of Object.entries(b)) {
    const ours = a[id];
    if (ours === undefined || time(theirs) > time(ours)) {
      if (out === a) out = { ...a };
      out[id] = theirs;
    }
  }
  return out;
}

/** Local state merged with a remote copy; returns `local` itself when nothing changes. */
export function mergeLearner(local: LearnerState, remote: LearnerState): LearnerState {
  const log = mergeLog(local.log, remote.log);
  const likes = mergeByTime<Like>(local.likes, remote.likes, (l) => l.at);
  const ownPhrases = mergeByTime(local.ownPhrases, remote.ownPhrases, (p) => p.updatedAt);
  const ownSets = mergeByTime(local.ownSets, remote.ownSets, (s) => s.updatedAt);
  const profile = remote.profile.updatedAt > local.profile.updatedAt ? remote.profile : local.profile;
  if (
    log === local.log &&
    likes === local.likes &&
    ownPhrases === local.ownPhrases &&
    ownSets === local.ownSets &&
    profile === local.profile
  ) {
    return local;
  }
  return { profile, log, likes, ownPhrases, ownSets };
}
