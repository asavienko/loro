/**
 * What a SQL table is handed when it is opened.
 *
 * An object rather than a positional list, and TWO types rather than one optional field,
 * because the split is real: `refrain_day` and `streak_day` have no `updated_hlc` column
 * (see migration 1), so those tables have nothing to stamp and must not be handed a clock
 * they would have to be trusted not to use. A single `hlc?` would erase that distinction
 * and let the next table quietly acquire a dependency it doesn't have a column for.
 */

import type { SqlDriver } from '../driver.js'

export interface TableDeps {
  readonly driver: SqlDriver
  /**
   * Until accounts exist (plans/14) this is always `LOCAL_USER_ID`, but every statement
   * filters on it, so it is threaded rather than assumed.
   */
  readonly userId: string
}

export interface SyncedTableDeps extends TableDeps {
  /**
   * From `core-rs`'s HLC — never generated here. A second implementation of the clock
   * that orders sync operations is exactly the divergence ADR-0002 exists to prevent.
   */
  readonly hlc: () => string
}
