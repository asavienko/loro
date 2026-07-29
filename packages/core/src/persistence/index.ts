/**
 * Local persistence — the device is the source of truth.
 *
 * See docs/architecture/offline.md and ADR-0003. The rule that shapes every file here:
 * every write succeeds locally and appends to an outbox, and **no code path awaits the
 * network**.
 *
 * ── What is here, and what is not ──
 * The schema, the forward-only migration runner, the repositories, and the outbox are
 * complete and tested against real SQLite. The **`op-sqlite` driver is not**: it is a
 * custom native module, and this checkout has no `ios/` or `android/` directory and no
 * Xcode, so it cannot be built or run until the dev client exists
 * (plans/09-native-toolchain-and-dev-client.md). Everything above is written against the
 * `SqlDriver` interface precisely so that driver is the only piece still missing.
 */

export type { SqlDriver, SqlRow, SqlValue } from './driver.js'
export { MIGRATIONS, SCHEMA_VERSION, currentVersion, migrate, dropAll } from './migrations.js'
export type { Migration, MigrationResult } from './migrations.js'
export {
  LOCAL_USER_ID,
  asPhraseRepository,
  type FieldWrite,
  type OutboxAppend,
  type OutboxOp,
  type OutboxTable,
  type Persistence,
  type PhraseTable,
  type PracticeDayTable,
  type RefrainDayRow,
  type RefrainDayTable,
  type SettingsRow,
  type SettingsTable,
  type SyncOpKind,
} from './tables.js'
export {
  SqlOutboxTable,
  SqlPhraseTable,
  SqlPracticeDayTable,
  SqlRefrainDayTable,
  SqlSettingsTable,
  openSqlPersistence,
} from './sqlite.js'
export { openMemoryPersistence } from './memory.js'
