import { describe, expect, it } from 'vitest'
import { daysUntil, formatInterval, formatLatency, ownershipPct } from './format.js'

describe('interval formatting', () => {
  it('matches the blueprint formatter', () => {
    expect(formatInterval(0.2)).toBe('~10 min')
    expect(formatInterval(1.0)).toBe('tomorrow')
    expect(formatInterval(5)).toBe('5 days')
    expect(formatInterval(42)).toBe('6 wks')
  })

  it('crosses each boundary in the right direction', () => {
    expect(formatInterval(0.89)).toBe('~10 min')
    expect(formatInterval(0.9)).toBe('tomorrow')
    expect(formatInterval(1.59)).toBe('tomorrow')
    expect(formatInterval(1.6)).toBe('2 days')
    expect(formatInterval(29.9)).toBe('30 days')
    expect(formatInterval(30)).toBe('4 wks')
  })
})

describe('latency formatting', () => {
  it('formats a measured value at the blueprint’s precision', () => {
    expect(formatLatency(1240)).toBe('1.2s')
    expect(formatLatency(2000)).toBe('2.0s')
  })

  it('returns null when onset was never detected, so the UI can hide the read-out', () => {
    // Rule 4: never substitute a plausible estimate.
    expect(formatLatency(null)).toBeNull()
  })

  /**
   * The clamp this replaces read `Math.min(Math.max(ms, 300), 5000)`. Both ends lied about a
   * measurement that had already been taken, and "for display only" is no defence: the display
   * is the only place the learner meets the number.
   */
  it('never raises a fast sample, and never caps a slow one', () => {
    expect(formatLatency(50)).toBe('50 ms')
    expect(formatLatency(299)).toBe('299 ms')
    expect(formatLatency(12_400)).toBe('12.4s')
    expect(formatLatency(99_000)).toBe('99.0s')
  })

  it('switches unit at exactly one second, so no value has two renderings', () => {
    expect(formatLatency(999)).toBe('999 ms')
    expect(formatLatency(1000)).toBe('1.0s')
  })

  it('shows a sub-100ms sample rather than rounding it to zero', () => {
    // `.toFixed(1)` renders 45 ms as `0.0s`, and a measured value that prints as zero is as
    // untrue as an estimate.
    expect(formatLatency(45)).toBe('45 ms')
    expect(formatLatency(4)).toBe('4 ms')
    expect(formatLatency(0)).toBe('0 ms')
  })

  it('treats a negative sample as unmeasured, not as instant', () => {
    // Not a fast rep — a clock that went backwards.
    expect(formatLatency(-1)).toBeNull()
  })
})

describe('trip maths', () => {
  it('counts days across month and year boundaries', () => {
    expect(daysUntil('2026-06-18', '2026-06-30')).toBe(12)
    expect(daysUntil('2026-12-28', '2027-01-02')).toBe(5)
    expect(daysUntil('2028-02-27', '2028-03-01')).toBe(3) // leap year
  })

  it('goes negative once the date has passed', () => {
    expect(daysUntil('2026-07-01', '2026-06-30')).toBe(-1)
  })

  it('computes readiness as a percentage', () => {
    expect(ownershipPct(38, 100)).toBe(38)
    expect(ownershipPct(0, 100)).toBe(0)
    expect(ownershipPct(120, 100)).toBe(100)
    expect(ownershipPct(1, 0)).toBe(0)
  })
})
