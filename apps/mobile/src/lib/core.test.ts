import { describe, expect, it } from 'vitest'
import { makePhrase } from '@loro/core/testing'
import { coreCall, nextHlc, receiveHlc, mergeRow, type CoreRow } from './core'
import { rustCoreFacade } from '../store/coreFacade'
import vectors from '../../../../packages/core-rs/tests/fixtures/fsrs_v6_3_2.json'

const gradeNumber = { again: 1, hard: 2, good: 3, easy: 4 } as const

describe('the production Rust boundary', () => {
  it('matches every official FSRS reference vector through the shipped WASM bytes', () => {
    for (const vector of vectors.cases) {
      const actual = coreCall<typeof vector.expected>('fsrs_review', {
        state: vector.state,
        grade: gradeNumber[vector.grade as keyof typeof gradeNumber],
        at: vector.at_ms,
      })
      expect(actual.due, vector.name).toBe(vector.expected.due)
      expect(actual.last_review, vector.name).toBe(vector.expected.last_review)
      expect(actual.lapses, vector.name).toBe(vector.expected.lapses)
      expect(actual.stability, vector.name).toBeCloseTo(vector.expected.stability, 4)
      expect(actual.difficulty, vector.name).toBeCloseTo(vector.expected.difficulty, 5)
    }
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
