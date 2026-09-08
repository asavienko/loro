import { describe, expect, it } from 'vitest'
import { MIGRATIONS, migrate, openSqlPersistence, openMemoryPersistence } from '@loro/core'
import { makePhrase } from '@loro/core/testing'
import { openNodeSqlite } from './driver.node'

const AT = 1_785_231_660_000
describe('F-08 language persistence', () => {
  for (const kind of ['sqlite', 'memory'] as const)
    it(`${kind}: keeps course sessions and daily sets separate`, () => {
      const db =
        kind === 'sqlite'
          ? openSqlPersistence(openNodeSqlite(), () => 'test', AT)
          : openMemoryPersistence()
      db.settings.save({
        onboarded: true,
        goal: null,
        level: null,
        dailyMinutes: 10,
        waveTimes: [],
        languagePair: { nativeLanguage: 'ru', targetLocale: 'bg-BG' },
      })
      expect(db.settings.load()?.languagePair).toEqual({
        nativeLanguage: 'ru',
        targetLocale: 'bg-BG',
      })
      expect(() => {
        db.settings.save({
          onboarded: true,
          goal: null,
          level: null,
          dailyMinutes: 10,
          waveTimes: [],
          languagePair: { nativeLanguage: 'bg', targetLocale: 'bg-BG' },
        })
      }).toThrow('Invalid language pair')
      expect(db.settings.load()?.languagePair).toEqual({
        nativeLanguage: 'ru',
        targetLocale: 'bg-BG',
      })
      for (const targetLocale of ['es-ES', 'bg-BG', 'ru-RU'] as const) {
        db.courses.save({
          targetLocale,
          onboarded: true,
          selectedId: targetLocale,
          streamCursor: 2,
          refrainSession: null,
        })
        db.refrainDay.save({
          targetLocale,
          localDay: '2026-07-28',
          setIds: [targetLocale],
          waves: [targetLocale],
          substituted: [],
        })
        db.phrases.upsert({ ...makePhrase(targetLocale), targetLocale, ownMeaningLanguage: 'bg' })
      }
      for (const target of ['es-ES', 'bg-BG', 'ru-RU'] as const) {
        expect(db.courses.load(target)?.selectedId).toBe(target)
        expect(db.refrainDay.load('2026-07-28', target)?.setIds).toEqual([target])
        expect(db.refrainDay.latest(target)?.setIds).toEqual([target])
        expect(db.refrainDay.load('2026-07-28', target)?.waves).toEqual([target])
      }
      expect(db.phrases.all().every((p) => p.ownMeaningLanguage === 'bg')).toBe(true)
      db.wipe()
      expect(db.courses.load('bg-BG')).toBeNull()
    })
  it('upgrades legacy settings and sets without modifying queued operations', () => {
    const driver = openNodeSqlite()
    const initial = MIGRATIONS[0]
    if (!initial) throw new Error('Missing initial migration')
    driver.exec(initial.up)
    driver.exec(
      'CREATE TABLE schema_version (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at INTEGER NOT NULL)',
    )
    driver.run('INSERT INTO schema_version VALUES (1, ?, ?)', ['initial', AT])
    driver.run(
      "INSERT INTO settings(user_id, onboarded, updated_hlc) VALUES ('local', 1, 'legacy')",
    )
    driver.run(
      "INSERT INTO refrain_day(user_id, local_day, set_ids, waves, substituted) VALUES ('local', '2026-07-28', '[\"old-id\"]', '[]', '[]')",
    )
    // Even whitespace in an attempted operation's persisted payload is retained:
    // migration must never regenerate a request the server may already have seen.
    const queuedPayload = '{\n  "note": {"v":"Keep my phrase", "hlc":"legacy"}\n}'
    driver.run(
      "INSERT INTO outbox(entity, entity_id, op, payload, hlc, created_at, attempts, last_error) VALUES ('user_phrase', 'old-id', 'upsert', ?, 'legacy', ?, 2, 'IN_FLIGHT')",
      [queuedPayload, AT],
    )
    const beforeOutbox = driver.all('SELECT * FROM outbox')
    const beforeTables = driver.all('SELECT * FROM settings')
    expect(migrate(driver, AT).applied).toEqual([2, 3, 4])
    const db = openSqlPersistence(driver, () => 'new', AT)
    expect(db.settings.load()?.onboarded).toBe(true)
    expect(db.refrainDay.latest()?.setIds).toEqual(['old-id'])
    expect(db.courses.load('es-ES')?.onboarded).toBe(true)
    expect(driver.all('SELECT user_id, updated_hlc FROM settings')).toEqual(
      beforeTables.map((r) => ({ user_id: r['user_id'], updated_hlc: r['updated_hlc'] })),
    )
    expect(driver.all('SELECT * FROM outbox')).toEqual(
      beforeOutbox.map((row) => ({ ...row, replaces: null })),
    )
    expect(driver.all('SELECT payload FROM outbox')[0]?.['payload']).toBe(queuedPayload)
    expect(db.outbox.pending(1)[0]).toMatchObject({
      entityId: 'old-id',
      fields: { note: { v: 'Keep my phrase', hlc: 'legacy' } },
      attempts: 2,
    })
    expect(db.outbox.pending(1)[0]?.replaces).toBeUndefined()
    expect(driver.all('SELECT * FROM sync_catalog_tombstones')).toEqual([])
    expect(migrate(driver, AT).applied).toEqual([])
    driver.close()
  })
})
