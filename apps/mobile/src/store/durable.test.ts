import { fakeCore } from '@loro/core/testing'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { openSqlPersistence, userPhraseId, type Clock } from '@loro/core'
import { openNodeSqlite } from '../data/driver.node'
import { createRuntimePersistence } from '../data/runtimePersistence'
import { createAppStore } from './store'
import { loadLearningCatalog } from './catalog'

const clock: Clock = {
  now: () => 1_789_000_000_000,
  localDay: () => '2026-09-07',
  streakDay: () => '2026-09-07',
}
const closers: (() => void)[] = []
afterEach(() => {
  for (const close of closers.splice(0)) close()
})
function fixture() {
  const driver = openNodeSqlite()
  closers.push(() => {
    driver.close()
  })
  let sequence = 0
  const persistence = openSqlPersistence(driver, () => `test-${++sequence}`, clock.now())
  const storage = createRuntimePersistence(persistence, { clock })
  const make = () =>
    createAppStore({
      core: fakeCore(),
      clock,
      newId: () => userPhraseId(`phrase-${++sequence}`),
      persistence: storage,
    })
  return { driver, persistence, make, store: make() }
}
const seed = (store: ReturnType<typeof createAppStore>) => {
  store
    .getState()
    .completeOnboarding({ goal: 'curious', level: 'beg', dailyMinutes: 10, packIds: ['cafe'] })
}

