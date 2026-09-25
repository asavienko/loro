// Merging two copies of learner state — another tab, another device, the
// server — without losing either side's progress.
//
// Field classes (the same idea as packages/core/src/sync/fieldPolicy.ts):
// - log: grow-only set. The union of entries by id; memory and points are
//   re-derived from it, so a review made on either device counts once.
// - likes, own phrases, own sets: last writer wins per item, by its own
//   timestamp (a tie goes the same way on every device). Deletion is a
//   tombstone (`deleted: true`), so it merges too.
// - profile: last writer wins as a whole, by `updatedAt`.
// - pending ratings (tabs of one browser): last change wins per phrase key, by
//   `changedAt`; an undo is a tombstone (`undone: true`) until its window closes.
//   A rating already committed to the log is dropped, so storage doesn't keep it.
// Prefs and the player are per tab and never merged.
import { compareEntries, RATING_WINDOW_MS } from './memory';
import type { LearnerState, Like, LogEntry, PendingRating } from './types';

/** The log id a pending rating commits under: the same in every tab of this browser. */
export function ratingCommitId(deviceId: string, p: PendingRating): string {
  return `${deviceId}.r-${p.key}-${p.at.toString(36)}`;
}

/** Whether a pending rating is already in `log`: its id built once, not per entry (a year's log is long). */
export function committedIn(log: LogEntry[], deviceId: string): (p: PendingRating) => boolean {
  return (p) => {
    const id = ratingCommitId(deviceId, p);
    return log.some((e) => e.id === id);
  };
}

/**
 * This tab's pending ratings merged with another tab's. `committed` says whether a rating is
 * already in the log (it then stays out); returns `ours` itself when nothing changes.
 */
export function mergePending(ours: PendingRating[], theirs: PendingRating[], committed: (p: PendingRating) => boolean, now: number): PendingRating[] {
  let out = ours;
  for (const t of theirs) {
    if (committed(t) || (t.undone && now - t.at >= RATING_WINDOW_MS)) continue;
    const at = out.findIndex((o) => o.key === t.key);
    if (at === -1) {
      out = [...out, t];
    } else if (wins(t, out[at], (p) => p.changedAt)) {
      out = out.map((o, i) => (i === at ? t : o));
    }
  }
  return out;
}

function mergeLog(a: LogEntry[], b: LogEntry[]): LogEntry[] {
  const ids = new Set(a.map((e) => e.id));
  const added = b.filter((e) => !ids.has(e.id));
  if (added.length === 0) return a;
  return [...a, ...added].sort(compareEntries);
}

/**
 * Whether `theirs` beats `ours`: the later write, and on a tie the same winner on
 * every device (by content), so two copies can't each keep their own forever.
 */
function wins<T>(theirs: T, ours: T, time: (x: T) => number): boolean {
  const [t, o] = [time(theirs), time(ours)];
  return t > o || (t === o && JSON.stringify(theirs) > JSON.stringify(ours));
}

function mergeByTime<T>(a: Record<string, T>, b: Record<string, T>, time: (x: T) => number): Record<string, T> {
  let out = a;
  for (const [id, theirs] of Object.entries(b)) {
    const ours = a[id];
    if (ours === undefined || wins(theirs, ours, time)) {
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
  const profile = wins(remote.profile, local.profile, (p) => p.updatedAt) ? remote.profile : local.profile;
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
