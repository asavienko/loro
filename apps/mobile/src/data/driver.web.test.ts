import initSqlJs from 'sql.js/dist/sql-asm.js'
import { beforeAll, describe, expect, it } from 'vitest'
import type { SqlJsStatic } from 'sql.js'
import { createBrowserSqlite, WEB_DATABASE_KEY, type BrowserStorage } from './driver.web'

let SQL: SqlJsStatic
beforeAll(async () => {
  SQL = await initSqlJs()
})

function storage(): BrowserStorage & { fail: boolean } {
  const values = new Map<string, string>()
  return {
    fail: false,
    getItem: (key) => values.get(key) ?? null,
    setItem(key, value) {
      if (this.fail) throw new Error('QuotaExceededError')
      values.set(key, value)
    },
  }
}

describe('durable browser SQLite', () => {
  it('reopens committed SQL rows in a new SQLite instance', () => {
    const disk = storage()
    const first = createBrowserSqlite(SQL, disk)
    first.transaction(() => {
      first.exec('CREATE TABLE progress(id TEXT PRIMARY KEY, reps INTEGER)')
      first.run('INSERT INTO progress VALUES (?, ?)', ['phrase', 7])
    })
    first.close()
    const reopened = createBrowserSqlite(SQL, disk)
    expect(reopened.all('SELECT * FROM progress')).toEqual([{ id: 'phrase', reps: 7 }])
    reopened.close()
  })

  it('rolls back live state and durable bytes when browser quota rejects a commit', () => {
    const disk = storage()
    const driver = createBrowserSqlite(SQL, disk)
    driver.exec('CREATE TABLE progress(reps INTEGER); INSERT INTO progress VALUES (3)')
    const before = disk.getItem(WEB_DATABASE_KEY)
    disk.fail = true
    expect(() => {
      driver.run('UPDATE progress SET reps = 4')
    }).toThrow('QuotaExceededError')
    expect(driver.all('SELECT reps FROM progress')).toEqual([{ reps: 3 }])
    expect(disk.getItem(WEB_DATABASE_KEY)).toBe(before)
    disk.fail = false
    driver.run('UPDATE progress SET reps = 5')
    driver.close()
    const reopened = createBrowserSqlite(SQL, disk)
    expect(reopened.all('SELECT reps FROM progress')).toEqual([{ reps: 5 }])
    reopened.close()
  })

  it('a caught nested transaction failure does not discard the outer work', () => {
    const driver = createBrowserSqlite(SQL, storage())
    driver.exec('CREATE TABLE progress(id TEXT)')
    driver.transaction(() => {
      driver.run('INSERT INTO progress VALUES (?)', ['before'])
      expect(() =>
        driver.transaction(() => {
          driver.run('INSERT INTO progress VALUES (?)', ['rolled back'])
          throw new Error('interrupted')
        }),
      ).toThrow('interrupted')
      driver.run('INSERT INTO progress VALUES (?)', ['after'])
    })
    expect(driver.all('SELECT id FROM progress')).toEqual([{ id: 'before' }, { id: 'after' }])
    driver.close()
  })

  it('retains a corrupt saved file and refuses to silently replace it', () => {
    const disk = storage()
    disk.setItem(WEB_DATABASE_KEY, 'not a base64 SQLite file')
    expect(() => createBrowserSqlite(SQL, disk)).toThrow()
    expect(disk.getItem(WEB_DATABASE_KEY)).toBe('not a base64 SQLite file')
  })

  it('rejects a stale browser snapshot instead of overwriting another writer', () => {
    const disk = storage()
    const first = createBrowserSqlite(SQL, disk)
    first.exec('CREATE TABLE progress(reps INTEGER); INSERT INTO progress VALUES (1)')
    const stale = createBrowserSqlite(SQL, disk)
    first.run('UPDATE progress SET reps = 2')
    expect(() => {
      stale.run('UPDATE progress SET reps = 3')
    }).toThrow('another browser tab')
    stale.close()
    first.close()
    const reopened = createBrowserSqlite(SQL, disk)
    expect(reopened.all('SELECT reps FROM progress')).toEqual([{ reps: 2 }])
    reopened.close()
  })
})
