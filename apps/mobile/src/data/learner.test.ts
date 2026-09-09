import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { afterEach, describe, expect, it } from 'vitest'
import {
  openSqlPersistence,
  userPhraseId,
  type Clock,
  type SqlDriver,
  type SessionHandle,
} from '@loro/core'
import { makePhrase } from '@loro/core/testing'
import { createAppStore, reloadStorePersistence } from '../store/store'
import { INITIAL_STATE } from '../store/state'
import { createLearnerStorage } from './learner'
import { openNodeSqlite } from './driver.node'
import { flushPendingDeletes } from './pendingDeletes'
import { UNDO_TOAST_MS } from '../lib/toastTiming'
import { writeLocalValue } from './database'
import { loadLearningCatalog } from '@loro/content'
import type { PracticeCommitContext } from '../store/types'

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
function sessionFor(id: string): SessionHandle {
  return {
    sessionId: 'session-1',
    cursor: 0,
    plan: {
      engineId: 'refrain',
      estimatedMs: 0,
      closed: true,
      items: Array.from({ length: 10 }, (_, index) => ({
        itemId: `${id}:${String(index)}`,
        phraseId: userPhraseId(id),
        mode: 'echo',
        prompt: { show: 'full' },
        gate: { kind: 'self-report' },
        audio: null,
        meta: { repIndex: index, repTarget: 10 },
      })),
    },
  }
}
function diskPath(): string {
  const dir = mkdtempSync(join(tmpdir(), 'loro-progress-'))
  dirs.push(dir)
  return join(dir, 'loro.sqlite')
}

