/**
 * Persistence, against real SQLite.
 *
 * Every test here runs the SQL that will run on a device — same schema, same statements,
 * same migration runner — through `node:sqlite`. What is NOT covered: the `op-sqlite`
 * driver itself, which needs the dev client (plans/09).
 */

import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  LadderRung,
  MIGRATIONS,
  SCHEMA_VERSION,
  currentVersion,
  migrate,
  openSqlPersistence,
  userPhraseId,
  type Persistence,
  type PhraseState,
  type SqlDriver,
  type SqlRow,
} from '@loro/core'
import { makePhrase } from '@loro/core/testing'
import { openNodeSqlite } from './driver.node'
import { AT, DAY, fakeHlc, implementations } from './persistence.harness'

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

  it('refuses an incomplete migration history without altering the damaged database', () => {
    // A committed migration cannot normally leave this state: its schema and receipt share
    // one transaction. Treat an interrupted external restore or file corruption as a
    // recovery case instead of trusting MAX(version) and skipping the missing schema.
    const latest = MIGRATIONS.at(-1)
    if (!latest) throw new Error('Missing migrations')
    expect(currentVersion(driver)).toBe(0)
    driver.run('INSERT INTO schema_version (version, name, applied_at) VALUES (?, ?, ?)', [
      latest.version,
      latest.name,
      AT,
    ])

    expect(() => migrate(driver, AT)).toThrow(/migration history is incomplete at v1/)
    expect(driver.all('SELECT version, name, applied_at FROM schema_version')).toEqual([
      { version: latest.version, name: latest.name, applied_at: AT },
    ])
    expect(
      driver.all("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'user_phrase'"),
    ).toEqual([])
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
        algorithm: 'fsrs-6-default-c8ca282-loro-v1',
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

  it('does not let a later upsert of the same row resurrect the tombstone', () => {
    // The `tombstone` class beats a concurrent edit at any HLC. A write arriving after the
    // delete — a queued rep landing, a stale device, or the learner re-adding the phrase —
    // must not undo a deletion that has already been synced to every other device.
    const p = { ...makePhrase('a'), id: userPhraseId('id-a') }
    db.phrases.upsert(p)
    db.phrases.softDelete(p.id, AT)

    db.phrases.upsert({ ...p, reps: 9, loved: true })

    expect(db.phrases.byId(p.id), 'still deleted').toBeNull()
    expect(db.phrases.all()).toEqual([])
    expect(db.phrases.count()).toBe(0)
    expect(db.phrases.active()).toEqual([])
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

  it("round-trips today's frozen set, its finished waves, and its substitutions", () => {
    const row = {
      localDay: DAY,
      setIds: ['a', 'b', 'c'],
      waves: ['morning', 'midday'],
      substituted: ['c'],
      listenCounts: { a: 3, b: 1 },
    }
    db.refrainDay.save(row)
    expect(db.refrainDay.load(DAY)).toEqual(row)
    expect(db.refrainDay.load('2026-07-29')).toBeNull()
  })

  it('keeps the finished waves when the day is re-frozen', () => {
    // A substitution mid-day re-saves the row. Two waves already done must not be lost
    // because the third phrase changed.
    db.refrainDay.save({ localDay: DAY, setIds: ['a', 'b'], waves: ['morning'], substituted: [] })
    db.refrainDay.save({
      localDay: DAY,
      setIds: ['a', 'z'],
      waves: ['morning', 'midday'],
      substituted: ['z'],
    })
    expect(db.refrainDay.load(DAY)?.waves).toEqual(['morning', 'midday'])
    expect(db.refrainDay.load(DAY)?.setIds).toEqual(['a', 'z'])
  })

  it('reads the most recent day, which is what hydration needs', () => {
    db.refrainDay.save({ localDay: '2026-07-26', setIds: ['old'], waves: [], substituted: [] })
    db.refrainDay.save({ localDay: DAY, setIds: ['new'], waves: ['evening'], substituted: [] })
    const latest = db.refrainDay.latest()
    expect(latest?.localDay).toBe(DAY)
    // `latest()` is what a relaunch resumes from, so it must carry the waves too.
    expect(latest?.waves).toEqual(['evening'])
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
    db.refrainDay.save({ localDay: DAY, setIds: ['id-a'], waves: ['morning'], substituted: [] })
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

/**
 * The columns a local write does NOT own.
 *
 * These are invisible to the repository interface — `PhraseState` has no `deletedAt` and no
 * HLC map, and `SettingsRow` carries five of the settings table's fifteen columns — so the
 * shared conformance suite above cannot see them being destroyed. `INSERT OR REPLACE` in
 * both repositories destroyed them on every write, and nothing failed.
 */
describe('sync metadata a local write must not touch', () => {
  let driver: SqlDriver
  let db: Persistence

  beforeEach(() => {
    driver = openNodeSqlite()
    db = openSqlPersistence(driver, fakeHlc(), AT)
  })

  const phraseMeta = (id: string): SqlRow =>
    driver.all('SELECT field_hlc, deleted_at, updated_hlc FROM user_phrase WHERE id = ?', [
      id,
    ])[0] ?? {}

  it('keeps a newer per-field HLC when a stale upsert lands on the row', () => {
    const p = { ...makePhrase('a'), id: userPhraseId('id-a') }
    db.phrases.upsert(p)

    // What a `POST /sync/pull` merge writes: which device's clock last set which field.
    const merged = JSON.stringify({ loved: '9999:0001:other', reps: '9999:0002:other' })
    driver.run('UPDATE user_phrase SET field_hlc = ? WHERE id = ?', [merged, p.id])

    db.phrases.upsert({ ...p, loved: false, reps: 1 })

    // Erasing this map does not lose a value the learner can see — it loses the ability to
    // decide the NEXT merge, so every field looks never-written and the older side wins.
    expect(phraseMeta(p.id)['field_hlc']).toBe(merged)
  })

  it('stamps updated_hlc on every write, because that clock IS the write’s own', () => {
    const p = { ...makePhrase('a'), id: userPhraseId('id-a') }
    db.phrases.upsert(p)
    const first = phraseMeta(p.id)['updated_hlc']
    db.phrases.upsert({ ...p, reps: 3 })
    expect(phraseMeta(p.id)['updated_hlc']).not.toBe(first)
  })

  it('leaves the tombstone instant where the first delete put it', () => {
    const p = { ...makePhrase('a'), id: userPhraseId('id-a') }
    db.phrases.upsert(p)
    db.phrases.softDelete(p.id, AT)
    db.phrases.softDelete(p.id, AT + 86_400_000)
    // A tombstone that keeps getting newer eventually outranks a legitimate later write.
    expect(phraseMeta(p.id)['deleted_at']).toBe(AT)
  })

  it('refuses a SECOND row id for a catalog phrase the learner already holds', () => {
    // `INSERT OR REPLACE` resolved this by DELETING the live row — the learner's reps,
    // schedule and notes gone, with no error. Which id wins is plans 67–68's decision;
    // until then, throwing is the honest answer.
    db.phrases.upsert({ ...makePhrase('cafe1'), id: userPhraseId('row-a') })
    expect(() => {
      db.phrases.upsert({ ...makePhrase('cafe1'), id: userPhraseId('row-b') })
    }).toThrow(/UNIQUE/)
    expect(db.phrases.all().map((p) => p.id)).toEqual(['row-a'])
  })

  it('does not reset the settings columns this repository never writes', () => {
    db.settings.save({
      onboarded: false,
      goal: null,
      level: null,
      dailyMinutes: null,
      waveTimes: [],
    })
    // Everything the learner set elsewhere: a revoked consent, a chosen theme, a reminder.
    driver.run(
      `UPDATE settings SET accent = 'Sage', theme = 'dark', reminder_time = '21:30',
         analytics_opt_out = 1, cloud_asr_consent = 1, voice_clone_consent = 1,
         field_hlc = '{"goal":"9999:0001:other"}'
       WHERE user_id = 'local'`,
    )

    db.settings.save({
      onboarded: true,
      goal: 'trip',
      level: 'beg',
      dailyMinutes: 10,
      waveTimes: ['08:00'],
    })

    const row = driver.all('SELECT * FROM settings WHERE user_id = ?', ['local'])[0] ?? {}
    expect(row['accent']).toBe('Sage')
    expect(row['theme']).toBe('dark')
    expect(row['reminder_time']).toBe('21:30')
    // Silently un-revoking a privacy consent is the worst version of this bug.
    expect(row['analytics_opt_out']).toBe(1)
    expect(row['cloud_asr_consent']).toBe(1)
    expect(row['voice_clone_consent']).toBe(1)
    expect(row['field_hlc']).toBe('{"goal":"9999:0001:other"}')
    // And the five it does own are written.
    expect(db.settings.load()?.goal).toBe('trip')
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('the outbox', () => {
  let db: Persistence

  let driver: SqlDriver

  beforeEach(() => {
    driver = openNodeSqlite()
    db = openSqlPersistence(driver, fakeHlc(), AT)
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

  const remove = (id = 'row-1', hlc = 'h-del') => {
    db.outbox.append({
      entity: 'user_phrase',
      entityId: id,
      op: 'delete',
      fields: {},
      hlc,
      createdAt: AT,
    })
  }

  it('never coalesces a delete into an edit', () => {
    write({ loved: { v: true, hlc: 'h1' } })
    remove()
    const ops = db.outbox.pending(10)
    expect(ops.map((o) => o.op)).toEqual(['upsert', 'delete'])
  })

  it('never coalesces an edit BACKWARD past a delete', () => {
    // The other direction, which was unguarded. `tombstone` beats an edit at any HLC, so an
    // edit folded in front of the delete is an edit the server applies and then throws away.
    // A learner deleting a phrase and re-adding it in the same offline window hits this.
    write({ difficulty: { v: 'hard', hlc: 'h1' } })
    remove()
    write({ difficulty: { v: 'easy', hlc: 'h3' } })

    const ops = db.outbox.pending(10)
    expect(ops.map((o) => o.op)).toEqual(['upsert', 'delete', 'upsert'])
    expect(ops[0]?.fields['difficulty']).toEqual({ v: 'hard', hlc: 'h1' })
    expect(ops[2]?.fields['difficulty']).toEqual({ v: 'easy', hlc: 'h3' })
  })

  it('coalesces again once a fresh upsert is the newest op for the row', () => {
    // The guard is "is the newest op an upsert?", not "has this row ever been deleted".
    write({ difficulty: { v: 'hard', hlc: 'h1' } })
    remove()
    write({ difficulty: { v: 'easy', hlc: 'h3' } })
    write({ difficulty: { v: 'med', hlc: 'h4' } })

    const ops = db.outbox.pending(10)
    expect(ops.map((o) => o.op)).toEqual(['upsert', 'delete', 'upsert'])
    expect(ops[2]?.fields['difficulty']).toEqual({ v: 'med', hlc: 'h4' })
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

  // ── retry: the same op flushed again and again ──
  // A learner offline for a fortnight has a flusher failing on a timer. Nothing about
  // repeated failure may drop an op, reorder the queue, or lose an attempt count.

  it('accumulates attempts across repeated failures and keeps the newest error', () => {
    write({ loved: { v: true, hlc: 'h1' } }, 'row-1')
    write({ reps: { v: 3, hlc: 'h2' } }, 'row-2')

    for (const error of ['dns', 'timeout', '503']) db.outbox.recordFailure([1, 2], error)

    const ops = db.outbox.pending(10)
    expect(
      ops.map((o) => o.entityId),
      'order survives every retry',
    ).toEqual(['row-1', 'row-2'])
    expect(ops.map((o) => o.attempts)).toEqual([3, 3])
    expect(driver.all('SELECT last_error FROM outbox ORDER BY seq')).toEqual([
      { last_error: '503' },
      { last_error: '503' },
    ])
  })

  it('keeps the attempt count of ops the server rejected while acking the ones it took', () => {
    // A push where the server accepts a prefix and rejects the rest — the realistic partial
    // failure. Dropping the whole batch would resend accepted ops; keeping it would lose them.
    for (const id of ['row-1', 'row-2', 'row-3']) write({ loved: { v: true, hlc: 'h' } }, id)
    db.outbox.recordFailure([1, 2, 3], 'first attempt failed')
    db.outbox.ack([1])
    db.outbox.recordFailure([2, 3], 'second attempt failed')

    expect(db.outbox.pending(10).map((o) => [o.entityId, o.attempts])).toEqual([
      ['row-2', 2],
      ['row-3', 2],
    ])
  })

  it('ignores a failure recorded against an op the server already accepted', () => {
    // The flusher's response and its error handler race; a late failure for an acked seq
    // must not resurrect the op.
    write({ loved: { v: true, hlc: 'h1' } })
    db.outbox.ack([1])
    db.outbox.recordFailure([1], 'late error for an accepted op')
    expect(db.outbox.size()).toBe(0)
  })

  it('treats an empty ack and an empty failure as no-ops', () => {
    // `IN ()` is invalid SQL. A flush that accepted nothing is a normal outcome.
    write({ loved: { v: true, hlc: 'h1' } })
    db.outbox.ack([])
    db.outbox.recordFailure([], 'nothing to blame')
    expect(db.outbox.pending(10).map((o) => o.attempts)).toEqual([0])
  })

  it('keeps attempted payloads immutable and queues later writes separately', () => {
    // A failed response may follow an accepted server write. Its retry must retain the
    // exact payload for that sequence while later edits receive their own sequence.
    write({ difficulty: { v: 'hard', hlc: 'h1' } })
    db.outbox.recordFailure([1], 'offline')
    write({ difficulty: { v: 'easy', hlc: 'h2' } })

    const ops = db.outbox.pending(10)
    expect(ops).toHaveLength(2)
    expect(ops[0]?.fields['difficulty']).toEqual({ v: 'hard', hlc: 'h1' })
    expect(ops[0]?.attempts).toBe(1)
    expect(ops[1]?.fields['difficulty']).toEqual({ v: 'easy', hlc: 'h2' })
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

  it('compacts on BOTH sides of a delete without folding across it', () => {
    // Deletes used to be dropped before grouping, so they were invisible to folding and the
    // two halves merged into one op sitting in front of the tombstone. `isFoldable` did not
    // catch it either: a delete carries no fields, and "every field folds" is vacuously true
    // of none.
    write({ difficulty: { v: 'hard', hlc: 'h1' } })
    write({ difficulty: { v: 'easy', hlc: 'h2' } })
    remove()
    // Two separate appends after the delete: the first cannot fold (a delete is newest), the
    // second folds into the first.
    write({ difficulty: { v: 'med', hlc: 'h4' } })
    write({ loved: { v: true, hlc: 'h5' } })
    for (let i = 0; i < 8; i++)
      write({ reps: { v: i, hlc: `r${String(i)}` } }, `filler-${String(i)}`)

    db.outbox.compact(1)

    const ops = db.outbox.pending(100).filter((o) => o.entityId === 'row-1')
    expect(ops.map((o) => o.op)).toEqual(['upsert', 'delete', 'upsert'])
    expect(ops[0]?.fields['difficulty']).toEqual({ v: 'easy', hlc: 'h2' })
    expect(ops[2]?.fields).toEqual({
      difficulty: { v: 'med', hlc: 'h4' },
      loved: { v: true, hlc: 'h5' },
    })
  })

  it('records the delete then the re-add when a learner deletes and re-adds a phrase', () => {
    // The full offline history for "removed it, changed my mind": SQLite keeps the tombstone
    // AND a new live row (the unique index is scoped to `deleted_at IS NULL`), and the queue
    // keeps the two operations in the order they happened.
    const old = userPhraseId('id-old')
    db.phrases.upsert({ ...makePhrase('cafe1'), id: old })
    driver.transaction(() => {
      db.phrases.softDelete(old, AT)
      remove(old)
    })
    const fresh = userPhraseId('id-fresh')
    driver.transaction(() => {
      db.phrases.upsert({ ...makePhrase('cafe1'), id: fresh })
      write({ loved: { v: true, hlc: 'h-new' } }, fresh)
    })

    expect(
      db.phrases.all().map((p) => p.id),
      'one live row',
    ).toEqual([fresh])
    expect(
      driver.all('SELECT id, deleted_at FROM user_phrase ORDER BY id'),
      'the tombstone is still on disk beside it',
    ).toEqual([
      { id: fresh, deleted_at: null },
      { id: old, deleted_at: AT },
    ])
    expect(db.outbox.pending(10).map((o) => [o.op, o.entityId])).toEqual([
      ['delete', old],
      ['upsert', fresh],
    ])
  })

  it('rolls back the row write AND the op together when the transaction fails', () => {
    // The reason append happens inside the caller's transaction: a crash between the row
    // and its op is a learner's edit that never syncs and nothing can detect.
    const persistence = db
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

  it('rolls back a mutation boundary nested inside a wider one', () => {
    // What the mutation boundary will look like once persistence is wired: the store wraps a
    // whole practice rep, and each write inside wraps its row-plus-op pair. The inner pair
    // uses a SAVEPOINT, so its rollback must not commit the outer work — and the outer
    // rollback must undo the inner pair even though it "succeeded".
    const first = { ...makePhrase('a'), id: userPhraseId('id-a') }
    const second = { ...makePhrase('b'), id: userPhraseId('id-b') }

    expect(() =>
      driver.transaction(() => {
        driver.transaction(() => {
          db.phrases.upsert(first)
          write({ reps: { v: 1, hlc: 'h1' } }, first.id)
        })
        expect(
          db.phrases.all().map((p) => p.id),
          'the inner pair is visible',
        ).toEqual([first.id])

        expect(() =>
          driver.transaction(() => {
            db.phrases.upsert(second)
            write({ reps: { v: 1, hlc: 'h2' } }, second.id)
            throw new Error('the second rep failed')
          }),
        ).toThrow(/second rep/)

        expect(
          db.phrases.all().map((p) => p.id),
          'only the failed pair is gone',
        ).toEqual([first.id])
        throw new Error('the session failed')
      }),
    ).toThrow(/session failed/)

    expect(db.phrases.all(), 'a released savepoint is not a commit').toEqual([])
    expect(db.outbox.size()).toBe(0)
  })

  it('rolls compaction back with the transaction that wrapped it', () => {
    // `compact()` opens its own transaction, so under a caller it runs in a savepoint. If it
    // committed independently, a rolled-back flush would have permanently folded the queue.
    // `reps` is `max`, so these do NOT coalesce on append and are left for compaction.
    for (let i = 0; i < 6; i++) write({ reps: { v: 1, hlc: `h${String(i)}` } }, `r${String(i)}`)
    for (let i = 0; i < 6; i++) write({ reps: { v: 5, hlc: `e${String(i)}` } }, `r${String(i)}`)
    const before = db.outbox.size()

    expect(() =>
      driver.transaction(() => {
        expect(db.outbox.compact(1)).toBeGreaterThan(0)
        throw new Error('flush aborted')
      }),
    ).toThrow(/flush aborted/)

    expect(db.outbox.size()).toBe(before)
  })

  it('commits the row and the op together on success', () => {
    const persistence = db
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

/**
 * GDPR erasure, against a database that has something to hide.
 *
 * The shared suite's `wipe()` test checks the five repositories read empty — but reading
 * empty is what a TOMBSTONE looks like too, and a filtered read is exactly how a
 * half-cleared database passes for erased. Erasure has to be checked against the tables, not
 * against the API that hides rows from them.
 */
describe('erasure leaves nothing behind', () => {
  let driver: SqlDriver
  let db: Persistence

  /** Every table this schema owns, read from the database rather than listed. */
  const owned = (): string[] =>
    driver
      .all(
        `SELECT name FROM sqlite_master WHERE type = 'table'
           AND name NOT LIKE 'sqlite_%' AND name != 'schema_version' ORDER BY name`,
      )
      .map((r) => String(r['name']))

  beforeEach(() => {
    driver = openNodeSqlite()
    db = openSqlPersistence(driver, fakeHlc(), AT)

    // A history with every kind of residue in it: a tombstoned row, a live row, several
    // days, a frozen set with finished waves, and a queue of ops that failed to flush.
    const kept = userPhraseId('id-kept')
    const gone = userPhraseId('id-gone')
    db.phrases.upsert({ ...makePhrase('a'), id: kept, note: 'a private mnemonic' })
    db.phrases.upsert({ ...makePhrase('b'), id: gone, note: 'another one' })
    db.phrases.softDelete(gone, AT)
    db.settings.save({
      onboarded: true,
      goal: 'trip',
      level: 'beg',
      dailyMinutes: 20,
      waveTimes: ['08:00'],
    })
    for (const day of ['2026-07-26', '2026-07-27', DAY]) db.practiceDays.add(day, 12)
    db.refrainDay.save({ localDay: DAY, setIds: [kept], waves: ['morning'], substituted: [] })
    db.courses.save({
      targetLocale: 'es-ES',
      onboarded: true,
      selectedId: kept,
      streamCursor: 1,
      refrainSession: null,
    })
    driver.run(`INSERT INTO kv (k, v) VALUES ('last-sync-cursor', 'c-42')`)
    driver.run(
      'INSERT INTO sync_catalog_tombstones(id,phrase_id,target_locale,deleted_at) VALUES(?,?,?,?)',
      [gone, 'b', 'es-ES', AT],
    )
    driver.run("INSERT INTO local_metadata(user_id,key,value) VALUES('local','test','private')")
    driver.run(
      "INSERT INTO session_checkpoint(user_id,target_locale,payload) VALUES('local','es-ES','{}')",
    )
    driver.run(
      "INSERT INTO committed_attempt(user_id,target_locale,attempt_id) VALUES('local','es-ES','attempt-1')",
    )
    driver.run(
      `INSERT INTO review_event(user_id,target_locale,attempt_id,phrase_id,reviewed_at,rating,
         algorithm,stability,difficulty,due,last_review,lapses,state)
       VALUES('local','es-ES','attempt-1',?, ?,3,'fsrs',1,5,?, ?,0,'review')`,
      [kept, AT, AT, AT],
    )
    for (const id of [kept, gone]) {
      db.outbox.append({
        entity: 'user_phrase',
        entityId: id,
        op: 'upsert',
        fields: { note: { v: 'a private mnemonic', hlc: 'h1' } },
        hlc: 'h1',
        createdAt: AT,
      })
    }
    db.outbox.recordFailure([1, 2], 'offline')
  })

  it('holds learner rows in every table before the wipe', () => {
    // Otherwise the assertions below would pass against a database that was already empty.
    for (const table of owned()) {
      const n = driver.all(`SELECT COUNT(*) AS n FROM "${table}"`)[0]?.['n']
      expect(n, `${table} has rows to erase`).not.toBe(0)
    }
  })

  it('leaves no row in ANY owned table, tombstones included', () => {
    db.wipe()
    for (const table of owned()) {
      expect(driver.all(`SELECT * FROM "${table}"`), `${table} still holds rows`).toEqual([])
    }
    // A tombstone is a row. Erasure is not the same operation as deletion, and this is the
    // one place a hard delete is correct (docs/architecture/data-model.md, invariant 6).
    expect(driver.all('SELECT * FROM user_phrase')).toEqual([])
  })

  it('leaves a schema at head that the app can immediately write to', () => {
    db.wipe()
    expect(currentVersion(driver)).toBe(SCHEMA_VERSION)
    expect(migrate(driver, AT).applied, 'no migration is owed').toEqual([])

    // Sequence ids survive erasure: a delayed acknowledgement for an erased op must
    // never match a fresh write from this same installation.
    db.phrases.upsert({ ...makePhrase('a'), id: userPhraseId('id-new') })
    db.outbox.append({
      entity: 'user_phrase',
      entityId: 'id-new',
      op: 'upsert',
      fields: { loved: { v: true, hlc: 'h1' } },
      hlc: 'h1',
      createdAt: AT,
    })
    expect(db.phrases.count()).toBe(1)
    expect(db.outbox.pending(10).map((o) => o.seq)).toEqual([3])
  })

  it('erases nothing when the wrapping transaction rolls back', () => {
    // `wipe()` deletes records atomically, so under a caller it runs in a savepoint. An
    // erasure that half-committed would be worse than one that failed outright.
    expect(() =>
      driver.transaction(() => {
        db.wipe()
        throw new Error('erasure aborted')
      }),
    ).toThrow(/erasure aborted/)

    expect(db.phrases.count(), 'the live row is back').toBe(1)
    expect(db.settings.load()?.goal).toBe('trip')
    expect(db.refrainDay.load(DAY)?.waves).toEqual(['morning'])
    expect(db.outbox.size()).toBe(2)
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('nested transactions', () => {
  /**
   * The savepoint branch of `driver.node.ts` — the half of `transaction()` no test reached.
   *
   * It exists because `migrate()` and `dropAll()` each wrap their own work and a caller may
   * reasonably wrap either, so a plain nested `BEGIN` would throw and a plain nested
   * `COMMIT` would commit the OUTER transaction early: the outbox's "a row write and its op
   * land together or not at all" would silently stop holding.
   */
  const table = 'CREATE TABLE t (id TEXT PRIMARY KEY)'

  it('does not commit the outer transaction when the inner one rolls back', () => {
    const driver = openNodeSqlite()
    driver.exec(table)

    driver.transaction(() => {
      driver.run('INSERT INTO t (id) VALUES (?)', ['outer'])
      expect(() =>
        driver.transaction(() => {
          driver.run('INSERT INTO t (id) VALUES (?)', ['inner'])
          throw new Error('inner failed')
        }),
      ).toThrow(/inner failed/)
      // The inner work is gone; the outer work is still pending, not committed.
      expect(driver.all('SELECT id FROM t').map((r) => r['id'])).toEqual(['outer'])
    })

    expect(driver.all('SELECT id FROM t').map((r) => r['id'])).toEqual(['outer'])
  })

  it('rolls the outer transaction back even after the inner one succeeded', () => {
    const driver = openNodeSqlite()
    driver.exec(table)

    expect(() =>
      driver.transaction(() => {
        driver.transaction(() => {
          driver.run('INSERT INTO t (id) VALUES (?)', ['inner'])
        })
        throw new Error('outer failed')
      }),
    ).toThrow(/outer failed/)

    // A released savepoint is not a commit. If the inner call had issued COMMIT, this row
    // would have survived a failure that must undo everything.
    expect(driver.all('SELECT id FROM t')).toEqual([])
  })

  it('commits once, at the outermost boundary', () => {
    const driver = openNodeSqlite()
    driver.exec(table)

    driver.transaction(() => {
      driver.transaction(() => {
        driver.transaction(() => {
          driver.run('INSERT INTO t (id) VALUES (?)', ['deep'])
        })
      })
    })

    expect(driver.all('SELECT id FROM t').map((r) => r['id'])).toEqual(['deep'])
  })

  it('returns the callback’s value through every level', () => {
    const driver = openNodeSqlite()
    expect(driver.transaction(() => driver.transaction(() => 41 + 1))).toBe(42)
  })
})

// ─────────────────────────────────────────────────────────────────────────────

/**
 * A real file, closed and reopened.
 *
 * Every other test here runs against `:memory:`, which cannot tell "the repository mapped
 * the column" from "the value reached the disk". A relaunch is the only thing that proves
 * durability, and it is the whole point of the Refrain's frozen day: `LB-03`'s `done` is a
 * fact about the learner, so it has to survive the process that recorded it.
 */
describe('across a close and reopen', () => {
  let file: string

  beforeEach(() => {
    file = join(mkdtempSync(join(tmpdir(), 'loro-persistence-')), 'loro.db')
  })

  afterEach(() => {
    rmSync(dirname(file), { recursive: true, force: true })
  })

  /** Open the same file again, running `migrate()` exactly as a relaunch would. */
  const reopen = (): [SqlDriver, Persistence] => {
    const driver = openNodeSqlite(file)
    return [driver, openSqlPersistence(driver, fakeHlc(), AT)]
  }

  it('keeps the day’s finished waves, set and substitutions on disk', () => {
    const row = {
      localDay: DAY,
      setIds: ['a', 'b', 'c'],
      waves: ['morning', 'midday'],
      substituted: ['c'],
      listenCounts: { a: 3 },
    }
    const [first, db] = reopen()
    db.refrainDay.save(row)
    first.close()

    const [second, reopened] = reopen()
    expect(reopened.refrainDay.load(DAY)).toEqual(row)
    expect(reopened.refrainDay.latest()).toEqual(row)
    second.close()
  })

  it('applies nothing on the second open, and refuses a database from the future', () => {
    const [first, db] = reopen()
    db.phrases.upsert({ ...makePhrase('a'), id: userPhraseId('id-a') })
    db.phrases.softDelete(userPhraseId('id-a'), AT)
    first.close()

    const second = openNodeSqlite(file)
    expect(currentVersion(second)).toBe(SCHEMA_VERSION)
    expect(migrate(second, AT).applied).toEqual([])
    // The tombstone is a row on disk, not a filtered read — that is what makes the deletion
    // syncable rather than looking like a row that never existed.
    expect(
      second.all('SELECT deleted_at FROM user_phrase WHERE id = ?', ['id-a'])[0]?.['deleted_at'],
    ).toBe(AT)
    second.close()
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
