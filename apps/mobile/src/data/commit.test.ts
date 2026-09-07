import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  MIGRATIONS,
  decodeCheckpoint,
  encodeCheckpoint,
  openSqlPersistence,
  openMemoryPersistence,
  type CourseCheckpoint,
  type SqlValue,
} from '@loro/core'
import { makePhrase } from '@loro/core/testing'
import { openNodeSqlite } from './driver.node'

const AT = 1_785_231_660_000
const checkpoint: CourseCheckpoint = {
  version: 1,
  targetLocale: 'es-ES',
  localDay: '2026-07-28',
  revision: 1,
  streamCursor: 1,
  refrainResume: { session: null, cursor: 0, lastLatency: null, history: [], done: false },
}
const course = {
  targetLocale: 'es-ES' as const,
  onboarded: true,
  selectedId: 'a',
  streamCursor: 1,
  refrainSession: null,
}
const op = {
  entity: 'user_phrase',
  entityId: 'a',
  op: 'upsert' as const,
  fields: { reps: { v: 1, hlc: 'test' } },
  hlc: 'test',
  createdAt: AT,
}

for (const kind of ['sqlite', 'memory'] as const)
  describe(`${kind} local commit boundary`, () => {
    const open = () =>
      kind === 'sqlite'
        ? openSqlPersistence(openNodeSqlite(), () => 'test', AT)
        : openMemoryPersistence()
    it('rolls every mutation family back together, including replay identity', () => {
      const db = open()
      expect(() =>
        db.transaction(() => {
          db.phrases.upsert(makePhrase('a'))
          db.courses.save(course)
          db.metadata.set('revision', '1')
          db.attempts.record('es-ES', 'attempt')
          db.checkpoints.save(checkpoint)
          db.practiceDays.add(checkpoint.localDay)
          db.outbox.append(op)
          throw new Error('disk full')
        }),
      ).toThrow('disk full')
      expect(db.phrases.count()).toBe(0)
      expect(db.courses.all()).toEqual([])
      expect(db.metadata.get('revision')).toBeNull()
      expect(db.attempts.has('es-ES', 'attempt')).toBe(false)
      expect(db.checkpoints.load('es-ES')).toBeNull()
      expect(db.practiceDays.all()).toEqual([])
      expect(db.outbox.size()).toBe(0)
    })
    it('commits a stable attempt once and isolates other courses', () => {
      const db = open()
      const apply = () =>
        db.transaction(() => {
          if (!db.attempts.record('es-ES', 'attempt')) return false
          db.phrases.upsert(makePhrase('a', { reps: 1 }))
          db.checkpoints.save(checkpoint)
          db.outbox.append(op)
          return true
        })
      expect(apply()).toBe(true)
      expect(apply()).toBe(false)
      expect(db.phrases.all()[0]?.reps).toBe(1)
      expect(db.outbox.size()).toBe(1)
      expect(db.attempts.has('bg-BG', 'attempt')).toBe(false)
      expect(db.checkpoints.load('bg-BG')).toBeNull()
    })
    it('rejects asynchronous callbacks and rolls back their synchronous writes', () => {
      const db = open()
      expect(() =>
        db.transaction(() => {
          db.metadata.set('bad', 'yes')
          return Promise.resolve()
        }),
      ).toThrow('synchronous')
      expect(db.metadata.get('bad')).toBeNull()
    })
    it('rolls back a nested savepoint while preserving the surrounding transaction', () => {
      const db = open()
      db.transaction(() => {
        db.metadata.set('outer', 'yes')
        expect(() =>
          db.transaction(() => {
            db.metadata.set('inner', 'yes')
            throw new Error('inner')
          }),
        ).toThrow('inner')
        db.metadata.set('after', 'yes')
      })
      expect(db.metadata.get('outer')).toBe('yes')
      expect(db.metadata.get('inner')).toBeNull()
      expect(db.metadata.get('after')).toBe('yes')
    })
    it('only explicit restore can undo deletion', () => {
      const db = open()
      const p = makePhrase('a')
      db.phrases.upsert(p)
      db.phrases.softDelete(p.id, AT)
      db.phrases.upsert(p)
      expect(db.phrases.byId(p.id)).toBeNull()
      db.phrases.restore(p.id)
      expect(db.phrases.byId(p.id)).toEqual(p)
    })
  })

