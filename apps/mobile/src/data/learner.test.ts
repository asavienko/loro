import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { afterEach, describe, expect, it } from 'vitest'
import { openSqlPersistence, userPhraseId, type Clock, type SqlDriver } from '@loro/core'
import { makePhrase } from '@loro/core/testing'
import { createAppStore, reloadStorePersistence } from '../store/store'
import { INITIAL_STATE } from '../store/state'
import { createLearnerStorage } from './learner'
import { openNodeSqlite } from './driver.node'
import { flushPendingDeletes } from './pendingDeletes'
import { UNDO_TOAST_MS } from '../lib/toastTiming'
import { writeLocalValue } from './database'

const AT = 1_785_231_660_000
const DAY = '2026-07-28'
let at = AT
let day = DAY
const clock: Clock = { now: () => at, localDay: () => day, streakDay: () => day }
const dirs: string[] = []
const drivers: SqlDriver[] = []
afterEach(() => {
  for (const driver of drivers.splice(0)) {
    try {
      driver.close()
    } catch {
      /* already closed */
    }
  }
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
  at = AT
  day = DAY
})
function open(path = ':memory:') {
  const driver = openNodeSqlite(path)
  drivers.push(driver)
  let count = 0
  const hlc = () => `${String(at)}:${String(count++)}:test`
  const persistence = openSqlPersistence(driver, hlc, at)
  const database = { driver, persistence, hlc, deviceId: 'test-device' }
  const storage = createLearnerStorage(database, clock)
  const store = createAppStore({
    clock,
    newId: () => userPhraseId(`own-${String(count++)}`),
    storage,
  })
  return { ...database, storage, store }
}
function diskPath(): string {
  const dir = mkdtempSync(join(tmpdir(), 'loro-progress-'))
  dirs.push(dir)
  return join(dir, 'loro.sqlite')
}

