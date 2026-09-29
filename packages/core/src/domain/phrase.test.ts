import { describe, expect, it } from 'vitest'
import { BROWSABLE_THEMES, repsToday, REPEAT_TARGET, LadderRung } from './phrase.js'
import { makePhrase } from './phrase.fixture.js'

describe('repsToday', () => {
  it('returns the count when the day matches', () => {
    const p = makePhrase('a', { repsToday: 4, repsTodayDay: '2026-07-28' })
    expect(repsToday(p, '2026-07-28')).toBe(4)
  })

  it('returns 0 on a stale counter rather than inflating automaticity', () => {
    // The bug this guards: reading repsToday without checking the day would let
    // yesterday's reps count toward today's lock-in.
    const p = makePhrase('a', { repsToday: 6, repsTodayDay: '2026-07-27' })
    expect(repsToday(p, '2026-07-28')).toBe(0)
  })

  it('returns 0 when the counter has never been set', () => {
    expect(repsToday(makePhrase('a'), '2026-07-28')).toBe(0)
  })
})

describe('contracts carried over from the blueprint', () => {
  it('keeps the stream repeat counts', () => {
    expect(REPEAT_TARGET).toEqual({ hard: 4, med: 3, easy: 2 })
  })

  it('orders the ladder as a competence hierarchy', () => {
    expect(LadderRung.Accumulated).toBeLessThan(LadderRung.Bent)
    expect(LadderRung.Bent).toBeLessThan(LadderRung.Transferred)
    expect(LadderRung.Transferred).toBeLessThan(LadderRung.PressureTested)
    expect(LadderRung.PressureTested).toBeLessThan(LadderRung.Deployed)
  })

  it('keeps synthetic learner themes out of Browse', () => {
    expect(BROWSABLE_THEMES).toEqual([
      'Café',
      'Dining',
      'Travel',
      'Directions',
      'Shopping',
      'Small talk',
      'Survival',
      'Hotel',
    ])
  })
})
