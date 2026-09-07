import { DatabaseSync } from 'node:sqlite'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@op-engineering/op-sqlite', () => ({
  open: () => {
    const db = new DatabaseSync(':memory:')
    return {
      executeSync(sql: string, params: (string | number | null)[] = []) {
        const statement = db.prepare(sql)
        return { rows: statement.all(...params) }
      },
      close() {
        db.close()
      },
    }
  },
}))
import { openOpSqlite } from './driver.opsqlite.native'

describe('op-sqlite driver contract over real SQLite', () => {
  it('executes every migration statement and isolates nested rollback', () => {
    const driver = openOpSqlite()
    driver.exec('CREATE TABLE a (v TEXT); CREATE TABLE b (v TEXT);')
    driver.transaction(() => {
      driver.run('INSERT INTO a VALUES (?)', ['outer'])
      expect(() =>
        driver.transaction(() => {
          driver.run('INSERT INTO b VALUES (?)', ['inner'])
          throw new Error('rollback')
        }),
      ).toThrow('rollback')
      driver.run('INSERT INTO b VALUES (?)', ['after'])
    })
    expect(driver.all('SELECT * FROM a')).toEqual([{ v: 'outer' }])
    expect(driver.all('SELECT * FROM b')).toEqual([{ v: 'after' }])
    expect(() =>
      driver.transaction(() => {
        driver.run('DELETE FROM a')
        throw new Error('outer rollback')
      }),
    ).toThrow('outer rollback')
    expect(driver.all('SELECT * FROM a')).toEqual([{ v: 'outer' }])
    driver.close()
    driver.close()
    expect(() => driver.all('SELECT 1')).toThrow('closed')
  })
})
