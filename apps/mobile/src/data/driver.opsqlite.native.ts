import { sqlStatements } from './sqlStatements'
import { open } from '@op-engineering/op-sqlite'
import type { SqlDriver, SqlRow, SqlValue } from '@loro/core'

/** Native synchronous SQLite. Nested work uses savepoints on the same connection. */
export function openOpSqlite(name = 'loro.sqlite'): SqlDriver {
  const db = open({ name })
  let depth = 0
  let closed = false
  const execute = (sql: string, params: readonly SqlValue[] = []) => {
    if (closed) throw new Error('SQLite connection is closed')
    return db.executeSync(sql, [...params])
  }
  execute('PRAGMA foreign_keys = ON')
  return {
    exec(sql) {
      for (const statement of sqlStatements(sql)) execute(statement)
    },
    run(sql, params) {
      execute(sql, params)
    },
    all(sql, params): SqlRow[] {
      return execute(sql, params).rows.map((raw) => {
        const row: Record<string, SqlValue> = {}
        for (const [key, value] of Object.entries(raw)) {
          if (value === null || typeof value === 'string' || typeof value === 'number')
            row[key] = value
          else throw new Error(`Unsupported SQLite column type: ${key}`)
        }
        return row
      })
    },
    transaction(fn) {
      const outer = depth === 0
      const savepoint = `loro_sp_${String(depth)}`
      execute(outer ? 'BEGIN IMMEDIATE' : `SAVEPOINT ${savepoint}`)
      depth++
      try {
        const value = fn()
        if (value instanceof Promise) throw new Error('SQLite transaction must be synchronous')
        execute(outer ? 'COMMIT' : `RELEASE SAVEPOINT ${savepoint}`)
        return value
      } catch (error) {
        execute(outer ? 'ROLLBACK' : `ROLLBACK TO SAVEPOINT ${savepoint}`)
        if (!outer) execute(`RELEASE SAVEPOINT ${savepoint}`)
        throw error
      } finally {
        depth--
      }
    },
    close() {
      if (depth !== 0) throw new Error('Cannot close SQLite during a transaction')
      if (!closed) {
        db.close()
        closed = true
      }
    },
  }
}
