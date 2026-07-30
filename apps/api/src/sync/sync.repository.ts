/**
 * The sync store, behind an interface.
 *
 * It used to be a `Map` at module scope inside the controller, which meant the
 * arbitration logic reached for a specific storage mechanism and no other one could be
 * substituted — not Postgres (plans/13), and not a fresh instance per test. It is now
 * injected, so the store is a choice made in `app.module.ts` and the merge logic does
 * not know which one it got (DIP).
 *
 * Promise-returning even though the in-memory implementation answers immediately. A
 * synchronous interface would be one that Postgres cannot implement, which is the only
 * implementation this seam exists for.
 *
 * DELIBERATELY NOT user-scoped or cursor-paged. Every learner still shares one
 * namespace and `all()` still returns everything — that is
 * plans/06-fix-sync-pull-cursor-and-scoping.md's bug to fix, and it needs auth to scope
 * with. Adding a `userId` parameter now, with nothing to populate it, would be a lie in
 * the signature. What this seam does buy plan 06 is that the fix lands in one
 * implementation behind a stable interface rather than in the controller.
 *
 * See docs/architecture/sync-protocol.md
 */

import type { StoredRow } from './merge.js'

export interface SyncRepository {
  /** The row as last merged, or `undefined` if this key has never been pushed. */
  get(entity: string, id: string): Promise<StoredRow | undefined>

  /** Store the merged row. The key is `(entity, id)`, taken from the row itself. */
  put(row: StoredRow): Promise<void>

  /**
   * Every row. plans/06 replaces this with a user-scoped, cursor-paged `since()`; the
   * name is `all()` rather than `since()` so it cannot be mistaken for a delta read.
   */
  all(): Promise<StoredRow[]>

  /** How many rows are stored. Reported by the `/sync/status` diagnostic. */
  count(): Promise<number>
}

/** Nest DI token. An interface has no runtime value to inject by. */
export const SYNC_REPOSITORY = 'SYNC_REPOSITORY'
