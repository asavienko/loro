/**
 * A `SqlDriver` over Node's built-in SQLite.
 *
 * This is how the schema, the migrations, the repositories, and the outbox are tested
 * against **real SQLite** with no native build: `node:sqlite` ships with Node 22, so the
 * SQL that will run on a device runs in CI today. It is the reason plan 10's logic could
 * land before plan 09's toolchain.
 *
 * Test-only. Nothing in the app imports it, so Metro never sees `node:sqlite`; the device
 * driver will be `driver.opsqlite.ts`, written against the same interface.
 */

import { DatabaseSync } from 'node:sqlite'
import type { SqlDriver, SqlRow, SqlValue } from '@loro/core'
import { withSavepoints } from './savepoints'

export interface NodeSqliteDriver extends SqlDriver {
  /** Escape hatch for a test that needs to assert on the schema itself. */
  readonly db: DatabaseSync
}

export function openNodeSqlite(path = ':memory:'): NodeSqliteDriver {
  const db = new DatabaseSync(path)
  // Foreign keys off by default in SQLite; the schema's guarantees are in its indexes and
  // CHECK constraints, but turning this on matches what op-sqlite will be configured with.
  db.exec('PRAGMA foreign_keys = ON;')

  // Nested `transaction()` calls use savepoints so an inner rollback cannot silently
  // commit the outer one. `migrate()` and `compact()` both wrap work, and a caller may
  // reasonably wrap either.
  return {
    db,

    exec(sql) {
      db.exec(sql)
    },

    run(sql, params = []) {
      db.prepare(sql).run(...(params as unknown[]))
    },

    all(sql, params = []) {
      return db
        .prepare(sql)
        .all(...(params as unknown[]))
        .map(toRow)
    },

    transaction: withSavepoints((sql) => {
      db.exec(sql)
    }),

    close() {
      db.close()
    },
  }
}

/**
 * Coerce one row into the driver's value domain.
 *
 * `bigint` appears when a column holds an integer outside the double-safe range, and
 * silently casting it would corrupt the value. Nothing in this schema is that large, so an
 * appearance means a bug worth failing on.
 */
function toRow(raw: Record<string, unknown>): SqlRow {
  const row: Record<string, SqlValue> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (value === null || typeof value === 'string' || typeof value === 'number') {
      row[key] = value
    } else if (typeof value === 'bigint') {
      throw new Error(`column ${key} returned a bigint (${value.toString()}) — out of range`)
    } else if (value === undefined) {
      row[key] = null
    } else {
      throw new Error(`column ${key} returned an unsupported type: ${typeof value}`)
    }
  }
  return row
}
