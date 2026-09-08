import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'
import {
  MIGRATIONS,
  migrate,
  openSqlPersistence,
  encodeCheckpoint,
  userPhraseId,
  type SqlDriver,
} from '@loro/core'
import { openNodeSqlite } from './driver.node'
import { createLearnerStorage } from './learner'
import { readLocalValue } from './database'

const AT = 1_785_231_660_000
const DAY = '2026-07-28'
const drivers: SqlDriver[] = []
afterEach(() => {
  for (const driver of drivers.splice(0)) driver.close()
})
function preview(version: 2 | 4): SqlDriver {
  const driver = openNodeSqlite()
  drivers.push(driver)
  driver.exec(
    'CREATE TABLE schema_version(version INTEGER PRIMARY KEY,name TEXT NOT NULL,applied_at INTEGER NOT NULL)',
  )
  for (const migration of MIGRATIONS.filter((item) => item.version <= version)) {
    driver.exec(migration.up)
    driver.run('INSERT INTO schema_version VALUES(?,?,?)', [migration.version, migration.name, AT])
  }
  return driver
}
function seedPhrase(driver: SqlDriver) {
  driver.run(
    `INSERT INTO user_phrase(id,user_id,own_es,own_en,source,added_at,updated_hlc,
    target_locale,srs_stability,srs_difficulty,srs_due,srs_last_review,srs_lapses,srs_state,reps)
    VALUES('owned','local','Hola','Hello','own',?,'123:0:device','es-ES',3.5,4.2,?,?,2,'review',17)`,
    [AT, AT + 5000, AT],
  )
}

describe('forward migration of both native preview histories', () => {
  it('imports a real legacy checkpoint and attempt without changing queued requests or learned state', () => {
    const driver = preview(2)
    driver.exec(
      readFileSync(new URL('./fixtures/local-commit-preview-v3.sql', import.meta.url), 'utf8'),
    )
    driver.run("INSERT INTO schema_version VALUES(3,'local_commit_records',?)", [AT])
    seedPhrase(driver)
    driver.run("UPDATE user_phrase SET srs_algorithm='fsrs-6-default-c8ca282-loro-v1'")
    driver.run(
      "INSERT INTO settings(user_id,onboarded,updated_hlc) VALUES('local',1,'123:0:device')",
    )
    driver.run(
      "INSERT INTO course_session(user_id,target_locale,onboarded) VALUES('local','es-ES',1)",
    )
    const session = {
      sessionId: 'preview-session',
      cursor: 1,
      plan: {
        engineId: 'refrain' as const,
        closed: true,
        estimatedMs: 0,
        items: [0, 1].map((i) => ({
          itemId: `item-${String(i)}`,
          phraseId: userPhraseId('owned'),
          mode: 'echo',
          prompt: { show: 'full' as const },
          gate: { kind: 'self-report' as const },
          audio: null,
          meta: { repIndex: i, repTarget: 2 },
        })),
      },
    }
    const checkpoint = encodeCheckpoint({
      version: 1,
      targetLocale: 'es-ES',
      localDay: DAY,
      revision: 4,
      contentSignature: JSON.stringify([['owned', null, 'Hola', []]]),
      streamCursor: 3,
      refrainResume: { session, cursor: 1, done: false, lastLatency: null, history: [] },
    })
    driver.run("INSERT INTO session_checkpoint VALUES('local','es-ES',?)", [checkpoint])
    driver.run("INSERT INTO committed_attempt VALUES('local','es-ES','attempt-1')")
    driver.run("INSERT INTO local_metadata VALUES('local','installation-id','preview-device')")
    const payload = '{\n "reps": {"v": 17, "hlc": "123:0:device"}\n}'
    driver.run(
      `INSERT INTO outbox(seq,user_id,entity,entity_id,op,payload,hlc,created_at,attempts,last_error)
      VALUES(17,'local','user_phrase','owned','upsert',?,'123:0:device',?,2,'IN_FLIGHT')`,
      [payload, AT],
    )
    const before = driver.all('SELECT * FROM user_phrase')
    const queued = driver.all('SELECT * FROM outbox')
    expect(migrate(driver, AT + 1).applied).toEqual([4, 5])
    expect(driver.all('SELECT * FROM user_phrase')).toEqual(before)
    expect(driver.all('SELECT * FROM outbox')).toEqual(
      queued.map((row) => ({ ...row, replaces: null })),
    )
    expect(readLocalValue(driver, 'device_id')).toBe('preview-device')
    const persistence = openSqlPersistence(driver, () => '124:0:device', AT)
    const storage = createLearnerStorage(
      { driver, persistence, hlc: () => '124:0:device', deviceId: 'preview-device' },
      { now: () => AT, localDay: () => DAY, streakDay: () => DAY },
    )
    expect(storage.load().refrainResume).toMatchObject({ session, cursor: 1 })
    expect(storage.hasAttempt({ attemptId: 'attempt-1', targetLocale: 'es-ES' })).toBe(true)
    expect(migrate(driver, AT + 2).applied).toEqual([])
  })

  it('labels the real 90-percent preview policy without recomputing any scheduling evidence', () => {
    const driver = preview(4)
    seedPhrase(driver)
    const before = driver.all('SELECT * FROM user_phrase')[0]
    expect(migrate(driver, AT + 1).applied).toEqual([5])
    expect(driver.all('SELECT * FROM user_phrase')[0]).toEqual({
      ...before,
      srs_algorithm: 'fsrs-6/py-fsrs-6.3.2/default-90-no-steps',
    })
  })
})
