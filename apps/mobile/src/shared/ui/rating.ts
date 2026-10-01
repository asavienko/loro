// Around a rating, outside the rated item's own player: Undo for a few seconds after it is given. In
// the player that follows the rating wherever the loop has gone; on the bar above the tabs it lasts
// only while the rated item shows (moved on, the bar offers the next one's grades), then nothing
// until the item showing can be rated again. Scheduling is FSRS's alone: no surface shows the
// interval a grade gives.
import type { Grade, PendingRating } from '../state/types';

/** How long Undo is offered once a rating has left its item: on the bar, or in the player once the loop moved on. */
export const UNDO_OFFER_MS = 4000;

/**
 * The phrase loop's latest rating while its Undo is offered: given or changed less than UNDO_OFFER_MS
 * ago, and not undone. A song's ratings are the song's (see songRating).
 */
export function recentLoopRating(pending: readonly PendingRating[], now: number): PendingRating | null {
  let latest: PendingRating | null = null;
  for (const p of pending) {
    if (p.undone || p.songId !== undefined || !offered(p.changedAt, now)) continue;
    if (!latest || p.changedAt > latest.changedAt) latest = p;
  }
  return latest;
}

/**
 * The bar's Undo for the phrase showing: the loop's latest rating while its Undo is offered, and only
 * if it rated that phrase. Swiped or moved on, the bar shows the next phrase's grades instead.
 */
export function barLoopRating(pending: readonly PendingRating[], phraseId: string | null, now: number): PendingRating | null {
  const recent = recentLoopRating(pending, now);
  return recent && recent.phraseId === phraseId ? recent : null;
}

/** Whether a rating changed at `changedAt` still has its Undo offered at `now` (a moment early counts as now). */
export function offered(changedAt: number, now: number): boolean {
  return now - changedAt < UNDO_OFFER_MS;
}

/** What the bar above the tabs shows about rating. */
export type BarRating =
  /** The three grades: the item showing can be rated. */
  | { kind: 'grades' }
  /** A rating just given (or changed) at `at`: Undo, for `left` ms more. */
  | { kind: 'undo'; grade: Grade; at: number; left: number }
  /** Nothing: the item showing has a rating in its window, or nothing to rate. */
  | { kind: 'none' };

/**
 * The bar's rating: Undo for a few seconds after a rating (its item may have moved on), then nothing
 * while the item showing has a rating in its five-minute window; the grades whenever it can be rated.
 */
export function barRating(item: { ratable: boolean; rated: boolean }, recent: { grade: Grade; changedAt: number } | null, now: number): BarRating {
  if (recent && offered(recent.changedAt, now)) {
    return { kind: 'undo', grade: recent.grade, at: recent.changedAt, left: Math.min(UNDO_OFFER_MS, UNDO_OFFER_MS - (now - recent.changedAt)) };
  }
  return item.ratable && !item.rated ? { kind: 'grades' } : { kind: 'none' };
}
