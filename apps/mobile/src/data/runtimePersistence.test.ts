import { loadLearningCatalog } from '@loro/content'
import { describe, expect, it } from 'vitest'
import { PushOpSchema } from '@loro/core/api/target'
import { catalogPhraseId, migrate, openSqlPersistence, type Clock } from '@loro/core'
import { makePhrase } from '@loro/core/testing'
import { INITIAL_STATE } from '../store/state'
import { openNodeSqlite } from './driver.node'
import { createRuntimePersistence } from './runtimePersistence'

const clock: Clock = {
  now: () => 1000,
  localDay: () => '2026-09-07',
  streakDay: () => '2026-09-07',
}
function setup() {
  const driver = openNodeSqlite()
  migrate(driver, 1000)
  let n = 0
  const persistence = openSqlPersistence(
    driver,
    () => `1000:${String(n++).padStart(4, '0')}:test`,
    1000,
  )
  const runtime = createRuntimePersistence(persistence, { clock })
  return { driver, persistence, runtime }
}
describe('runtime table projection', () => {
  it('hydrates ordered phrases, course settings, and global practice history from SQLite', () => {
    const { driver, persistence, runtime } = setup()
    try {
      const phrases = [makePhrase('second'), makePhrase('first')]
      const state = {
        ...INITIAL_STATE,
        onboarded: true,
        languageChosen: true,
        phrases,
        practiceDays: ['2026-09-07'],
        streamCursor: 1,
      }
      runtime.commit(INITIAL_STATE, state)
      const reopened = createRuntimePersistence(persistence, { clock }).load()!
      expect(reopened.phrases.map((p) => p.id)).toEqual(['second', 'first'])
      expect(reopened.streamCursor).toBe(1)
      expect(reopened.practiceDays).toEqual(['2026-09-07'])
      expect(reopened.languageChosen).toBe(true)
      const count = persistence.outbox.size()
      runtime.commit(reopened, reopened)
      expect(persistence.outbox.size()).toBe(count)
    } finally {
      driver.close()
    }
  })
  it('deletes then explicitly restores a phrase and clears every table on reset', () => {
    const { driver, persistence, runtime } = setup()
    try {
      const state = runtime.commit(INITIAL_STATE, {
        ...INITIAL_STATE,
        phrases: [makePhrase('one')],
      })
      const removed = runtime.commit(state, { ...state, phrases: [] })
      expect(persistence.phrases.count()).toBe(0)
      runtime.commit(removed, state)
      expect(persistence.phrases.count()).toBe(1)
      runtime.reset()
      expect(runtime.load()).toBeNull()
      expect(persistence.outbox.size()).toBe(0)
    } finally {
      driver.close()
    }
  })
  it('rolls back phrase edits, checkpoint, and outbox together when a queued write fails', () => {
    const { driver, persistence, runtime } = setup()
    try {
      const state = runtime.commit(INITIAL_STATE, {
        ...INITIAL_STATE,
        phrases: [makePhrase('one')],
      })
      const count = persistence.outbox.size()
      const failing = createRuntimePersistence(
        {
          ...persistence,
          outbox: {
            ...persistence.outbox,
            append: () => {
              throw new Error('disk full')
            },
          },
        },
        { clock },
      )
      expect(() =>
        failing.commit(state, {
          ...state,
          phrases: [{ ...state.phrases[0]!, reps: 1 }],
          streamCursor: 1,
        }),
      ).toThrow('disk full')
      expect(runtime.load()?.phrases[0]?.reps).toBe(0)
      expect(runtime.load()?.streamCursor).toBe(0)
      expect(persistence.outbox.size()).toBe(count)
    } finally {
      driver.close()
    }
  })
  it('records each practice attempt once even after recreating the adapter', () => {
    const { driver, persistence, runtime } = setup()
    try {
      const state = runtime.commit(INITIAL_STATE, {
        ...INITIAL_STATE,
        phrases: [makePhrase('one')],
      })
      const context = {
        attemptId: 'attempt-1',
        targetLocale: 'es-ES' as const,
        localDay: '2026-09-07',
        streakDay: '2026-09-07',
      }
      const next = { ...state, phrases: [{ ...state.phrases[0]!, reps: 1 }] }
      runtime.commit(state, next, context)
      const count = persistence.outbox.size()
      const reopened = createRuntimePersistence(persistence, { clock })
      expect(reopened.commit(state, next, context).phrases[0]?.reps).toBe(1)
      expect(persistence.outbox.size()).toBe(count)
    } finally {
      driver.close()
    }
  })
  it('drops deleted checkpoint references on reopen without removing surviving progress', () => {
    const { driver, persistence, runtime } = setup()
    try {
      const phrase = {
        ...makePhrase('one'),
        phraseId: null,
        ownEs: 'hola',
        ownEn: 'hello',
        ownTheme: 'Mine' as const,
        ownEmoji: '👋',
      }
      const state = runtime.commit(INITIAL_STATE, {
        ...INITIAL_STATE,
        phrases: [phrase, makePhrase('survivor', { reps: 3 })],
        selectedId: phrase.id,
        refrainDay: clock.localDay(),
        refrainSet: [phrase.id],
        refrainSubstituted: [phrase.id],
        refrainResume: {
          session: {
            sessionId: 's1',
            cursor: 0,
            plan: {
              engineId: 'refrain',
              closed: true,
              estimatedMs: 0,
              items: [
                {
                  itemId: 'i1',
                  phraseId: phrase.id,
                  mode: 'echo',
                  prompt: { show: 'full' },
                  gate: { kind: 'tap' },
                  audio: null,
                  meta: {},
                },
              ],
            },
          },
          cursor: 0,
          lastLatency: null,
          history: [],
          done: false,
        },
      })
      expect(state.refrainResume.session?.sessionId).toBe('s1')
      // Same row identity, edited displayed text: resume metadata must be discarded.
      const savedCheckpoint = persistence.checkpoints.load('es-ES')!
      persistence.phrases.upsert({ ...phrase, ownEs: 'buenos días' })
      expect(runtime.load()?.refrainResume.session).toBeNull()
      expect(runtime.load()?.refrainSet).toEqual([phrase.id])
      expect(runtime.load()?.phrases.find((p) => p.id === 'survivor')?.reps).toBe(3)
      persistence.phrases.upsert(phrase)
      const legacyCheckpoint = { ...savedCheckpoint }
      delete legacyCheckpoint.contentSignature
      persistence.checkpoints.save(legacyCheckpoint)
      expect(runtime.load()?.refrainResume.session).toBeNull()
      persistence.checkpoints.save(savedCheckpoint)
      expect(runtime.load()?.refrainResume.session?.sessionId).toBe('s1')

      persistence.phrases.upsert({
        ...phrase,
        phraseId: makePhrase('unavailable-catalog-id').phraseId,
      })
      expect(runtime.load()?.refrainResume.session).toBeNull()
      expect(runtime.load()?.phrases).toHaveLength(2)
      persistence.phrases.upsert(phrase)
      persistence.phrases.softDelete(phrase.id, clock.now())
      const reopened = createRuntimePersistence(persistence, { clock }).load()!
      expect(reopened.refrainResume.session).toBeNull()
      expect(reopened.selectedId).toBeNull()
      expect(reopened.refrainSet).toEqual([])
      expect(reopened.refrainSubstituted).toEqual([])
      expect(reopened.phrases[0]?.reps).toBe(3)
    } finally {
      driver.close()
    }
  })
  it('commits scheduler history and its outbox record exactly once with progress', () => {
    const { driver, persistence, runtime } = setup()
    try {
      const before = runtime.commit(INITIAL_STATE, {
        ...INITIAL_STATE,
        phrases: [makePhrase('one')],
      })
      const phrase = {
        ...before.phrases[0]!,
        reps: 1,
        srs: {
          stability: 2,
          difficulty: 5,
          due: 2000,
          lastReview: 1000,
          lapses: 0,
          state: 'review' as const,
          algorithm: 'fsrs-6',
        },
      }
      const context = {
        attemptId: 'review-1',
        targetLocale: 'es-ES' as const,
        localDay: clock.localDay(),
        streakDay: clock.streakDay(),
        phraseId: phrase.id,
        review: { grade: 3 as const, at: 1000, algorithm: 'fsrs-6' },
      }
      runtime.commit(before, { ...before, phrases: [phrase] }, context)
      runtime.commit(before, { ...before, phrases: [phrase] }, context)
      expect(persistence.reviews.all('es-ES')).toHaveLength(1)
      expect(persistence.reviews.all('es-ES')[0]?.state.stability).toBe(2)
      expect(
        persistence.outbox.pending(100).filter((op) => op.entity === 'review_log'),
      ).toHaveLength(1)
      const op = persistence.outbox
        .pending(100)
        .filter((op) => op.entity === 'user_phrase')
        .at(-1)!
      expect(op.fields.srsLapses?.v).toBe(0)
      expect(op.fields.srsLastReview?.v).toBe(1000)
    } finally {
      driver.close()
    }
  })
  it('queues structured values accepted by the declared sync wire schemas', () => {
    const { driver, persistence, runtime } = setup()
    try {
      const phrase = {
        ...makePhrase('00000000-0000-7000-8000-000000000001'),
        phraseId: catalogPhraseId('cafe1'),
      }
      const before = runtime.commit(INITIAL_STATE, {
        ...INITIAL_STATE,
        phrases: [phrase],
        refrainDay: '2026-09-07',
        refrainSet: [phrase.id],
      })
      const srs = {
        stability: 2,
        difficulty: 4,
        due: 2000,
        lastReview: 1000,
        lapses: 0,
        state: 'review' as const,
        algorithm: 'fsrs-5',
      }
      runtime.commit(
        before,
        {
          ...before,
          phrases: [{ ...phrase, tags: ['useful'], repsToday: 1, repsTodayDay: '2026-09-07', srs }],
        },
        {
          attemptId: 'review-1',
          phraseId: phrase.id,
          targetLocale: 'es-ES',
          localDay: '2026-09-07',
          streakDay: '2026-09-07',
          review: { grade: 3, at: 1000, algorithm: 'fsrs-5' },
        },
      )
      for (const op of persistence.outbox.pending(100)) {
        const wire =
          op.op === 'delete'
            ? {
                seq: op.seq,
                entity: op.entity,
                entity_id: op.entityId,
                op: op.op,
                deleted_at: op.fields.deletedAt?.v,
              }
            : {
                seq: op.seq,
                entity: op.entity,
                entity_id: op.entityId,
                op: op.op,
                fields: op.fields,
              }
        expect(PushOpSchema.safeParse(wire), JSON.stringify(wire)).toMatchObject({ success: true })
      }
    } finally {
      driver.close()
    }
  })
  it('recovers corrupt ordering metadata without dropping phrase rows', () => {
    const { driver, persistence, runtime } = setup()
    try {
      runtime.commit(INITIAL_STATE, { ...INITIAL_STATE, phrases: [makePhrase('one')] })
      persistence.metadata.set('phrase-order:es-ES', '{broken')
      expect(runtime.load()?.phrases.map((p) => p.id)).toEqual(['one'])
      persistence.metadata.set('phrase-order:es-ES', '42')
      expect(runtime.load()?.phrases.map((p) => p.id)).toEqual(['one'])
    } finally {
      driver.close()
    }
  })
})

