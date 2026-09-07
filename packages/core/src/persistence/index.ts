/**
 * Local persistence — the device is the source of truth.
 *
 * See docs/architecture/offline.md and ADR-0003. The rule that shapes every file here:
 * every write succeeds locally and appends to an outbox, and **no code path awaits the
 * network**.
 *
 * Repositories, forward migrations and local commit records are driver-independent.
 * Mobile installs the platform driver during bootstrap; Node SQLite exercises the same
 * transaction and migration paths in tests. Native process-death acceptance is a separate
 * device gate and must not be inferred from those tests.
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
} from './sqlite/index.js'
export { openMemoryPersistence } from './memory.js'

export * from './checkpoint.js'
export type {
  CourseRow,
  CourseTable,
  MetadataTable,
  CheckpointTable,
  AttemptTable,
  ReviewEvent,
  ReviewTable,
} from './tables.js'