describe('SQLite store transaction boundary', () => {
  it('hydrates ordered courses and committed progress without reseeding', () => {
    const { store, make, persistence } = fixture()
    seed(store)
    const phrase = store.getState().phrases[0]!
    store.getState().setNote(phrase.id, 'personal meaning')
    store.getState().applyDelta({ phraseId: phrase.id, reps: 1 })
    store.setState({ streamCursor: 2 })
    store.getState().setLanguages('en', 'bg-BG')
    seed(store)
    const bgIds = store.getState().phrases.map((p) => p.id)
    const reopened = make()
    expect(reopened.getState().targetLocale).toBe('bg-BG')
    expect(reopened.getState().phrases.map((p) => p.id)).toEqual(bgIds)
    reopened.getState().setLanguages('en', 'es-ES')
    expect(reopened.getState().streamCursor).toBe(2)
    expect(reopened.getState().phrases[0]).toMatchObject({
      id: phrase.id,
      reps: 1,
      note: 'personal meaning',
    })
    expect(persistence.outbox.size()).toBeGreaterThan(0)
  })
  it('rolls back phrase, checkpoint and outbox before publishing on write failure', () => {
    const { store, driver, persistence } = fixture()
    seed(store)
    const before = store.getState()
    const pending = persistence.outbox.size()
    driver.exec(
      "CREATE TRIGGER fail_outbox BEFORE INSERT ON outbox BEGIN SELECT RAISE(ABORT, 'disk full'); END",
    )
    expect(() => {
      store.getState().applyDelta({ phraseId: before.phrases[0]!.id, reps: 1 })
    }).toThrow('disk full')
    expect(store.getState()).toBe(before)
    expect(persistence.phrases.byId(before.phrases[0]!.id)?.reps).toBe(0)
    expect(persistence.outbox.size()).toBe(pending)
  })
  it('restores a deleted phrase deliberately and persists local erasure', () => {
    const { store, make, persistence } = fixture()
    seed(store)
    const phrase = store.getState().phrases[0]!
    store.getState().removePhrase(phrase.id)
    expect(persistence.phrases.byId(phrase.id)).toBeNull()
    store.getState().toast?.undo?.()
    expect(make().getState().phrases[0]?.id).toBe(phrase.id)
    store.getState().reset()
    expect(persistence.phrases.count()).toBe(0)
    expect(make().getState().onboarded).toBe(false)
  })
  it('rejects an old session tagged with a new practice day before recording an attempt', () => {
    const { store, persistence } = fixture()
    seed(store)
    const phrase = store.getState().phrases[0]!
    const session = {
      sessionId: 'yesterday',
      cursor: 0,
      plan: { engineId: 'refrain' as const, closed: true, estimatedMs: 0, items: [] },
    }
    store.setState({
      refrainResume: { session, cursor: 0, lastLatency: null, history: [], done: false },
    })
    const before = store.getState()
    const pending = persistence.outbox.size()
    expect(() => {
      store.getState().applyDelta(
        { phraseId: phrase.id, reps: 1, repsToday: 6 },
        {
          attemptId: 'wrong-day',
          targetLocale: 'es-ES',
          localDay: '2026-09-08',
          streakDay: '2026-09-07',
          sessionId: session.sessionId,
          expectedCursor: 0,
        },
      )
    }).toThrow('Stale practice checkpoint')
    expect(store.getState()).toBe(before)
    expect(persistence.phrases.byId(phrase.id)?.reps).toBe(0)
    expect(persistence.attempts.has('es-ES', 'wrong-day')).toBe(false)
    expect(persistence.outbox.size()).toBe(pending)
  })
  it('commits a late result to its original course once with its checkpoint', () => {
    const { store, make, persistence } = fixture()
    seed(store)
    const phrase = store.getState().phrases[0]!
    const session = {
      sessionId: 'session-1',
      cursor: 0,
      plan: {
        engineId: 'refrain' as const,
        closed: true,
        estimatedMs: 0,
        items: [
          {
            itemId: 'item-1',
            phraseId: phrase.id,
            mode: 'echo',
            prompt: { show: 'full' as const },
            gate: { kind: 'tap' as const },
            audio: null,
            meta: {},
          },
        ],
      },
    }
    store.setState({
      refrainResume: { session, cursor: 0, lastLatency: null, history: [], done: false },
    })
    store.getState().setLanguages('en', 'bg-BG')
    seed(store)
    const context = {
      expectedPhrase: Object.fromEntries(Object.entries(phrase).reverse()) as typeof phrase,
      attemptId: 'attempt-1',
      targetLocale: 'es-ES' as const,
      localDay: clock.localDay(),
      streakDay: clock.streakDay(),
      sessionId: 'session-1',
      expectedCursor: 0,
      checkpoint: { session, cursor: 1, lastLatency: null, history: [null], done: true },
    }
    store.getState().applyDelta({ phraseId: phrase.id, reps: 1 }, context)
    store.getState().applyDelta({ phraseId: phrase.id, reps: 1 }, context)
    expect(store.getState().targetLocale).toBe('bg-BG')
    expect(persistence.phrases.byId(phrase.id)?.reps).toBe(1)
    const resumed = make()
    resumed.getState().setLanguages('en', 'es-ES')
    expect(resumed.getState().refrainResume).toMatchObject({
      cursor: 1,
      history: [null],
      lastLatency: null,
      done: true,
    })
    expect(() => {
      resumed
        .getState()
        .applyDelta(
          { phraseId: phrase.id, reps: 1 },
          { ...context, attemptId: 'attempt-2', expectedPhrase: resumed.getState().phrases[0]! },
        )
    }).toThrow('cursor')
  })
  it('rejects a result recorded before a phrase edit even when the session cursor is unchanged', () => {
    const { store, persistence } = fixture()
    seed(store)
    const expectedPhrase = store.getState().phrases[0]!
    store.getState().setDifficulty(expectedPhrase.id, 'hard')
    const pending = persistence.outbox.size()
    expect(() => {
      store.getState().applyDelta(
        { phraseId: expectedPhrase.id, reps: 1 },
        {
          attemptId: 'stale-phrase',
          targetLocale: 'es-ES',
          localDay: clock.localDay(),
          streakDay: clock.streakDay(),
          expectedCursor: 0,
          expectedPhrase,
        },
      )
    }).toThrow('phrase has changed')
    expect(persistence.phrases.byId(expectedPhrase.id)).toMatchObject({
      difficulty: 'hard',
      reps: 0,
    })
    expect(persistence.attempts.has('es-ES', 'stale-phrase')).toBe(false)
    expect(persistence.outbox.size()).toBe(pending)
  })
  it('keeps transient error toasts available while every storage transaction fails', () => {
    const { store, persistence } = fixture()
    seed(store)
    const transaction = vi.spyOn(persistence, 'transaction').mockImplementation(() => {
      throw new Error('disk full')
    })
    expect(() => {
      store.getState().setNote(store.getState().phrases[0]!.id, 'draft')
    }).toThrow('disk full')
    transaction.mockClear()
    store.getState().showToast('Could not save')
    expect(store.getState().toast?.message).toBe('Could not save')
    store.getState().clearToast()
    store.getState().ensureRefrainSet()
    expect(store.getState().toast).toBeNull()
    expect(transaction).not.toHaveBeenCalled()
  })
  it('seeds around existing personal rows and respects pre-onboarding catalog tombstones', () => {
    const { store, make, persistence } = fixture()
    const ids = loadLearningCatalog('es-ES', 'en').packs.find((p) => p.id === 'cafe')!.phrases
    store.getState().addPhrase(ids[0]!)
    const existing = store.getState().phrases[0]!
    store.getState().setNote(existing.id, 'my memory hook')
    const personal = store
      .getState()
      .addOwnPhrase({ targetText: 'Mi frase', translation: 'My phrase' })
    store.getState().addPhrase(ids[1]!)
    const removed = store.getState().phrases.find((p) => p.phraseId === ids[1])!
    store.getState().removePhrase(removed.id)
    seed(store)
    const restored = make().getState()
    expect(restored.phrases.find((p) => p.id === existing.id)?.note).toBe('my memory hook')
    expect(restored.phrases.some((p) => p.id === personal)).toBe(true)
    expect(restored.phrases.filter((p) => p.phraseId === ids[0])).toHaveLength(1)
    expect(restored.phrases.some((p) => p.phraseId === ids[1])).toBe(false)
    expect(persistence.phrases.hasCatalog(ids[1]!, 'es-ES')).toBe(true)
    expect(persistence.phrases.hasCatalog(ids[1]!, 'bg-BG')).toBe(false)
  })
})
