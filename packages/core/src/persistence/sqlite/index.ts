import { SqlCourseTable } from './course.js'
/**
 * The SQL implementations, one module per table.
 *
 * Raw SQL rather than an ORM, deliberately: the schema is authored in
 * docs/architecture/data-model.md and each module must be readable against it column by
 * column. It also keeps the layer driver-agnostic — the same statements run under
 * `op-sqlite` on device and `node:sqlite` in tests, which is what makes any of this
 * verifiable before the native toolchain exists.
 *
 * The split is by TABLE because that is where change actually arrives: a column is added
 * to `user_phrase`, or the outbox's folding rules move, and nothing else needs reading.
 * What the tables genuinely share is the driver's query and row helpers, not a query
 * builder — five tables with fifteen statements between them do not have a grammar.
 */

import type { SqlDriver } from '../driver.js'
import { dropAll, migrate } from '../migrations.js'
import { LOCAL_USER_ID, type Persistence } from '../tables.js'
import { SqlPhraseTable } from './phrase.js'
import { SqlSettingsTable } from './settings.js'
import { SqlRefrainDayTable } from './refrainDay.js'
import { SqlPracticeDayTable } from './practiceDay.js'
import { SqlOutboxTable } from './outbox.js'

export { SqlPhraseTable } from './phrase.js'
export { SqlSettingsTable } from './settings.js'
export { SqlRefrainDayTable } from './refrainDay.js'
export { SqlPracticeDayTable } from './practiceDay.js'
export { SqlOutboxTable } from './outbox.js'
export type { SyncedTableDeps, TableDeps } from './deps.js'

/**
 * Open a persistence set over a driver, applying migrations first.
 *
 * @param hlc from `core-rs` — see `OutboxAppend.hlc`.
 * @param at epoch ms, for the migration record.
 */
export function openSqlPersistence(
  driver: SqlDriver,
  hlc: () => string,
  at: number,
  userId: string = LOCAL_USER_ID,
): Persistence {
  migrate(driver, at)
  // `refrain_day` and `streak_day` have no `updated_hlc` column, so they are handed no
  // clock to stamp with — see `deps.ts`.
  const deps = { driver, userId }
  const synced = { ...deps, hlc }
  return {
    courses: new SqlCourseTable(deps),
    phrases: new SqlPhraseTable(synced),
    settings: new SqlSettingsTable(synced),
    refrainDay: new SqlRefrainDayTable(deps),
    practiceDays: new SqlPracticeDayTable(deps),
    outbox: new SqlOutboxTable(driver),
    wipe: () => {
      // Drop and recreate rather than DELETE: a dropped table leaves no rows to recover
      // from the freelist, which is what erasure has to mean.
      dropAll(driver)
      migrate(driver, at)
    },
  }
}
