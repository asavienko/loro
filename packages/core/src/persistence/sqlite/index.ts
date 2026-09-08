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
import { readText } from '../driver.js'
import { migrate } from '../migrations.js'
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
    outbox: new SqlOutboxTable(driver, userId),
    wipe: () => {
      wipeOwner(driver, userId)
    },
  }
}

/**
 * Clear one learner without erasing another owner's records or reusing an outbox seq.
 * A late acknowledgement for an erased op must never match a later local write.
 * Installation-wide metadata belongs to the default local learner; explicit owners do
 * not own those tables. Account binding, device identity and clock survive a local wipe
 * so erasure cannot change which account may upload this installation's future writes.
 * This clears logical records, not forensic storage remnants.
 */
function wipeOwner(driver: SqlDriver, userId: string): void {
  driver.transaction(() => {
    const tables = driver.all(
      `SELECT name FROM sqlite_master WHERE type = 'table'
       AND name NOT LIKE 'sqlite_%' AND name != 'schema_version'`,
    )
    for (const row of tables) {
      const name = readText(row, 'name')
      const table = `"${name.replaceAll('"', '""')}"`
      const ownerScoped = driver
        .all(`PRAGMA table_info(${table})`)
        .some((column) => column['name'] === 'user_id')
      if (ownerScoped) driver.run(`DELETE FROM ${table} WHERE user_id = ?`, [userId])
      else if (userId === LOCAL_USER_ID) {
        if (name === 'kv') {
          driver.exec(`DELETE FROM kv WHERE k NOT IN ('sync.account', 'device_id', 'last_hlc')`)
        } else if (name === 'sync_state') {
          // An active sync store retains its singleton across a local learning reset.
          driver.exec(
            'UPDATE sync_state SET cursor=NULL, failures=0, next_attempt_at=0, server_hlc=NULL WHERE id=1',
          )
        } else driver.exec(`DELETE FROM ${table}`)
      }
    }
  })
}
