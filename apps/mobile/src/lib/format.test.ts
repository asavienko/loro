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
  it('formats a measured value', () => {
    expect(formatLatency(1240)).toBe('1.2s')
  })

  it('returns null when onset was never detected, so the UI can hide the read-out', () => {
    // Rule 4: never substitute a plausible estimate.
    expect(formatLatency(null)).toBeNull()
  })

  it('clamps only for display', () => {
    expect(formatLatency(50)).toBe('0.3s')
    expect(formatLatency(99_000)).toBe('5.0s')
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
