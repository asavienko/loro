import { describe, expect, it } from 'vitest'
import { FSRS_ALGORITHM, LEGACY_PREVIEW_ALGORITHM, type FsrsState } from '@loro/core'
import { makePhrase } from '@loro/core/testing'
import { coreCall, nextHlc, receiveHlc, mergeRow, type CoreRow } from './core'
import { rustCoreFacade } from '../store/coreFacade'
import previewVectors from '../../../../packages/core-rs/tests/fixtures/fsrs_v6_3_2.json'
import reference from '../../../../packages/core-rs/tests/fixtures/fsrs-6-reference.json'

const gradeNumber = { again: 1, hard: 2, good: 3, easy: 4 } as const
interface WireState extends Omit<FsrsState, 'lastReview' | 'algorithm'> {
  readonly last_review: number | null
  readonly algorithm: string
}
const BASE = 1_700_000_000_000
const DAY_MS = 86_400_000

describe('the production Rust boundary', () => {
  it('matches the pinned official memory vectors through shipped WASM', () => {
    for (const vector of reference.vectors) {
      const state: WireState = {
        stability: vector.prior?.stability ?? 0,
        // Raw reference initialization is tested independently from Loro's declared prior.
        difficulty: vector.prior?.difficulty ?? vector.next.difficulty,
        due: BASE,
        last_review: vector.prior === null ? null : BASE,
        lapses: 0,
        state: vector.prior === null ? 'new' : 'review',
        algorithm: FSRS_ALGORITHM,
      }
      const at = BASE + vector.elapsed * DAY_MS
      const next = coreCall<WireState>('fsrs_review', { state, grade: vector.grade, at })
      expect(next.stability, vector.name).toBeCloseTo(vector.next.stability, 7)
      expect(next.difficulty, vector.name).toBeCloseTo(vector.next.difficulty, 7)
      expect(next.last_review).toBe(at)
      expect(next.algorithm).toBe(FSRS_ALGORITHM)
    }
  })

  it('preserves every known preview state instead of resetting learned evidence', () => {
    for (const vector of previewVectors.cases) {
      const implicit = coreCall<WireState>('fsrs_review', {
        state: vector.state,
        grade: gradeNumber[vector.grade as keyof typeof gradeNumber],
        at: vector.at_ms,
      })
      const explicit = coreCall<WireState>('fsrs_review', {
        state: {
          ...vector.state,
          state: vector.state.last_review === null ? 'new' : 'review',
          algorithm: LEGACY_PREVIEW_ALGORITHM,
        },
        grade: gradeNumber[vector.grade as keyof typeof gradeNumber],
        at: vector.at_ms,
      })
      expect(implicit, vector.name).toEqual(explicit)
      expect(implicit.algorithm).toBe(FSRS_ALGORITHM)
      expect(implicit.lapses).toBeGreaterThanOrEqual(vector.state.lapses)
    }
  })

  it('uses authored minute steps, complete lifecycle and a single lapse per failure cycle', () => {
    let state = coreCall<WireState>('fsrs_initialize', {
      declared: 'hard',
      tags: ['remember'],
      at: BASE,
    })
    expect(state.difficulty).toBe(8.3)
    expect(state.last_review).toBeNull()
    state = coreCall<WireState>('fsrs_review', { state, grade: 1, at: BASE })
    expect(state).toMatchObject({ due: BASE + 600_000, state: 'learning', lapses: 0 })
    state = coreCall<WireState>('fsrs_review', { state, grade: 2, at: state.due })
    expect(state).toMatchObject({ due: BASE + 1_500_000, state: 'learning', lapses: 0 })
    state = coreCall<WireState>('fsrs_review', { state, grade: 3, at: state.due })
    expect(state.state).toBe('review')
    // Authored 50% retention produces a longer interval than the 90%-stability duration.
    expect(state.due - (state.last_review ?? 0)).toBeGreaterThan(state.stability * DAY_MS)
    state = coreCall<WireState>('fsrs_review', { state, grade: 1, at: state.due })
    expect(state).toMatchObject({ state: 'relearning', lapses: 1 })
    state = coreCall<WireState>('fsrs_review', { state, grade: 1, at: state.due })
    expect(state.lapses).toBe(1)
  })

  it('keeps preview provenance and actual history when a declaration is rerated', () => {
    const state = {
      stability: 12.25,
      difficulty: 5,
      due: BASE + DAY_MS,
      last_review: BASE,
      lapses: 3,
      state: 'review',
      algorithm: LEGACY_PREVIEW_ALGORITHM,
    }
    const next = coreCall<WireState>('fsrs_rerate', { state, declared: 'hard', tags: [] })
    expect(next).toEqual({ ...state, difficulty: 6 })
    expect(() =>
      coreCall('fsrs_review', {
        state: { ...state, algorithm: 'unknown-policy' },
        grade: 3,
        at: state.due,
      }),
    ).toThrow()
  })

  it('applies the Strong bonus once and gives an explicit grade precedence', () => {
    const phrase = makePhrase('prior')
    const good = rustCoreFacade.fsrsReview(phrase, 3, BASE)
    const strong = rustCoreFacade.fsrsReview(phrase, 3, BASE, 'strong')
    expect(strong?.stability).toBeCloseTo((good?.stability ?? 0) * 1.1, 7)
    expect(
      rustCoreFacade.reviewGrade({
        itemId: 'p',
        outcome: 'failed',
        hintsUsed: 0,
        latencyMs: null,
        at: BASE,
        selfGrade: 'hard',
        confidence: 'instant',
      }),
    ).toBe(2)
    expect([0, 1, 2, 3, 4, 5].map((index) => rustCoreFacade.modeForRep(index))).toEqual([
      'echo',
      'chorus',
      'speed',
      'cloze',
      'call',
      'cold',
    ])
    expect(rustCoreFacade.automaticity(4, 6)).toBe(67)
    expect(rustCoreFacade.refrainSetSize(10)).toBe(5)
  })

  it('uses real phrase text and language for cloze and refuses empty production targets', () => {
    const phrase = {
      ...makePhrase('own'),
      phraseId: null,
      ownEs: '¿Dónde está el restaurante?',
      targetLocale: 'es-ES' as const,
    }
    expect(rustCoreFacade.clozeMask(phrase)).toEqual([3])
    expect(rustCoreFacade.matchTokens(['hola'], [], 0).complete).toBe(false)
    expect(
      rustCoreFacade.matchTokens(['Къде', 'е', 'банята'], ['Къде', 'е', 'банята?'], 0).complete,
    ).toBe(true)
    expect(rustCoreFacade.matchTokens(['Где', 'ванная'], ['Где', 'ванная?'], 0).complete).toBe(true)
  })

  it('uses canonical rank, active eligibility and deterministic unfinished/trip priorities', () => {
    const unfinished = makePhrase('unfinished', { lockInDays: 2 })
    const trip = makePhrase('trip')
    const graduated = makePhrase('graduated', { graduatedAt: 1 })
    expect(rustCoreFacade.orderStream([trip, graduated, unfinished], 0)).toEqual([
      trip.id,
      unfinished.id,
    ])
    expect(rustCoreFacade.selectRefrainSet([graduated, trip, unfinished], 3, [trip.id])).toEqual([
      unfinished.id,
      trip.id,
    ])
    expect(
      rustCoreFacade.streamRank(
        makePhrase('hard', { difficulty: 'hard', loved: true, plays: 2 }),
        0,
      ),
    ).toBe(-7)
  })

  it('carries HLC overflow, observes remote clocks, and merges edits without a JS algorithm', () => {
    expect(nextHlc(900, '1000:4294967295:device', 'device')).toBe('1001:0000:device')
    expect(receiveHlc(900, '1000:0002:a', '2000:0004:b', 'a')).toBe('2000:0005:a')
    const local: CoreRow = {
      entity: 'user_phrase',
      id: 'phrase',
      deleted_at: null,
      fields: {
        reps: { v: 8, hlc: { physical: 1000, logical: 0, node_id: 'a' } },
      },
    }
    const result = mergeRow(local, {
      ...local,
      fields: {
        reps: { v: 3, hlc: { physical: 2000, logical: 0, node_id: 'b' } },
      },
      classes: { reps: 'Max' },
    })
    expect(result.row.fields['reps']?.v).toBe(8)
  })
})
