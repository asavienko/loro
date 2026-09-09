import { describe, expect, it } from 'vitest'
import { makePhrase, T0 } from '../testing/index.js'
import type { FsrsState, PhraseState } from '../domain/phrase.js'
import { reviewCandidates, reviewFocus } from './review.js'

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
