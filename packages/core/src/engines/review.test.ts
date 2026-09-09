import { describe, expect, it } from 'vitest'
import { makePhrase, T0 } from '../testing/index.js'
import type { FsrsState, PhraseState } from '../domain/phrase.js'
import { ReviewEngine, reviewCandidates, reviewFocus, reviewLimit } from './review.js'
import { makeContext } from '../testing/index.js'
import type { Attempt } from './types.js'

function phrase(id: string, overrides: Partial<PhraseState> = {}): PhraseState {
  return { ...makePhrase(id), ...overrides }
}

const schedule: FsrsState = {
  stability: 4,
  difficulty: 5,
  due: T0,
  lastReview: T0 - 86_400_000,
  lapses: 0,
  state: 'review',
  algorithm: 'fixture-only',
}

describe('Review candidate boundary (P3-30)', () => {
  it('isolates target courses and includes legacy Spanish and learner-authored phrases', () => {
    const legacy = phrase('legacy', { srs: schedule })
    const custom = phrase('custom', { phraseId: null, targetLocale: 'bg-BG', srs: schedule })
    const spanish = phrase('spanish', { targetLocale: 'es-ES', srs: schedule })
    const rows = [legacy, custom, spanish]
    expect(reviewCandidates(rows, 'bg-BG', T0).due).toEqual([custom])
    expect(reviewCandidates(rows, 'es-ES', T0).due).toEqual([legacy, spanish])
  })

  it('uses due eligibility including graduation, excludes learned, and preserves repository order', () => {
    const graduated = phrase('graduated', { srs: schedule, graduatedAt: T0 - 1 })
    const overdue = phrase('overdue', { srs: { ...schedule, due: T0 - 1000 } })
    const learned = phrase('learned', { srs: schedule, learned: true })
    const future = phrase('future', { srs: { ...schedule, due: T0 + 1 } })
    expect(reviewCandidates([graduated, learned, overdue, future], 'es-ES', T0).due).toEqual([
      graduated,
      overdue,
    ])
    expect(reviewCandidates([future], 'es-ES', T0 + 1).due).toEqual([future])
  })

  it('distinguishes absent schedules from empty courses and nothing due without inventing evidence', () => {
    const fresh = phrase('fresh', { srs: null })
    const future = phrase('future', { srs: { ...schedule, due: T0 + 1 } })
    expect(reviewCandidates([], 'es-ES', T0).state).toBe('empty-course')
    expect(reviewCandidates([fresh], 'es-ES', T0)).toMatchObject({
      state: 'no-schedule',
      due: [],
      unscheduled: [fresh],
    })
    expect(reviewCandidates([future, fresh], 'es-ES', T0)).toMatchObject({
      state: 'nothing-due',
      unscheduled: [fresh],
    })
    expect(reviewCandidates([phrase('learned', { learned: true })], 'es-ES', T0).state).toBe(
      'nothing-due',
    )
    expect(fresh.srs).toBeNull()
  })

  it('retains missing algorithm provenance and lapses without synthesizing history', () => {
    const legacy = phrase('legacy', {
      srs: { stability: 4, difficulty: 5, due: T0, lastReview: null, lapses: 8, state: 'review' },
    })
    expect(reviewCandidates([legacy], 'es-ES', T0).due[0]).toBe(legacy)
  })

  it('rejects an invalid clock instead of presenting nothing due', () => {
    for (const at of [NaN, Infinity, -Infinity]) {
      expect(() => reviewCandidates([], 'es-ES', at)).toThrow('finite clock instant')
    }
  })

  it('uses authored tag priority for mixed tags and never assumes a missing custom memory hook', () => {
    expect(reviewFocus(['useful', 'remember', 'pron'])).toBe('pronunciation')
    expect(reviewFocus(['useful', 'remember'])).toBe('memory-hook')
    expect(reviewFocus(['words', 'useful'])).toBe('high-use')
    expect(reviewFocus(['words'])).toBe('recall')
    expect(reviewFocus([])).toBe('recall')
  })
})

describe('ReviewEngine (P3-30)', () => {
  const reviewed = phrase('due', { srs: schedule })
  const attempt = (itemId: string, selfGrade: Attempt['selfGrade'] = 'good'): Attempt => ({
    itemId,
    outcome: 'success',
    latencyMs: null,
    hintsUsed: 0,
    selfGrade,
    at: T0,
  })

  it('plans a finite, course-scoped due queue with no invented first review', async () => {
    const fresh = phrase('fresh', { srs: null })
    const otherCourse = phrase('other', { targetLocale: 'bg-BG', srs: schedule })
    const engine = new ReviewEngine('es-ES')
    const plan = await engine.plan(makeContext([fresh, reviewed, otherCourse]))
    expect(plan).toMatchObject({ engineId: 'srs', closed: true })
    expect(plan.items).toMatchObject([
      { itemId: 'due#review', phraseId: 'due', mode: 'review', gate: { kind: 'self-report' } },
    ])
    expect(plan.items[0]?.meta).toEqual({ focus: 'recall', due: T0 })
  })

  it('caps the queue from the documented daily-load policy without reranking it', async () => {
    const rows = Array.from({ length: 25 }, (_, index) =>
      phrase(`due-${index}`, { srs: { ...schedule, due: T0 - index } }),
    )
    const ctx = makeContext(rows, { settings: { dailyMinutes: 5, waveTimes: [], repTarget: 6 } })
    const plan = await new ReviewEngine('es-ES').plan(ctx)
    expect(reviewLimit(5)).toBe(20)
    expect(plan.items).toHaveLength(20)
    expect(plan.items.map((item) => item.phraseId)).toEqual(rows.slice(0, 20).map((row) => row.id))
  })

  it('requires a self-declared grade and delegates the actual schedule to canonical core', async () => {
    const ctx = makeContext([reviewed])
    const engine = new ReviewEngine('es-ES')
    const plan = await engine.plan(ctx)
    const session = { sessionId: 'review-session', plan, cursor: 0 }
    const { selfGrade: _grade, ...ungraded } = attempt('due#review')
    await expect(engine.record(session, ungraded, ctx)).rejects.toThrow('explicit learner grade')
    const delta = await engine.record(session, attempt('due#review', 'easy'), ctx)
    expect(delta).toMatchObject({
      phraseId: 'due',
      reps: 1,
      latencySampleMs: null,
      review: { grade: 4, at: T0, algorithm: 'test-fsrs' },
    })
    expect(delta.srs?.due).toBe(T0 + 5 * 86_400_000)
  })

  it('rejects a stale grade instead of scheduling a phrase that is no longer due', async () => {
    const ctx = makeContext([phrase('future', { srs: { ...schedule, due: T0 + 1 } })])
    const engine = new ReviewEngine('es-ES')
    const session = {
      sessionId: 'review-session',
      cursor: 0,
      plan: {
        engineId: 'srs' as const,
        closed: true,
        estimatedMs: 0,
        items: [
          {
            itemId: 'future#review',
            phraseId: 'future' as never,
            mode: 'review',
            prompt: { show: 'meaning' as const },
            gate: { kind: 'self-report' as const },
            audio: null,
            meta: {},
          },
        ],
      },
    }
    await expect(engine.record(session, attempt('future#review'), ctx)).rejects.toThrow(
      'no longer due',
    )
  })
})
