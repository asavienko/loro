/**
 * Real SQLite for the browser, with one atomic localStorage replacement per transaction.
 * The exported SQLite file is durable browser data, not a second JSON state store.
 * Quota/storage errors roll back the live database and reach the learner; never reset on error.
 */
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js/dist/sql-asm.js'
import type { SqlDriver, SqlRow, SqlValue } from '@loro/core'
import { synchronousResult } from '@loro/core'

export const WEB_DATABASE_KEY = 'loro.sqlite.v1'
export interface BrowserStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

function encode(bytes: Uint8Array): string {
  let text = ''
  for (const byte of bytes) text += String.fromCharCode(byte)
  return btoa(text)
}

function decode(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0))
}

export function createBrowserSqlite(SQL: SqlJsStatic, storage: BrowserStorage): SqlDriver {
  const saved = storage.getItem(WEB_DATABASE_KEY)
  let db: Database = new SQL.Database(saved === null ? undefined : decode(saved))
  // sql.js opens lazily: validate the loaded file before an innocent CREATE could
  // reach the durable replacement path with corrupt input.
  if (saved !== null) {
    try {
      if (db.exec('PRAGMA quick_check')[0]?.values[0]?.[0] !== 'ok')
        throw new Error('The saved SQLite file is damaged')
    } catch (error) {
      db.close()
      throw error
    }
  }
  let lastSaved = saved
  let depth = 0
  const driver: SqlDriver = {
    exec(sql) {
      if (depth === 0) {
        driver.transaction(() => {
          driver.exec(sql)
        })
        return
      }
      db.exec(sql)
    },
    run(sql, params = []) {
      if (depth === 0) {
        driver.transaction(() => {
          driver.run(sql, params)
        })
        return
      }
      db.run(sql, [...params])
    },
    all(sql, params = []) {
      const statement = db.prepare(sql)
      try {
        statement.bind([...params])
        const rows: SqlRow[] = []
        while (statement.step()) {
          const row: Record<string, SqlValue> = {}
          for (const [key, value] of Object.entries(statement.getAsObject())) {
            if (value !== null && typeof value !== 'number' && typeof value !== 'string') {
              throw new Error(`Unsupported SQLite value in ${key}`)
            }
            row[key] = value
          }
          rows.push(row)
        }
        return rows
      } finally {
        statement.free()
      }
    },
    transaction(fn) {
      const outer = depth === 0
      if (outer && storage.getItem(WEB_DATABASE_KEY) !== lastSaved)
        throw new Error('Progress changed in another browser tab. Reload Loro.')
      // Export before BEGIN: sql.js export closes and reopens its file internally.
      const before = outer ? db.export() : null
      const savepoint = `loro_${String(depth)}`
      db.exec(outer ? 'BEGIN' : `SAVEPOINT ${savepoint}`)
      depth++
      let committed = false
      try {
        const result = synchronousResult(fn())
        db.exec(outer ? 'COMMIT' : `RELEASE SAVEPOINT ${savepoint}`)
        committed = true
        if (outer) {
          const encoded = encode(db.export())
          storage.setItem(WEB_DATABASE_KEY, encoded)
          lastSaved = encoded
        }
        return result
      } catch (error) {
        if (!committed) {
          db.exec(outer ? 'ROLLBACK' : `ROLLBACK TO SAVEPOINT ${savepoint}`)
          if (!outer) db.exec(`RELEASE SAVEPOINT ${savepoint}`)
        } else if (before !== null) {
          // COMMIT succeeded in SQLite but durable browser storage rejected the write.
          db.close()
          db = new SQL.Database(before)
        }
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

export async function openDeviceSqlite(): Promise<SqlDriver> {
  const SQL = await initSqlJs()
  // Synchronous SQL transactions cannot await a per-write browser lock. Hold the
  // origin's database lock for this tab's lifetime so two processes cannot overwrite
  // each other's SQLite snapshots. Closing/crashing the tab releases it automatically.
  if (!('locks' in navigator))
    throw new Error('This browser cannot safely lock local progress storage')
  return new Promise((resolve, reject) => {
    void navigator.locks
      .request(WEB_DATABASE_KEY, { mode: 'exclusive', ifAvailable: true }, async (lock) => {
        if (lock === null) throw new Error('Loro is already open in another browser tab')
        const driver = createBrowserSqlite(SQL, window.localStorage)
        await new Promise<void>((release) => {
          resolve({
            ...driver,
            close() {
              driver.close()
              release()
            },
          })
        })
      })
      .catch(reject)
  })
}
