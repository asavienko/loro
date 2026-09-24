import { describe, expect, it } from 'vitest'
import { makePhrase, T0 } from '../testing/index.js'
import type { FsrsState, PhraseState } from '../domain/phrase.js'
import type { SqlDriver, SqlRow, SqlValue } from './driver.js'
import {
  decodeReviewCheckpoint,
  encodeReviewCheckpoint,
  reviewCheckpointKey,
  reviewContentHash,
  validateReviewResume,
  buildReviewCheckpoint,
  type ReviewCheckpoint,
} from './reviewCheckpoint.js'
import {
  clearReviewCheckpoint,
  loadReviewCheckpoint,
  saveReviewCheckpoint,
} from './sqlite/reviewCheckpoint.js'

const schedule: FsrsState = {
  stability: 4,
  difficulty: 5,
  due: T0,
  lastReview: T0 - 86_400_000,
  lapses: 0,
  state: 'review',
  algorithm: 'fixture-only',
}

function duePhrase(id: string, overrides: Partial<PhraseState> = {}): PhraseState {
  return { ...makePhrase(id), srs: schedule, ...overrides }
}

function checkpoint(overrides: Partial<ReviewCheckpoint> = {}): ReviewCheckpoint {
  const phrase = duePhrase('due')
  const contentHash = reviewContentHash(phrase)
  return {
    version: 1,
    eventId: 'evt-1',
    targetLocale: 'es-ES',
    localDay: '2026-07-28',
    phraseId: phrase.id,
    contentHash,
    cursor: 0,
    queue: [{ phraseId: phrase.id, contentHash }],
    ...overrides,
  }
}

class MemoryMeta implements SqlDriver {
  private readonly rows = new Map<string, string>()
  exec(): void {}
  transaction<T>(fn: () => T): T {
    return fn()
  }
  run(sql: string, params: readonly SqlValue[] = []): void {
    if (sql.includes('DELETE')) {
      this.rows.delete(`${params[0]}:${params[1]}`)
      return
    }
    this.rows.set(`${params[0]}:${params[1]}`, String(params[2]))
  }
  all(sql: string, params: readonly SqlValue[] = []): SqlRow[] {
    const value = this.rows.get(`${params[0]}:${params[1]}`)
    return value === undefined ? [] : [{ value }]
  }
}

describe('review content hash', () => {
  it('changes when displayed text or authored text changes', () => {
    const phrase = duePhrase('due', { ownEs: 'Hola' })
    const base = reviewContentHash(phrase, { targetText: 'Hola', translation: 'Hi' })
    expect(reviewContentHash(phrase, { targetText: 'Hola', translation: 'Hello' })).not.toBe(base)
    expect(reviewContentHash({ ...phrase, ownEs: 'Buenos días' }, { targetText: 'Hola', translation: 'Hi' })).not.toBe(
      base,
    )
    expect(reviewContentHash(phrase, { targetText: 'Hola', translation: 'Hi' })).toBe(base)
  })
})

describe('buildReviewCheckpoint', () => {
  it('returns the cursor entry or null when the queue is drained', () => {
    const queue = checkpoint().queue
    expect(buildReviewCheckpoint({ ...checkpoint(), cursor: 0, queue })?.phraseId).toBe(
      checkpoint().phraseId,
    )
    expect(buildReviewCheckpoint({ ...checkpoint(), cursor: 1, queue })).toBeNull()
  })
})

describe('review checkpoint codec', () => {
  it('round-trips a valid payload', () => {
    const value = checkpoint()
    expect(decodeReviewCheckpoint(encodeReviewCheckpoint(value))).toEqual(value)
  })

  it('rejects malformed, empty-queue and mismatched cursor payloads', () => {
    expect(decodeReviewCheckpoint('{')).toBeNull()
    expect(decodeReviewCheckpoint(JSON.stringify({ ...checkpoint(), queue: [] }))).toBeNull()
    expect(decodeReviewCheckpoint(JSON.stringify({ ...checkpoint(), cursor: 1 }))).toBeNull()
    expect(decodeReviewCheckpoint(JSON.stringify({ ...checkpoint(), eventId: '' }))).toBeNull()
    expect(
      decodeReviewCheckpoint(JSON.stringify({ ...checkpoint(), targetLocale: 'xx-XX' })),
    ).toBeNull()
  })
})

describe('validateReviewResume', () => {
  const phrase = duePhrase('due')
  const ctx = {
    targetLocale: 'es-ES' as const,
    localDay: '2026-07-28',
    at: T0,
    phrases: [phrase],
  }

  it('resumes only when course, day, identity, content and due schedule match', () => {
    expect(validateReviewResume(checkpoint(), ctx)).toEqual({
      ok: true,
      checkpoint: checkpoint(),
    })
  })

  it('fails closed for each resume refusal', () => {
    expect(validateReviewResume(null, ctx).reason).toBe('absent')
    expect(validateReviewResume(checkpoint({ targetLocale: 'bg-BG' }), ctx).reason).toBe(
      'wrong-course',
    )
    expect(validateReviewResume(checkpoint({ localDay: '2026-07-29' }), ctx).reason).toBe(
      'wrong-day',
    )
    expect(validateReviewResume(checkpoint({ phraseId: 'missing' }), ctx).reason).toBe(
      'missing-phrase',
    )
    expect(
      validateReviewResume(checkpoint(), { ...ctx, phrases: [duePhrase('due', { srs: null })] })
        .reason,
    ).toBe('unscheduled')
    expect(
      validateReviewResume(checkpoint(), {
        ...ctx,
        phrases: [duePhrase('due', { srs: { ...schedule, due: T0 + 1 } })],
      }).reason,
    ).toBe('not-due')
    expect(validateReviewResume(checkpoint({ contentHash: 'deadbeef' }), ctx).reason).toBe(
      'content-changed',
    )
  })
})

describe('review checkpoint local_metadata writes', () => {
  it('upserts owned columns only and decodes fail-closed', () => {
    const driver = new MemoryMeta()
    expect(loadReviewCheckpoint(driver, 'local', 'es-ES')).toBeNull()
    saveReviewCheckpoint(driver, 'local', checkpoint())
    expect(loadReviewCheckpoint(driver, 'local', 'es-ES')).toEqual(checkpoint())
    saveReviewCheckpoint(driver, 'local', checkpoint({ eventId: 'evt-2' }))
    expect(loadReviewCheckpoint(driver, 'local', 'es-ES')?.eventId).toBe('evt-2')
    expect(reviewCheckpointKey('es-ES')).toBe('review_checkpoint:es-ES')
    clearReviewCheckpoint(driver, 'local', 'es-ES')
    expect(loadReviewCheckpoint(driver, 'local', 'es-ES')).toBeNull()
  })
})
