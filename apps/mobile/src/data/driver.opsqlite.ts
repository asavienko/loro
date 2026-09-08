/** Native SQLite adapter. A native development build is required; no memory fallback on device. */
import { open } from '@op-engineering/op-sqlite'
import type { SqlDriver, SqlRow } from '@loro/core'
import { synchronousResult } from '@loro/core'

export function openDeviceSqlite(): SqlDriver {
  const db = open({ name: 'loro.sqlite' })
  db.executeSync('PRAGMA foreign_keys = ON')
  db.executeSync('PRAGMA journal_mode = WAL')
  db.executeSync('PRAGMA synchronous = FULL')
  let depth = 0
  const driver: SqlDriver = {
    exec(sql) {
      // op-sqlite's native opsqlite_execute walks sqlite3_prepare_v2's remaining SQL
      // pointer. SQLite itself owns boundaries (including triggers and quoted semicolons).
      db.executeSync(sql)
    },
    run(sql, params = []) {
      db.executeSync(sql, [...params])
    },
    all(sql, params = []) {
      return db.executeSync(sql, [...params]).rows as SqlRow[]
    },
    transaction(fn) {
      const outer = depth === 0
      const savepoint = `loro_${String(depth)}`
      db.executeSync(outer ? 'BEGIN IMMEDIATE' : `SAVEPOINT ${savepoint}`)
      depth++
      try {
        const result = synchronousResult(fn())
        db.executeSync(outer ? 'COMMIT' : `RELEASE SAVEPOINT ${savepoint}`)
        return result
      } catch (error) {
        db.executeSync(outer ? 'ROLLBACK' : `ROLLBACK TO SAVEPOINT ${savepoint}`)
        if (!outer) db.executeSync(`RELEASE SAVEPOINT ${savepoint}`)
        throw error
      } finally {
        depth--
      }
    },
    close() {
      db.close()
    },
  }
  return driver
}
