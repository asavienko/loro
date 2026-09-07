import { beforeAll, describe, expect, it } from 'vitest'
import { makePhrase } from '@loro/core/testing'
import { loadCore } from '../core/loader'
import { canonicalCoreFacade as core } from './coreFacade'

const AT = 1_785_231_660_000

beforeAll(async () => {
  await loadCore()
})

describe('the compiled Rust facade', () => {
  it('preserves multilingual letters, display indices and strict production matching', () => {
    expect(core.matchTokens(['baño'], ['ban\u0303o'], 0).complete).toBe(true)
    expect(core.matchTokens(['bano'], ['baño'], 0).complete).toBe(false)
    expect(core.matchTokens(['й', 'ё'], ['и\u0306', 'е\u0308'], 0).complete).toBe(true)
    expect(core.matchTokens(['спасибо'], ['спаси́бо'], 0).complete).toBe(true)
    expect(core.matchTokens(['Здравей'], ['Здра́вей'], 0).complete).toBe(true)
    expect(core.matchTokens(['hola'], ['¿', 'hola', '!'], 0)).toEqual({
      revealed: 3,
      justIndex: 1,
      complete: true,
    })
    expect(core.matchTokens([], ['!'], 99)).toEqual({ revealed: 1, justIndex: -1, complete: false })
    expect(core.matchTokens(['cortando'], ['cortado'], 0).complete).toBe(false)
    expect(core.matchTokens(['да'], ['да', 'да'], 0).complete).toBe(false)
  })

  it('requires real cloze metadata and returns original display token positions', () => {
    expect(core.clozeMask(['el', 'baño'], 'es-ES', [1])).toEqual([1])
    expect(core.clozeMask(['el', 'baño'], 'es-ES', [])).toEqual([])
    expect(core.clozeMask(['Къде', 'е', 'кафето?'], 'bg-BG', [99, 2])).toEqual([2])
    expect(core.clozeMask(['!'], 'ru-RU', [0])).toEqual([])
  })

  it('preserves active eligibility and deterministic daily priorities', () => {
    const mid = makePhrase('mid', { lockInDays: 2 })
    const trip = makePhrase('trip')
    const weak = makePhrase('weak', { reps: 2, automaticity: 10 })
    const hard = makePhrase('hard', { reps: 2, automaticity: 10, difficulty: 'hard' })
    const excluded = makePhrase('excluded', { graduatedAt: AT, lockInDays: 3 })
    const phrases = [makePhrase('new'), weak, mid, excluded, hard, trip]
    expect(core.selectRefrainSet(phrases, 8, [trip.id])).toEqual([
      'mid',
      'trip',
      'hard',
      'weak',
      'new',
    ])
    expect(core.selectRefrainSet([...phrases].reverse(), 8, [trip.id])).toEqual(
      core.selectRefrainSet(phrases, 8, [trip.id]),
    )
    expect(core.selectRefrainSet(phrases, 0)).toEqual([])
  })

  it('executes canonical rank and mode helpers', () => {
    expect(
      core.streamRank(makePhrase('hard', { plays: 5, difficulty: 'hard', loved: true }), AT),
    ).toBe(-4)
    expect(
      core.orderStream(
        [makePhrase('б'), makePhrase('a'), makePhrase('graduated', { graduatedAt: AT })],
        AT,
      ),
    ).toEqual(['a', 'б'])
    expect(core.repeatTarget('hard')).toBe(4)
    expect(core.automaticity(9, 6)).toBe(100)
    expect(core.automaticity(9, 0)).toBe(0)
    expect(core.refrainSetSize(10)).toBe(5)
    expect(core.modeForRep(3)).toBe('cloze')
    expect(core.modelRateForMode('cold')).toBe(null)
    expect(core.modelRateForMode('echo')).toBeCloseTo(0.95, 6)
    expect(core.beatMsForMode('speed')).toBe(340)
  })

  it('maps explicit evidence through the canonical grade policy', () => {
    const attempt = {
      itemId: 'item',
      outcome: 'success' as const,
      latencyMs: null,
      hintsUsed: 0,
      at: AT,
    }
    expect(core.reviewGrade(attempt)).toBe(3)
    expect(core.reviewGrade({ ...attempt, hintsUsed: 1 })).toBe(2)
    expect(core.reviewGrade({ ...attempt, outcome: 'failed' })).toBe(1)
    expect(core.reviewGrade({ ...attempt, selfGrade: 'easy', confidence: 'forgot' })).toBe(4)
    expect(core.reviewGrade({ ...attempt, confidence: 'strong' })).toBe(3)
  })

  it('rejects numeric corruption before JSON converts it to null', () => {
    const phrase = makePhrase('corrupt')
    expect(() => core.streamRank({ ...phrase, lastPracticedAt: Number.NaN }, AT)).toThrow(
      'Unsafe canonical numeric input',
    )
    expect(() => core.matchTokens([], [], Number.POSITIVE_INFINITY)).toThrow(
      'Unsafe canonical numeric input',
    )
    expect(() => core.fsrsReview(phrase, 3, Number.MAX_SAFE_INTEGER + 1)).toThrow(
      'Unsafe canonical numeric input',
    )
  })

  it('rerates canonical memory without creating a review event', () => {
    const phrase = makePhrase('rerate')
    expect(core.rerate(phrase, 'hard')).toBeNull()
    const first = core.fsrsReview(phrase, 3, AT)
    const rerated = core.rerate({ ...phrase, srs: first }, 'hard')
    expect(rerated).toEqual({ ...first, difficulty: Math.min(10, first.difficulty + 1) })
    const legacy = { ...first }
    delete legacy.algorithm
    expect(core.rerate({ ...phrase, srs: legacy }, 'hard')).toEqual(legacy)
    expect(() =>
      core.rerate({ ...phrase, srs: { ...first, algorithm: 'future' } }, 'hard'),
    ).toThrow()
  })

  it('persists complete scheduler results and reinitializes only legacy schedules', () => {
    const phrase = makePhrase('review')
    const first = core.fsrsReview(phrase, 3, AT)
    expect(first.algorithm).toBe('fsrs-6-default-c8ca282-loro-v1')
    expect(first.lastReview).toBe(AT)
    expect(first.state).toBe('review')
    expect(first.lapses).toBe(0)
    expect(core.fsrsReview(phrase, 3, AT, 'strong').stability).toBeCloseTo(
      first.stability * 1.1,
      10,
    )
    expect(first.due).toBeGreaterThan(AT)
    const failed = core.fsrsReview({ ...phrase, srs: first }, 1, first.due)
    expect(failed.lapses).toBe(1)
    expect(failed.state).toBe('relearning')
    expect(failed.lastReview).toBe(first.due)
    const legacy = { ...first, stability: 999, lapses: 99 }
    delete legacy.algorithm
    expect(() =>
      core.fsrsReview({ ...phrase, srs: { ...first, algorithm: 'future-v2' } }, 3, AT),
    ).toThrow('Unsupported scheduler algorithm')
    expect(core.fsrsReview({ ...phrase, srs: legacy }, 3, AT)).toEqual(first)
    expect(() => core.fsrsReview({ ...phrase, srs: first }, 3, AT - 1)).toThrow()
  })
})
