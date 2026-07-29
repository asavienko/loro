/**
 * The TypeScript half of the calendar parity check.
 *
 * Every case comes from `calendar.fixtures.json`, which `core-rs/tests/parity.rs`
 * reads too. Cases belong in the fixture, not here — a case added only here proves
 * nothing about the Rust, and the Rust is what the widget will run.
 */

import { describe, expect, it } from 'vitest'
import {
  daysBetween,
  streak,
  streakDayFor,
  streakSurvives,
  STREAK_GRACE_HOURS,
} from './calendar.js'
import fixtures from './calendar.fixtures.json'

describe('calendar parity fixtures', () => {
  it('covers every function the fixture declares', () => {
    // Guards against a fixture key being renamed and quietly skipping a whole group.
    expect(fixtures.streakDayFor.length).toBeGreaterThan(0)
    expect(fixtures.daysBetween.length).toBeGreaterThan(0)
    expect(fixtures.streakSurvives.length).toBeGreaterThan(0)
    expect(fixtures.streak.length).toBeGreaterThan(0)
  })

  for (const c of fixtures.streakDayFor) {
    it(`streakDayFor: ${c.why}`, () => {
      expect(streakDayFor(c.atWallMs, c.localMidnightWallMs)).toBe(c.expect)
    })
  }

  for (const c of fixtures.daysBetween) {
    it(`daysBetween: ${c.a} → ${c.b}`, () => {
      expect(daysBetween(c.a, c.b)).toBe(c.expect)
    })
  }

  for (const c of fixtures.streakSurvives) {
    it(`streakSurvives: ${c.lastDay} → ${c.today}`, () => {
      expect(streakSurvives(c.lastDay, c.today)).toBe(c.expect)
    })
  }

  for (const c of fixtures.streak) {
    it(`streak: ${c.why}`, () => {
      expect(streak(c.days, c.today)).toBe(c.expect)
    })
  }
})

describe('the grace window', () => {
  it('is four hours, and the two day keys disagree for exactly that long', () => {
    expect(STREAK_GRACE_HOURS).toBe(4)

    const midnight = fixtures.localMidnightWallMs
    // Sample every 15 minutes through the day and count where the streak key lags.
    let lagging = 0
    for (let ms = midnight; ms < midnight + 86_400_000; ms += 900_000) {
      if (streakDayFor(ms, midnight) !== streakDayFor(midnight + 86_400_000 - 1, midnight)) {
        lagging++
      }
    }
    expect(lagging).toBe((STREAK_GRACE_HOURS * 3_600_000) / 900_000)
  })
})

describe('streak', () => {
  it('never returns a negative or fractional day count', () => {
    const pad = (n: number): string => String(n).padStart(2, '0')
    const days = Array.from({ length: 400 }, (_, i) => {
      const d = new Date(Date.UTC(2026, 0, 1 + i))
      return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
    })
    const n = streak(days, '2027-02-04')
    expect(Number.isInteger(n)).toBe(true)
    expect(n).toBe(400)
  })

  it('is unchanged by the order rows come back from storage', () => {
    const days = ['2026-07-26', '2026-07-27', '2026-07-28']
    expect(streak([...days].reverse(), '2026-07-28')).toBe(streak(days, '2026-07-28'))
  })
})
