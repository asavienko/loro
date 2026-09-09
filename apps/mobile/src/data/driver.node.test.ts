import { describe, expect, it } from 'vitest'
import { openNodeSqlite } from './driver.node'

describe('synchronous SQLite transaction boundary', () => {
  it('rolls back a failed deferred commit and remains usable for subsequent transactions', () => {
    const db = openNodeSqlite()
    try {
      db.exec(
        'CREATE TABLE parent(id INTEGER PRIMARY KEY); CREATE TABLE child(parent INTEGER REFERENCES parent(id) DEFERRABLE INITIALLY DEFERRED)',
      )
      expect(() => {
        db.transaction(() => {
          db.run('INSERT INTO child VALUES(1)')
        })
      }).toThrow()
      expect(db.all('SELECT * FROM child')).toEqual([])
      db.transaction(() => {
        db.run('INSERT INTO parent VALUES(1)')
        db.run('INSERT INTO child VALUES(1)')
      })
      expect(db.all('SELECT * FROM child')).toEqual([{ parent: 1 }])
    } finally {
      db.close()
    }
  })
  it('rolls back an inner savepoint without discarding the outer transaction', () => {
    const db = openNodeSqlite()
    try {
      db.exec('CREATE TABLE items(value INTEGER)')
      db.transaction(() => {
        db.run('INSERT INTO items VALUES(1)')
        expect(() => {
          db.transaction(() => {
            db.run('INSERT INTO items VALUES(2)')
            throw new Error('inner')
          })
        }).toThrow('inner')
        db.run('INSERT INTO items VALUES(3)')
      })
      expect(db.all('SELECT value FROM items ORDER BY value')).toEqual([{ value: 1 }, { value: 3 }])
    } finally {
      db.close()
    }
  })
  it('rejects Promise results before commit, including nested transaction callbacks', () => {
    const db = openNodeSqlite()
    try {
      db.exec('CREATE TABLE writes(value INTEGER)')
      expect(() =>
        db.transaction(() => {
          db.run('INSERT INTO writes VALUES(1)')
          return db.transaction(() => Promise.resolve('unfinished'))
        }),
      ).toThrow('must be synchronous')
      expect(db.all('SELECT * FROM writes')).toEqual([])
      db.transaction(() => {
        db.run('INSERT INTO writes VALUES(2)')
      })
      expect(db.all('SELECT * FROM writes')).toEqual([{ value: 2 }])
    } finally {
      db.close()
    }
  })
})