describe('repository-backed learner state', () => {
  it('reopens every course, phrase identity, streak day, settings and resume cursor', () => {
    const path = diskPath()
    const first = open(path)
    const phrase = { ...makePhrase('es-owned'), targetLocale: 'es-ES' as const }
    first.store.setState({
      onboarded: true,
      languageChosen: true,
      phrases: [phrase],
      goal: 'travel',
      level: 'beg',
    })
    first.store.getState().ensureRefrainSet()
    first.store
      .getState()
      .applyDelta(
        { phraseId: phrase.id, reps: 1, repsToday: 1, lastPracticedAt: at },
        { refrainCursor: 1 },
      )
    first.store.getState().setLanguages('en', 'ru-RU')
    const russian = {
      ...makePhrase('ru-owned'),
      phraseId: null,
      ownEs: 'Спасибо',
      ownEn: 'Thanks',
      targetLocale: 'ru-RU' as const,
    }
    first.store.setState({ onboarded: true, phrases: [russian], streamCursor: 4 })
    first.store.getState().setNote(russian.id, 'A personal note')
    const pending = first.persistence.outbox.pending(1000)
    first.driver.close()

    const reopened = open(path)
    expect(reopened.store.getState()).toMatchObject({
      targetLocale: 'ru-RU',
      nativeLanguage: 'en',
      streamCursor: 4,
      goal: 'travel',
      practiceDays: [DAY],
    })
    expect(reopened.store.getState().phrases[0]).toMatchObject({
      id: russian.id,
      note: 'A personal note',
    })
    expect(reopened.persistence.outbox.pending(1000)).toEqual(pending)
    reopened.store.getState().setLanguages('en', 'es-ES')
    expect(reopened.store.getState().phrases[0]).toMatchObject({ id: phrase.id, reps: 1 })
    expect(reopened.store.getState().refrainResume.cursor).toBe(1)
  })

  it('does not publish progress or a cursor when appending the matching outbox operation fails', () => {
    const db = open()
    const phrase = makePhrase('phrase')
    db.store.setState({ onboarded: true, phrases: [phrase] })
    db.persistence.outbox.ack(db.persistence.outbox.pending(1000).map((op) => op.seq))
    const previous = db.store.getState()
    db.driver.exec(
      `CREATE TRIGGER fail_outbox BEFORE INSERT ON outbox BEGIN SELECT RAISE(ABORT, 'disk full'); END;`,
    )
    expect(() => {
      db.store.getState().applyDelta({ phraseId: phrase.id, reps: 1 }, { refrainCursor: 1 })
    }).toThrow('disk full')
    expect(db.store.getState()).toBe(previous)
    expect(db.persistence.phrases.byId(phrase.id)?.reps).toBe(0)
    expect(db.persistence.courses.load('es-ES')?.refrainSession).toContain('"cursor":0')
    expect(db.persistence.outbox.size()).toBe(0)
  })

  it('SQLite recovers an abruptly exited writer without publishing a partial progress/outbox transaction', () => {
    const path = diskPath()
    const db = open(path)
    const phrase = makePhrase('phrase')
    db.store.setState({ phrases: [phrase] })
    const pending = db.persistence.outbox.size()
    db.driver.close()
    const crashed = spawnSync(process.execPath, [
      '--input-type=module',
      '-e',
      `
      import { DatabaseSync } from 'node:sqlite';
      const db = new DatabaseSync(process.argv[1]);
      db.exec('BEGIN IMMEDIATE');
      db.prepare('UPDATE user_phrase SET reps = 99 WHERE id = ?').run('phrase');
      process.exit(0);
    `,
      path,
    ])
    expect(crashed.status).toBe(0)
    const recovered = open(path)
    expect(recovered.store.getState().phrases[0]?.reps).toBe(0)
    expect(recovered.persistence.outbox.size()).toBe(pending)
  })

  it('undo restores identity before the durable delete deadline and cannot create a synced resurrection', () => {
    const db = open()
    const phrase = makePhrase('phrase')
    db.store.setState({ phrases: [phrase] })
    db.store.getState().removePhrase(phrase.id)
    expect(db.persistence.phrases.byId(phrase.id)).toBeNull()
    expect(db.persistence.outbox.pending(100).some((op) => op.op === 'delete')).toBe(false)
    db.store.getState().toast?.undo?.()
    expect(db.persistence.phrases.byId(phrase.id)?.id).toBe(phrase.id)
    db.store.getState().removePhrase(phrase.id)
    const undo = db.store.getState().toast?.undo
    at += UNDO_TOAST_MS + 1
    expect(flushPendingDeletes(db, at)).toBe(1)
    expect(db.persistence.outbox.pending(100).filter((op) => op.op === 'delete')).toHaveLength(1)
    expect(() => undo?.()).toThrow('undo period')
    expect(db.persistence.phrases.byId(phrase.id)).toBeNull()
  })

  it('erases learner rows, pending operations and sessions through the reset action', () => {
    const db = open()
    db.store.setState({ phrases: [makePhrase('phrase')], onboarded: true, languageChosen: true })
    db.store.getState().reset()
    expect(db.store.getState().phrases).toEqual([])
    expect(db.store.getState().targetLocale).toBe(INITIAL_STATE.targetLocale)
    expect(db.persistence.outbox.size()).toBe(0)
    expect(db.persistence.courses.load('es-ES')).toBeNull()
  })

  it('an explicit re-add records deletion proof and orders it after its original tombstone', () => {
    const db = open()
    const original = makePhrase('original')
    db.store.setState({ phrases: [original] })
    db.store.getState().removePhrase(original.id)
    const replacement = { ...original, id: userPhraseId('replacement') }
    db.store.setState({ phrases: [replacement] })
    const pending = db.persistence.outbox.pending(100)
    const deletion = pending.find((op) => op.op === 'delete' && op.entityId === original.id)
    const addition = pending.find((op) => op.entityId === replacement.id)
    expect(addition?.replaces).toEqual({ id: original.id, deleted_at: at })
    expect(deletion?.seq).toBeLessThan(addition?.seq ?? 0)
    expect(db.persistence.phrases.all().map((row) => row.id)).toEqual([replacement.id])
  })

  it('undo follows a catalog identity alias learned while the toast is visible', () => {
    const db = open()
    const original = makePhrase('original')
    db.store.setState({ phrases: [original] })
    db.store.getState().removePhrase(original.id)
    db.driver.transaction(() => {
      db.driver.run('UPDATE user_phrase SET id = ? WHERE id = ?', ['canonical', original.id])
      writeLocalValue(db.driver, 'sync.aliases', JSON.stringify({ original: 'canonical' }))
      writeLocalValue(
        db.driver,
        'pending_phrase_deletes',
        JSON.stringify({ canonical: { at, readyAt: at + UNDO_TOAST_MS } }),
      )
    })
    reloadStorePersistence(db.store)
    db.store.getState().toast?.undo?.()
    expect(db.persistence.phrases.all().map((row) => row.id)).toEqual(['canonical'])
  })

  it('a timezone change restores an already frozen day instead of reselecting it', () => {
    const path = diskPath()
    const db = open(path)
    db.store.setState({
      phrases: Array.from({ length: 7 }, (_, i) => makePhrase(`phrase-${String(i)}`)),
    })
    db.store.getState().ensureRefrainSet()
    const original = [...db.store.getState().refrainSet]
    db.store.getState().markLearned(original[0]!, true)
    day = '2026-07-29'
    db.store.getState().ensureRefrainSet()
    expect(db.store.getState().refrainSet).not.toEqual(original)
    db.store.setState({ refrainResume: { ...db.store.getState().refrainResume, cursor: 9 } })
    day = DAY
    db.driver.close()
    const reopened = open(path)
    expect(reopened.store.getState().refrainSet).toEqual(original)
    expect(reopened.store.getState().refrainResume.cursor).toBe(0)
    reopened.store.getState().ensureRefrainSet()
    expect(reopened.store.getState().refrainSet).toEqual(original)
  })

  it('a fresh device can prove replacement of a pulled catalog tombstone without inventing a live row', () => {
    const db = open()
    const replacement = makePhrase('new')
    db.driver.run(
      'INSERT INTO sync_catalog_tombstones(id, phrase_id, target_locale, deleted_at) VALUES (?, ?, ?, ?)',
      ['remote-deleted', replacement.phraseId, 'es-ES', at],
    )
    db.store.setState({ phrases: [replacement] })
    expect(
      db.persistence.outbox.pending(100).find((op) => op.entityId === replacement.id)?.replaces,
    ).toEqual({ id: 'remote-deleted', deleted_at: at })
    expect(db.persistence.phrases.all().map((phrase) => phrase.id)).toEqual([replacement.id])
  })

  it('a deletion deadline survives a close and reopen without an in-memory timer', () => {
    const path = diskPath()
    const db = open(path)
    const phrase = makePhrase('phrase')
    db.store.setState({ phrases: [phrase] })
    db.store.getState().removePhrase(phrase.id)
    db.driver.close()
    at += UNDO_TOAST_MS + 1
    const reopened = open(path)
    expect(flushPendingDeletes(reopened, at)).toBe(1)
    expect(flushPendingDeletes(reopened, at)).toBe(0)
    expect(reopened.store.getState().phrases).toEqual([])
    expect(
      reopened.persistence.outbox.pending(100).filter((op) => op.op === 'delete'),
    ).toHaveLength(1)
  })
})