describe('repository-backed learner state', () => {
  function preparedPractice(path = ':memory:') {
    const db = open(path)
    db.store.setState({ phrases: [makePhrase('practised')], onboarded: true })
    db.store.getState().ensureRefrainSet()
    const resume = { ...db.store.getState().refrainResume, session: sessionFor('practised') }
    db.store.setState({ refrainResume: resume })
    const algorithm = 'fsrs-6-default-c8ca282-loro-v1'
    const delta = {
      phraseId: userPhraseId('practised'),
      reps: 1,
      repsToday: 1,
      lastPracticedAt: at,
      srs: {
        stability: 4,
        difficulty: 5,
        due: at + 86_400_000,
        lastReview: at,
        lapses: 0,
        state: 'review' as const,
        algorithm,
      },
      review: { at, grade: 3 as const, algorithm },
    }
    const context: PracticeCommitContext = {
      attemptId: 'attempt-1',
      targetLocale: 'es-ES',
      localDay: DAY,
      streakDay: DAY,
      expectedPhrase: db.store.getState().phrases[0]!,
      sessionId: resume.session.sessionId,
      expectedCursor: 0,
      checkpoint: { ...resume, cursor: 1, session: { ...resume.session, cursor: 1 } },
    }
    return { ...db, delta, context }
  }

  it('deduplicates a completed attempt across a database close and reopen with one review receipt', () => {
    const path = diskPath()
    const first = preparedPractice(path)
    first.store.getState().applyDelta(first.delta, first.context)
    first.store.getState().applyDelta(first.delta, first.context)
    const queued = first.persistence.outbox.pending(100)
    first.driver.close()
    const next = open(path)
    next.store.getState().applyDelta(first.delta, first.context)
    expect(next.store.getState().phrases[0]?.reps).toBe(1)
    expect(next.store.getState().refrainResume.cursor).toBe(1)
    expect(next.driver.all('SELECT * FROM review_event')).toHaveLength(1)
    expect(next.driver.all('SELECT * FROM committed_attempt')).toHaveLength(1)
    expect(next.persistence.outbox.pending(100)).toEqual(queued)
    expect(queued.filter((op) => op.entity === 'review_log')).toHaveLength(1)
  })

  it('rolls back the delta, checkpoint, attempt, review and outbox together when journal insertion fails', () => {
    const db = preparedPractice()
    const previous = db.store.getState()
    const queued = db.persistence.outbox.pending(100)
    db.driver.exec(
      "CREATE TRIGGER fail_review BEFORE INSERT ON review_event BEGIN SELECT RAISE(ABORT,'disk full'); END",
    )
    expect(() => {
      db.store.getState().applyDelta(db.delta, db.context)
    }).toThrow('disk full')
    expect(db.store.getState()).toBe(previous)
    expect(db.persistence.phrases.byId(db.delta.phraseId)?.reps).toBe(0)
    expect(db.driver.all('SELECT * FROM committed_attempt')).toEqual([])
    expect(db.persistence.outbox.pending(100)).toEqual(queued)
    db.driver.exec('DROP TRIGGER fail_review')
    db.store.getState().applyDelta(db.delta, db.context)
    expect(db.store.getState().refrainResume.cursor).toBe(1)
    expect(db.persistence.phrases.byId(db.delta.phraseId)?.reps).toBe(1)
  })

  it('rejects an asynchronous outcome after the repository phrase changed under the displayed snapshot', () => {
    const db = preparedPractice()
    db.driver.run('UPDATE user_phrase SET note=? WHERE id=?', [
      'Other device note',
      db.delta.phraseId,
    ])
    expect(() => {
      db.store.getState().applyDelta(db.delta, db.context)
    }).toThrow('Practice phrase has changed')
    expect(db.persistence.phrases.byId(db.delta.phraseId)?.note).toBe('Other device note')
    expect(db.driver.all('SELECT * FROM committed_attempt')).toEqual([])
  })

  it('preserves cold-entry additions and catalog tombstones when onboarding seeds a pack', () => {
    const db = open()
    const pack = loadLearningCatalog('es-ES', 'en').packs[0]!
    const keep = pack.phrases[0]!,
      removed = pack.phrases[1]!
    db.store.getState().addPhrase(keep)
    const kept = db.store.getState().phrases[0]!
    db.store.getState().setNote(kept.id, 'Keep my note')
    db.store.getState().addPhrase(removed)
    const deleted = db.store.getState().phrases.find((phrase) => phrase.phraseId === removed)!
    db.store.getState().removePhrase(deleted.id)
    const own = db.store
      .getState()
      .addOwnPhrase({ targetText: 'Mi frase', translation: 'My phrase' })
    db.store
      .getState()
      .completeOnboarding({ goal: 'travel', level: 'beg', dailyMinutes: 10, packIds: [pack.id] })
    expect(db.store.getState().phrases.find((phrase) => phrase.id === kept.id)?.note).toBe(
      'Keep my note',
    )
    expect(db.store.getState().phrases.some((phrase) => phrase.id === own)).toBe(true)
    expect(db.store.getState().phrases.some((phrase) => phrase.phraseId === removed)).toBe(false)
  })

  it('persists an explicitly accepted own phrase with its current language pair and sync op', () => {
    const path = diskPath()
    const first = open(path)
    first.store.getState().setLanguages('bg', 'ru-RU')
    const id = first.store
      .getState()
      .addOwnPhrase({ targetText: 'Доброе утро', translation: 'Добро утро' })
    expect(first.persistence.outbox.pending(100)).toEqual(
      expect.arrayContaining([expect.objectContaining({ entity: 'user_phrase', entityId: id })]),
    )
    first.driver.close()

    const reopened = open(path)
    expect(reopened.store.getState().phrases).toContainEqual(
      expect.objectContaining({
        id,
        phraseId: null,
        ownEs: 'Доброе утро',
        ownEn: 'Добро утро',
        ownMeaningLanguage: 'bg',
        targetLocale: 'ru-RU',
      }),
    )
  })

  it('stages nested onboarding actions and keeps transient error toasts usable when writes fail', () => {
    const db = open()
    const previous = db.store.getState()
    db.driver.exec(
      "CREATE TRIGGER fail_set BEFORE INSERT ON refrain_day BEGIN SELECT RAISE(ABORT,'disk full'); END",
    )
    expect(() => {
      db.store
        .getState()
        .completeOnboarding({ goal: 'travel', level: 'beg', dailyMinutes: 10, packIds: ['cafe'] })
    }).toThrow('disk full')
    expect(db.store.getState()).toBe(previous)
    expect(db.persistence.phrases.all()).toEqual([])
    expect(db.persistence.outbox.pending(100)).toEqual([])
    db.store.getState().showToast('Could not save')
    expect(db.store.getState().toast?.message).toBe('Could not save')
    expect(db.persistence.outbox.pending(100)).toEqual([])
  })

  it('discards malformed resume data while preserving valid phrase progress', () => {
    const db = preparedPractice()
    db.driver.run('UPDATE course_session SET refrain_session=?', ['{"session":'])
    expect(db.storage.load().phrases[0]?.id).toBe(db.delta.phraseId)
    expect(db.storage.load().refrainResume.session).toBeNull()
  })
  it('discards a persisted checkpoint whose displayed and engine cursors disagree', () => {
    const db = preparedPractice()
    const resume = db.store.getState().refrainResume
    db.driver.run('UPDATE course_session SET refrain_session=?', [
      JSON.stringify({ ...resume, version: 1, localDay: DAY, cursor: 1 }),
    ])
    const restored = db.storage.load()
    expect(restored.phrases[0]?.id).toBe(db.delta.phraseId)
    expect(restored.refrainResume).toEqual(expect.objectContaining({ session: null, cursor: 0 }))
  })
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
    first.store.setState({
      refrainResume: { ...first.store.getState().refrainResume, session: sessionFor(phrase.id) },
    })
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

  it('persists a completed Refrain wave with its frozen day', () => {
    const path = diskPath()
    const first = open(path)
    first.store.setState({ onboarded: true, phrases: [makePhrase('wave')] })
    first.store.getState().ensureRefrainSet()
    first.store.getState().completeRefrainWave('morning', first.store.getState().refrainResume)
    first.driver.close()

    const reopened = open(path)
    expect(reopened.store.getState().refrainWaves).toEqual(['morning'])
    expect(reopened.persistence.refrainDay.load(DAY)?.waves).toEqual(['morning'])
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
    db.store.setState({
      refrainResume: {
        ...db.store.getState().refrainResume,
        session: { ...sessionFor(db.store.getState().refrainSet[0]!), cursor: 9 },
        cursor: 9,
      },
    })
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

describe('F-05/F-06 device-local analytics consent', () => {
  it('defaults off on an existing installation without changing synced settings', () => {
    const db = open()
    db.store
      .getState()
      .completeOnboarding({ goal: 'travel', level: 'beg', dailyMinutes: 10, packIds: [] })
    const settings = db.persistence.settings.load()
    const outbox = db.driver.all('SELECT * FROM outbox')
    db.store.getState().setAnalyticsConsent(true)
    expect(db.persistence.settings.load()).toEqual(settings)
    expect(db.driver.all('SELECT * FROM outbox')).toEqual(outbox)
    expect(db.storage.load().devicePreferences.analyticsConsent).toBe(true)
  })

  it('survives reopening, revokes durably, and preserves progress and active course state', () => {
    const path = diskPath()
    const db = open(path)
    expect(db.store.getState().devicePreferences.analyticsConsent).toBe(false)
    db.store.setState({ phrases: [makePhrase('consent-phrase')], streamCursor: 3, onboarded: true })
    const before = db.storage.load()
    db.store.getState().setAnalyticsConsent(true)
    expect(db.storage.load()).toEqual({
      ...before,
      devicePreferences: { version: 1, analyticsConsent: true },
    })
    db.driver.close()
    const reopened = open(path)
    expect(reopened.store.getState().devicePreferences.analyticsConsent).toBe(true)
    expect(reopened.store.getState().phrases).toEqual(before.phrases)
    expect(reopened.store.getState().streamCursor).toBe(3)
    reopened.store.getState().setAnalyticsConsent(false)
    reopened.driver.close()
    expect(open(path).store.getState().devicePreferences.analyticsConsent).toBe(false)
  })

  it.each([
    'not-json',
    '{}',
    '{"version":2,"analyticsConsent":true}',
    '{"version":1,"analyticsConsent":"true"}',
  ])('fails closed when loading invalid or unsupported preferences: %s', (value) => {
    const db = open()
    writeLocalValue(db.driver, 'device_preferences', value)
    expect(db.storage.load().devicePreferences.analyticsConsent).toBe(false)
  })

  it('reset clears consent and invalid runtime updates cannot grant it', () => {
    const db = open()
    expect(() => {
      db.store.getState().setAnalyticsConsent('true' as unknown as boolean)
    }).toThrow()
    expect(db.storage.load().devicePreferences.analyticsConsent).toBe(false)
    db.store.getState().setAnalyticsConsent(true)
    db.store.getState().reset()
    expect(db.storage.load().devicePreferences.analyticsConsent).toBe(false)
  })

  it('does not publish consent if its SQLite write fails', () => {
    const db = open()
    db.driver.run(
      "CREATE TRIGGER reject_consent BEFORE INSERT ON kv WHEN NEW.k = 'device_preferences' BEGIN SELECT RAISE(ABORT, 'write failed'); END",
    )
    expect(() => {
      db.store.getState().setAnalyticsConsent(true)
    }).toThrow('write failed')
    expect(db.store.getState().devicePreferences.analyticsConsent).toBe(false)
    expect(db.storage.load().devicePreferences.analyticsConsent).toBe(false)
  })
})
