/**
 * Persistence, against real SQLite.
 *
 * Every test here runs the SQL that will run on a device — same schema, same statements,
 * same migration runner — through `node:sqlite`. What is NOT covered: the `op-sqlite`
 * driver itself, which needs the dev client (plans/09).
 */

import { beforeEach, describe, expect, it } from 'vitest'
import {
  LadderRung,
  MIGRATIONS,
  SCHEMA_VERSION,
  currentVersion,
  migrate,
  openMemoryPersistence,
  openSqlPersistence,
  userPhraseId,
  type Persistence,
  type PhraseState,
  type SqlDriver,
} from '@loro/core'
import { makePhrase } from '@loro/core/testing'
import { openNodeSqlite } from './driver.node'

const AT = 1_785_231_660_000
const DAY = '2026-07-28'

/** A deterministic stand-in for core-rs's HLC, which has no JS bridge yet. */
function fakeHlc(): () => string {
  let n = 0
  return () => `${String(AT)}:${String(n++).padStart(4, '0')}:test`
}

describe('migrations', () => {
  let driver: SqlDriver

  beforeEach(() => {
    driver = openNodeSqlite()
  })

  it('applies schema v1 to a fresh database', () => {
    expect(currentVersion(driver)).toBe(0)
    const result = migrate(driver, AT)
    expect(result.from).toBe(0)
    expect(result.to).toBe(SCHEMA_VERSION)
    expect(result.applied).toEqual(MIGRATIONS.map((m) => m.version))
  })

  it('creates every table the app reads', () => {
    migrate(driver, AT)
    const names = driver
      .all("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .map((r) => r['name'])
    for (const table of [
      'user_phrase',
      'settings',
      'refrain_day',
      'streak_day',
      'outbox',
      'kv',
      'schema_version',
    ]) {
      expect(names, `missing table ${table}`).toContain(table)
    }
  })

  it('creates the indexes that keep 2 000 phrases fast', () => {
    migrate(driver, AT)
    const names = driver
      .all("SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_%'")
      .map((r) => r['name'])
    expect(names).toContain('idx_up_due')
    expect(names).toContain('idx_up_active')
    expect(names).toContain('idx_up_today')
    expect(names).toContain('idx_up_user_phrase')
  })

  it('is idempotent — a second run applies nothing', () => {
    migrate(driver, AT)
    const second = migrate(driver, AT)
    expect(second.applied).toEqual([])
    expect(second.to).toBe(SCHEMA_VERSION)
  })

  it('REFUSES to run against a newer schema than it knows', () => {
    migrate(driver, AT)
    // A learner who installs a newer build and then rolls back. Proceeding would write
    // rows missing whatever columns the newer build added.
    driver.run('INSERT INTO schema_version (version, name, applied_at) VALUES (?, ?, ?)', [
      SCHEMA_VERSION + 7,
      'from-the-future',
      AT,
    ])
    expect(() => migrate(driver, AT)).toThrow(/Refusing to run/)
  })

  it('enforces the no-duplicate-catalog-phrase rule in the database', () => {
    migrate(driver, AT)
    const insert = (id: string): void => {
      driver.run(
        `INSERT INTO user_phrase (id, user_id, phrase_id, source, added_at, updated_hlc)
         VALUES (?, 'local', 'cafe1', 'discover', ?, 'h')`,
        [id, AT],
      )
    }
    insert('row-a')
    // Two rows for one catalog phrase is the guard the blueprint states in code
    // (Loro.dc.html:3602) — here it is a constraint, not a remembered check.
    expect(() => {
      insert('row-b')
    }).toThrow()
  })

  it('rejects a row with neither a catalog id nor learner text', () => {
    migrate(driver, AT)
    expect(() => {
      driver.run(
        `INSERT INTO user_phrase (id, user_id, source, added_at, updated_hlc)
         VALUES ('empty', 'local', 'custom', ?, 'h')`,
        [AT],
      )
    }).toThrow()
  })
})

// ─────────────────────────────────────────────────────────────────────────────

/** The same suite against both implementations: SQL on device, memory on web. */
const implementations: [string, () => Persistence][] = [
  ['sqlite', () => openSqlPersistence(openNodeSqlite(), fakeHlc(), AT)],
  ['memory', () => openMemoryPersistence()],
]

describe.each(implementations)('%s repositories', (_name, open) => {
  let db: Persistence

  beforeEach(() => {
    db = open()
  })

  it('round-trips a phrase with every field set', () => {
    const phrase: PhraseState = {
      ...makePhrase('cafe1', {
        difficulty: 'hard',
        tags: ['pron', 'useful'],
        loved: true,
        plays: 3,
        reps: 7,
        repsToday: 4,
        repsTodayDay: DAY,
        automaticity: 67,
        lockInDays: 2,
        rung: LadderRung.PressureTested,
        stumbles: 1,
        cueLevel: 2,
        lastPracticedAt: AT,
      }),
      id: userPhraseId('0197f2a0-0000-7000-8000-aaaaaaaaaaaa'),
      note: 'sounds like "coffee"',
      srs: {
        stability: 3.5,
        difficulty: 6.25,
        due: AT + 86_400_000,
        lastReview: AT,
        lapses: 1,
        state: 'review',
      },
      axPerception: 10,
      axRecall: 20,
      axProduction: 30,
    }

    db.phrases.upsert(phrase)
    const back = db.phrases.byId(phrase.id)
    expect(back).toEqual(phrase)
  })

  it('round-trips a learner-authored phrase with no catalog row', () => {
    const own: PhraseState = {
      ...makePhrase('x'),
      id: userPhraseId('0197f2a0-0000-7000-8000-bbbbbbbbbbbb'),
      phraseId: null,
      source: 'custom',
      ownEs: 'Me lo apunto',
      ownEn: "I'll note that down",
      ownTheme: 'Mine',
      ownEmoji: '✍️',
    }
    db.phrases.upsert(own)
    expect(db.phrases.byId(own.id)).toEqual(own)
  })

  it('excludes learned and graduated phrases from active()', () => {
    const plain = { ...makePhrase('a'), id: userPhraseId('id-a') }
    const learned = { ...makePhrase('b', { learned: true }), id: userPhraseId('id-b') }
    const graduated = { ...makePhrase('c', { graduatedAt: AT }), id: userPhraseId('id-c') }
    for (const p of [plain, learned, graduated]) db.phrases.upsert(p)

    expect(db.phrases.all()).toHaveLength(3)
    expect(db.phrases.active().map((p) => p.id)).toEqual(['id-a'])
  })

  it('returns only phrases actually due', () => {
    const due = {
      ...makePhrase('a'),
      id: userPhraseId('id-due'),
      srs: {
        stability: 1,
        difficulty: 5,
        due: AT - 1,
        lastReview: null,
        lapses: 0,
        state: 'review' as const,
      },
    }
    const later = {
      ...makePhrase('b'),
      id: userPhraseId('id-later'),
      srs: {
        stability: 9,
        difficulty: 5,
        due: AT + 86_400_000,
        lastReview: null,
        lapses: 0,
        state: 'review' as const,
      },
    }
    const never = { ...makePhrase('c'), id: userPhraseId('id-never') }
    for (const p of [due, later, never]) db.phrases.upsert(p)

    expect(db.phrases.due(AT).map((p) => p.id)).toEqual(['id-due'])
  })

  it('soft-deletes: the row stops being readable but is not erased', () => {
    const p = { ...makePhrase('a'), id: userPhraseId('id-a') }
    db.phrases.upsert(p)
    db.phrases.softDelete(p.id, AT)

    expect(db.phrases.byId(p.id)).toBeNull()
    expect(db.phrases.all()).toHaveLength(0)
    expect(db.phrases.count()).toBe(0)
  })

  it('keeps a phrase with no FSRS state as null, not a fabricated schedule', () => {
    const p = { ...makePhrase('a'), id: userPhraseId('id-a') }
    db.phrases.upsert(p)
    expect(db.phrases.byId(p.id)?.srs).toBeNull()
  })

  it('round-trips settings', () => {
    expect(db.settings.load()).toBeNull()
    db.settings.save({
      onboarded: true,
      goal: 'trip',
      level: 'beg',
      dailyMinutes: 20,
      waveTimes: ['08:00', '19:00'],
    })
    expect(db.settings.load()).toEqual({
      onboarded: true,
      goal: 'trip',
      level: 'beg',
      dailyMinutes: 20,
      waveTimes: ['08:00', '19:00'],
    })
  })

  it("round-trips today's frozen set, including which members were substituted", () => {
    db.refrainDay.save({ localDay: DAY, setIds: ['a', 'b', 'c'], substituted: ['c'] })
    expect(db.refrainDay.load(DAY)).toEqual({
      localDay: DAY,
      setIds: ['a', 'b', 'c'],
      substituted: ['c'],
    })
    expect(db.refrainDay.load('2026-07-29')).toBeNull()
  })

  it('reads the most recent day, which is what hydration needs', () => {
    db.refrainDay.save({ localDay: '2026-07-26', setIds: ['old'], substituted: [] })
    db.refrainDay.save({ localDay: DAY, setIds: ['new'], substituted: [] })
    expect(db.refrainDay.latest()?.localDay).toBe(DAY)
  })

  it('records a practice day once, however many reps land on it', () => {
    db.practiceDays.add(DAY)
    db.practiceDays.add(DAY)
    db.practiceDays.add('2026-07-27')
    expect(db.practiceDays.all()).toEqual(['2026-07-27', DAY])
  })

  it('prunes practice days older than the retention window', () => {
    for (const day of ['2025-01-01', '2026-07-27', DAY]) db.practiceDays.add(day)
    db.practiceDays.pruneBefore('2026-07-27')
    expect(db.practiceDays.all()).toEqual(['2026-07-27', DAY])
  })

  it('wipes every learner row — erasure, not a cache clear', () => {
    db.phrases.upsert({ ...makePhrase('a'), id: userPhraseId('id-a') })
    db.settings.save({
      onboarded: true,
      goal: 'trip',
      level: null,
      dailyMinutes: 10,
      waveTimes: [],
    })
    db.practiceDays.add(DAY)
    db.refrainDay.save({ localDay: DAY, setIds: ['id-a'], substituted: [] })
    db.outbox.append({
      entity: 'user_phrase',
      entityId: 'id-a',
      op: 'upsert',
      fields: { loved: { v: true, hlc: 'h1' } },
      hlc: 'h1',
      createdAt: AT,
    })

    db.wipe()

    expect(db.phrases.all()).toEqual([])
    expect(db.settings.load()).toBeNull()
    expect(db.practiceDays.all()).toEqual([])
    expect(db.refrainDay.latest()).toBeNull()
    expect(db.outbox.size()).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('the outbox', () => {
  let db: Persistence

  beforeEach(() => {
    db = openSqlPersistence(openNodeSqlite(), fakeHlc(), AT)
  })

  const write = (
    fields: Record<string, { v: string | number | boolean | null; hlc: string }>,
    id = 'row-1',
  ) => {
    db.outbox.append({
      entity: 'user_phrase',
      entityId: id,
      op: 'upsert',
      fields,
      hlc: 'h',
      createdAt: AT,
    })
  }

  it('queues one op per write, in order', () => {
    write({ loved: { v: true, hlc: 'h1' } }, 'row-1')
    write({ loved: { v: true, hlc: 'h2' } }, 'row-2')
    const ops = db.outbox.pending(10)
    expect(ops.map((o) => o.entityId)).toEqual(['row-1', 'row-2'])
    expect(ops.map((o) => o.seq)).toEqual([1, 2])
  })

  it('coalesces a second lww write to the same row instead of queueing two', () => {
    // A learner tapping a rating three times is one write as far as the server cares.
    write({ difficulty: { v: 'hard', hlc: 'h1' } })
    write({ difficulty: { v: 'easy', hlc: 'h2' } })
    write({ difficulty: { v: 'med', hlc: 'h3' } })

    const ops = db.outbox.pending(10)
    expect(ops).toHaveLength(1)
    expect(ops[0]?.fields['difficulty']).toEqual({ v: 'med', hlc: 'h3' })
  })

  it('merges different lww fields into the one pending op', () => {
    write({ difficulty: { v: 'hard', hlc: 'h1' } })
    write({ loved: { v: true, hlc: 'h2' } })

    const ops = db.outbox.pending(10)
    expect(ops).toHaveLength(1)
    expect(Object.keys(ops[0]?.fields ?? {}).sort()).toEqual(['difficulty', 'loved'])
  })

  it('does NOT coalesce a max field — a lower count must not overwrite a higher one', () => {
    // `reps` is `max` precisely so a stale device cannot lower it. Folding these would
    // reintroduce the bug the merge class exists to prevent.
    write({ reps: { v: 20, hlc: 'h1' } })
    write({ reps: { v: 18, hlc: 'h2' } })

    const ops = db.outbox.pending(10)
    expect(ops).toHaveLength(2)
    expect(ops.map((o) => o.fields['reps']?.v)).toEqual([20, 18])
  })

  it('does not coalesce across different rows', () => {
    write({ loved: { v: true, hlc: 'h1' } }, 'row-1')
    write({ loved: { v: true, hlc: 'h2' } }, 'row-2')
    expect(db.outbox.pending(10)).toHaveLength(2)
  })

  it('never coalesces a delete into an edit', () => {
    write({ loved: { v: true, hlc: 'h1' } })
    db.outbox.append({
      entity: 'user_phrase',
      entityId: 'row-1',
      op: 'delete',
      fields: {},
      hlc: 'h2',
      createdAt: AT,
    })
    const ops = db.outbox.pending(10)
    expect(ops.map((o) => o.op)).toEqual(['upsert', 'delete'])
  })

  it('acks only what the server accepted', () => {
    write({ loved: { v: true, hlc: 'h1' } }, 'row-1')
    write({ loved: { v: true, hlc: 'h2' } }, 'row-2')
    db.outbox.ack([1])
    expect(db.outbox.pending(10).map((o) => o.entityId)).toEqual(['row-2'])
  })

  it('counts a failed flush without losing the op', () => {
    write({ loved: { v: true, hlc: 'h1' } })
    db.outbox.recordFailure([1], 'offline')
    const ops = db.outbox.pending(10)
    expect(ops).toHaveLength(1)
    expect(ops[0]?.attempts).toBe(1)
  })

  it('compacts by merging, and never by dropping a write', () => {
    // Weeks offline: many rows, each edited more than once. `reps` (max) folds to its
    // maximum, which is lossless; nothing is discarded.
    for (let row = 0; row < 10; row++) {
      write({ reps: { v: 1, hlc: 'h1' } }, `row-${String(row)}`)
      write({ reps: { v: 5, hlc: 'h2' } }, `row-${String(row)}`)
      write({ reps: { v: 3, hlc: 'h3' } }, `row-${String(row)}`)
    }
    expect(db.outbox.size()).toBe(30)

    const removed = db.outbox.compact(10)
    expect(removed).toBe(20)
    expect(db.outbox.size()).toBe(10)

    // The surviving op for each row carries the MAXIMUM, not the last value.
    for (const op of db.outbox.pending(100)) {
      expect(op.fields['reps']?.v, `${op.entityId} kept the highest count`).toBe(5)
    }
  })

  it('leaves the queue alone when it is under the cap', () => {
    write({ reps: { v: 1, hlc: 'h1' } }, 'row-1')
    write({ reps: { v: 2, hlc: 'h2' } }, 'row-1')
    expect(db.outbox.compact(10)).toBe(0)
    expect(db.outbox.size()).toBe(2)
  })

  it('rolls back the row write AND the op together when the transaction fails', () => {
    // The reason append happens inside the caller's transaction: a crash between the row
    // and its op is a learner's edit that never syncs and nothing can detect.
    const driver = openNodeSqlite()
    const persistence = openSqlPersistence(driver, fakeHlc(), AT)
    const phrase = { ...makePhrase('a'), id: userPhraseId('id-a') }

    expect(() =>
      driver.transaction(() => {
        persistence.phrases.upsert(phrase)
        persistence.outbox.append({
          entity: 'user_phrase',
          entityId: phrase.id,
          op: 'upsert',
          fields: { loved: { v: true, hlc: 'h1' } },
          hlc: 'h1',
          createdAt: AT,
        })
        throw new Error('crash between the two writes')
      }),
    ).toThrow(/crash/)

    expect(persistence.phrases.all(), 'the row was rolled back').toEqual([])
    expect(persistence.outbox.size(), 'and so was its op').toBe(0)
  })

  it('commits the row and the op together on success', () => {
    const driver = openNodeSqlite()
    const persistence = openSqlPersistence(driver, fakeHlc(), AT)
    const phrase = { ...makePhrase('a'), id: userPhraseId('id-a') }

    driver.transaction(() => {
      persistence.phrases.upsert(phrase)
      persistence.outbox.append({
        entity: 'user_phrase',
        entityId: phrase.id,
        op: 'upsert',
        fields: { loved: { v: true, hlc: 'h1' } },
        hlc: 'h1',
        createdAt: AT,
      })
    })

    expect(persistence.phrases.all()).toHaveLength(1)
    expect(persistence.outbox.size()).toBe(1)
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('at scale', () => {
  it('reads 2 000 phrases well inside the frame budget', () => {
    const driver = openNodeSqlite()
    const db = openSqlPersistence(driver, fakeHlc(), AT)

    driver.transaction(() => {
      for (let i = 0; i < 2000; i++) {
        db.phrases.upsert({
          ...makePhrase(`p${String(i).padStart(4, '0')}`, {
            reps: i % 7,
            learned: i % 17 === 0,
          }),
          id: userPhraseId(`0197f2a0-0000-7000-8000-${String(i).padStart(12, '0')}`),
          phraseId: null,
          ownEs: `frase ${String(i)}`,
          ownEn: `phrase ${String(i)}`,
          source: 'custom',
        })
      }
    })

    expect(db.phrases.count()).toBe(2000)

    const started = performance.now()
    const active = db.phrases.active()
    const elapsed = performance.now() - started

    expect(active.length).toBeGreaterThan(1800)
    // The M4 target is 2 000 phrases; a full active read is the query behind Today and the
    // stream. Generous here because CI machines vary — it catches an O(n²) mapping or a
    // missing index, not a few milliseconds of drift.
    expect(elapsed, `active() took ${elapsed.toFixed(1)}ms`).toBeLessThan(400)
  })
})
