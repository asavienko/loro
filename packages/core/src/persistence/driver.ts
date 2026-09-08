/**
 * The SQL driver contract.
 *
 * One narrow interface so the same schema, migrations, repositories, and outbox run
 * against every SQLite the project needs:
 *
 *   • `op-sqlite`   — the native app's custom SQLite module.
 *   • `sql.js`      — browser SQLite with atomic durable snapshots.
 *   • `node:sqlite` — in tests. Real SQLite, real SQL, no native build
 *                     (apps/mobile/src/data/driver.node.ts).
 *
 * Deliberately SYNCHRONOUS. Offline-first means "every write succeeds locally"
 * (docs/architecture/offline.md); a promise on the write path invites a caller to await
 * something, and the thing they would eventually await is the network. Both SQLite
 * bindings above expose synchronous execution, so nothing is lost.
 *
 * This package performs no I/O of its own — the driver is injected, and everything here
 * is SQL text and pure row mapping.
 */

/** What SQLite actually stores. Booleans are 0/1 and objects are JSON text. */
export type SqlValue = string | number | null

export type SqlRow = Readonly<Record<string, SqlValue>>

export interface SqlDriver {
  /** Run one or more statements with no parameters and no results (DDL, PRAGMA). */
  exec(sql: string): void

  /** Run one parameterised statement for its effect. */
  run(sql: string, params?: readonly SqlValue[]): void

  /** Run one parameterised query and return every row. */
  all(sql: string, params?: readonly SqlValue[]): SqlRow[]

  /**
   * Run `fn` inside a transaction: commit on return, roll back on throw.
   *
   * The outbox depends on this being a real transaction. A row write and its outbox op
   * must land together or not at all — a crash between the two is a learner's edit that
   * never syncs, and nothing later can detect it.
   */
  transaction<T>(fn: () => T): T

  close(): void
}

// ─────────────────────────────────────────────────────────────────────────────
// Query helpers
//
// `all()` is the driver's only read, so "the one row I asked for" and "an IN-list of
// n values" are spelled out at every call site otherwise. Both were, seven and three
// times respectively, and the hand-written IN-list carried a magic count.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The first row of a query, or `null` when it returned none.
 *
 * `null` rather than `undefined` because every caller is answering "is there a row?",
 * and `noUncheckedIndexedAccess` makes `rows[0]` a three-line dance each time.
 */
export function firstRow(
  driver: SqlDriver,
  sql: string,
  params?: readonly SqlValue[],
): SqlRow | null {
  return driver.all(sql, params)[0] ?? null
}

/** `?, ?, ?` — n bind placeholders, for an IN-list or a VALUES clause. */
export function placeholders(n: number): string {
  return Array.from({ length: n }, () => '?').join(', ')
}

// ─────────────────────────────────────────────────────────────────────────────
// Row helpers
//
// SQLite is dynamically typed and a driver may hand back a number where the column
// says TEXT. These read a row defensively rather than casting, because the alternative
// is a `NaN` reaching a learner's progress screen.
// ─────────────────────────────────────────────────────────────────────────────

export function readText(row: SqlRow, column: string): string {
  const v = row[column]
  if (typeof v === 'string') return v
  if (typeof v === 'number') return String(v)
  throw new Error(`column ${column} is not text: ${JSON.stringify(v)}`)
}

export function readTextOrNull(row: SqlRow, column: string): string | null {
  const v = row[column]
  if (v === null || v === undefined) return null
  return readText(row, column)
}

export function readInt(row: SqlRow, column: string): number {
  const v = row[column]
  if (typeof v === 'number') return Math.trunc(v)
  if (typeof v === 'string' && /^-?\d+$/.test(v)) return Number(v)
  throw new Error(`column ${column} is not an integer: ${JSON.stringify(v)}`)
}

export function readIntOrNull(row: SqlRow, column: string): number | null {
  const v = row[column]
  if (v === null || v === undefined) return null
  return readInt(row, column)
}

export function readRealOrNull(row: SqlRow, column: string): number | null {
  const v = row[column]
  if (v === null || v === undefined) return null
  if (typeof v === 'number') return v
  const n = Number(v)
  if (Number.isNaN(n)) throw new Error(`column ${column} is not a number: ${v}`)
  return n
}

export function readBool(row: SqlRow, column: string): boolean {
  return readInt(row, column) !== 0
}

export const boolToSql = (b: boolean): number => (b ? 1 : 0)

/** JSON columns. A malformed value throws rather than silently reading as empty. */
export function readJson<T>(row: SqlRow, column: string, fallback: T): T {
  const raw = readTextOrNull(row, column)
  if (raw === null || raw === '') return fallback
  return JSON.parse(raw) as T
}