describe('SQLite durable local state', () => {
  for (const boundary of [
    'user_phrase',
    'course_session',
    'session_checkpoint',
    'committed_attempt',
    'streak_day',
    'outbox',
  ]) {
    it(`rolls back when the ${boundary} write fails`, () => {
      const driver = openNodeSqlite()
      const run = driver.run.bind(driver)
      let armed = false
      const failing = {
        ...driver,
        run: (sql: string, params?: readonly SqlValue[]) => {
          if (armed && sql.includes(`INSERT INTO ${boundary}`)) throw new Error('SQLITE_FULL')
          run(sql, params)
        },
      }
      const db = openSqlPersistence(failing, () => 'canonical-test', AT)
      armed = true
      expect(() => {
        db.transaction(() => {
          db.phrases.upsert(makePhrase('a'))
          db.courses.save(course)
          db.checkpoints.save(checkpoint)
          db.attempts.record('es-ES', 'attempt')
          db.practiceDays.add(checkpoint.localDay)
          db.outbox.append(op)
        })
      }).toThrow('SQLITE_FULL')
      expect(db.phrases.count()).toBe(0)
      expect(db.courses.all()).toEqual([])
      expect(db.checkpoints.load('es-ES')).toBeNull()
      expect(db.attempts.has('es-ES', 'attempt')).toBe(false)
      expect(db.practiceDays.all()).toEqual([])
      expect(db.outbox.size()).toBe(0)
      expect(db.metadata.get('hlc')).toBeNull()
      driver.close()
    })
  }
  it('rolls back a COMMIT failure and keeps later transaction nesting correct', () => {
    const driver = openNodeSqlite()
    const db = openSqlPersistence(driver, () => 'test', AT)
    driver.exec(
      'CREATE TABLE test_parent(id TEXT PRIMARY KEY); CREATE TABLE test_child(id TEXT REFERENCES test_parent(id) DEFERRABLE INITIALLY DEFERRED)',
    )
    expect(() => {
      db.transaction(() => {
        db.metadata.set('uncommitted', 'yes')
        driver.run('INSERT INTO test_child VALUES (?)', ['missing'])
      })
    }).toThrow()
    expect(db.metadata.get('uncommitted')).toBeNull()
    db.transaction(() => {
      db.metadata.set('recovered', 'yes')
    })
    expect(db.metadata.get('recovered')).toBe('yes')
    driver.close()
  })
  it('upgrades schema 2 without rewriting phrase history, course rows or queued payloads', () => {
    const driver = openNodeSqlite()
    driver.exec(
      'CREATE TABLE schema_version(version INTEGER PRIMARY KEY,name TEXT NOT NULL,applied_at INTEGER NOT NULL)',
    )
    for (const migration of MIGRATIONS.filter((m) => m.version <= 2)) {
      driver.exec(migration.up)
      driver.run('INSERT INTO schema_version VALUES(?,?,?)', [
        migration.version,
        migration.name,
        AT,
      ])
    }
    driver.run(
      "INSERT INTO user_phrase(id,user_id,own_es,source,added_at,updated_hlc,field_hlc,srs_stability,srs_difficulty,srs_due,srs_last_review,srs_lapses,srs_state) VALUES('legacy','local','hola','own',?,'old','{\"reps\":\"old\"}',2,4,?,?,3,'review')",
      [AT, AT + 1, AT],
    )
    driver.run('INSERT INTO course_session VALUES(?,?,?,?,?,?)', [
      'local',
      'es-ES',
      1,
      'legacy',
      4,
      null,
    ])
    driver.run(
      "INSERT INTO outbox(entity,entity_id,op,payload,hlc,created_at,attempts,last_error) VALUES('user_phrase','legacy','upsert','{}','old',?,2,'offline')",
      [AT],
    )
    const phraseBefore = driver.all('SELECT * FROM user_phrase')
    const queueBefore = driver.all('SELECT * FROM outbox')
    const db = openSqlPersistence(driver, () => 'new', AT)
    expect(driver.all('SELECT * FROM user_phrase')).toEqual(
      phraseBefore.map((row) => ({ ...row, srs_algorithm: null })),
    )
    expect(driver.all('SELECT * FROM outbox')).toEqual(
      queueBefore.map((row) => ({ ...row, user_id: 'local' })),
    )
    expect(db.courses.load('es-ES')?.streamCursor).toBe(4)
    expect(db.phrases.all()[0]?.srs?.lapses).toBe(3)
    driver.close()
  })
  it('preserves course row identity, extra columns and related rows during repeated saves', () => {
    const driver = openNodeSqlite()
    const db = openSqlPersistence(driver, () => 'test', AT)
    db.courses.save(course)
    driver.exec(
      "ALTER TABLE course_session ADD COLUMN future_metadata TEXT DEFAULT 'keep'; CREATE TABLE course_child(user_id TEXT,target_locale TEXT,FOREIGN KEY(user_id,target_locale) REFERENCES course_session(user_id,target_locale) ON DELETE CASCADE)",
    )
    driver.run('INSERT INTO course_child VALUES (?,?)', ['local', 'es-ES'])
    const identity = driver.all('SELECT rowid FROM course_session')
    db.courses.save({ ...course, selectedId: null, streamCursor: 2 })
    db.courses.save({ ...course, selectedId: null, streamCursor: 3 })
    expect(driver.all('SELECT rowid FROM course_session')).toEqual(identity)
    expect(driver.all('SELECT future_metadata FROM course_session')).toEqual([
      { future_metadata: 'keep' },
    ])
    expect(driver.all('SELECT * FROM course_child')).toHaveLength(1)
    expect(db.courses.load('es-ES')?.selectedId).toBeNull()
    driver.close()
  })
  it('scopes phrase writes, metadata, queues and erasure to their owner', () => {
    const driver = openNodeSqlite()
    const a = openSqlPersistence(driver, () => 'a', AT)
    const b = openSqlPersistence(driver, () => 'b', AT, 'other')
    a.phrases.upsert(makePhrase('a'))
    expect(() => {
      b.phrases.upsert(makePhrase('a', { reps: 99 }))
    }).toThrow('another local owner')
    expect(a.phrases.all()[0]?.reps).toBe(0)
    expect(b.phrases.count()).toBe(0)
    for (const db of [a, b]) {
      db.metadata.set('same', 'saved')
      db.courses.save(course)
      db.outbox.append(op)
    }
    expect(a.outbox.size()).toBe(1)
    expect(b.outbox.size()).toBe(1)
    a.outbox.ack(b.outbox.pending(1).map((o) => o.seq))
    expect(b.outbox.size()).toBe(1)
    a.wipe()
    expect(a.metadata.get('same')).toBeNull()
    expect(b.metadata.get('same')).toBe('saved')
    expect(b.courses.all()).toHaveLength(1)
    expect(b.outbox.size()).toBe(1)
    driver.close()
  })
  it('restores checkpoint, replay state, complete review state and canonical clock input after reopening', () => {
    const dir = mkdtempSync(join(tmpdir(), 'loro-commit-'))
    try {
      const path = join(dir, 'state.sqlite')
      const driver = openNodeSqlite(path)
      const db = openSqlPersistence(
        driver,
        (previous) => (previous === null ? 'canonical-first' : 'canonical-next'),
        AT,
      )
      const review = {
        attemptId: 'attempt',
        targetLocale: 'es-ES' as const,
        phraseId: 'a',
        reviewedAt: AT,
        rating: 3 as const,
        algorithm: 'test-v1',
        state: {
          stability: 3,
          difficulty: 5,
          due: AT + 1,
          lastReview: AT,
          lapses: 2,
          state: 'review' as const,
          algorithm: 'test-v1',
        },
      }
      db.transaction(() => {
        db.nextHlc()
        db.courses.save(course)
        db.checkpoints.save(checkpoint)
        db.attempts.record('es-ES', 'attempt')
        db.reviews.append(review)
        db.outbox.append(op)
      })
      driver.close()
      const reopened = openNodeSqlite(path)
      let received: string | null = null
      const restored = openSqlPersistence(
        reopened,
        (previous) => {
          received = previous
          return 'canonical-next'
        },
        AT,
      )
      expect(restored.checkpoints.load('es-ES')).toEqual(checkpoint)
      expect(restored.attempts.has('es-ES', 'attempt')).toBe(true)
      expect(restored.reviews.all('es-ES')).toEqual([review])
      expect(restored.outbox.size()).toBe(1)
      restored.nextHlc()
      expect(received).toBe('canonical-first')
      reopened.close()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('bounded checkpoint decoding', () => {
  it('rejects unknown versions, malformed rows and native payloads without resetting progress', () => {
    expect(decodeCheckpoint(encodeCheckpoint(checkpoint))).toEqual(checkpoint)
    for (const invalid of [
      { ...checkpoint, version: 2 },
      { ...checkpoint, revision: -1 },
      { ...checkpoint, pcm: [1] },
      { ...checkpoint, refrainResume: { ...checkpoint.refrainResume, history: [-1] } },
    ]) {
      expect(decodeCheckpoint(JSON.stringify(invalid))).toBeNull()
    }
    expect(decodeCheckpoint('{')).toBeNull()
    expect(decodeCheckpoint(' '.repeat(1_000_001))).toBeNull()
  })
})