it('discards resume when bundled text changes under the same catalog id', () => {
  const { driver, persistence, runtime } = setup()
  const content = loadLearningCatalog('es-ES', 'en').phrases[0]!
  const originalText = content.targetText
  try {
    const phrase = {
      ...makePhrase('stable-row', { reps: 3 }),
      phraseId: catalogPhraseId(content.id),
    }
    runtime.commit(INITIAL_STATE, {
      ...INITIAL_STATE,
      phrases: [phrase],
      refrainDay: clock.localDay(),
      refrainSet: [phrase.id],
      refrainResume: {
        session: {
          sessionId: 'content-session',
          cursor: 0,
          plan: {
            engineId: 'refrain',
            closed: true,
            estimatedMs: 0,
            items: [
              {
                itemId: 'item',
                phraseId: phrase.id,
                mode: 'echo',
                prompt: { show: 'full' },
                gate: { kind: 'tap' },
                audio: null,
                meta: {},
              },
            ],
          },
        },
        cursor: 0,
        lastLatency: null,
        history: [],
        done: false,
      },
    })
    expect(runtime.load()?.refrainResume.session?.sessionId).toBe('content-session')
    Object.assign(content, { targetText: 'Texto corregido' })
    expect(runtime.load()?.refrainResume.session).toBeNull()
    expect(runtime.load()?.refrainSet).toEqual([phrase.id])
    expect(persistence.phrases.byId(phrase.id)?.reps).toBe(3)
  } finally {
    Object.assign(content, { targetText: originalText })
    driver.close()
  }
})
