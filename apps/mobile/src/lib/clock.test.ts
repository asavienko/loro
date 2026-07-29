/**
 * The clock, swept across timezones.
 *
 * The bug this guards was invisible in UTC — which is where CI runs, and why 249 tests
 * passed over it. So every case here states its zone, and the UTC case is the one that
 * proves least.
 *
 * `process.env.TZ` is honoured by Node at each `Date` construction (verified: hours
 * differ per zone for the same epoch ms), so the sweep works in one process. It is set
 * and restored per case rather than per file, so a failure cannot leak a zone into the
 * next test.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { localDayOf, localMidnightWallMsOf, localWallMsOf, streakDayOf } from './clock'

const ORIGINAL_TZ = process.env.TZ

afterEach(() => {
  if (ORIGINAL_TZ === undefined) delete process.env.TZ
  else process.env.TZ = ORIGINAL_TZ
})

/** Run `fn` with the process in `tz`. */
function inZone<T>(tz: string, fn: () => T): T {
  process.env.TZ = tz
  return fn()
}

/**
 * The zones that matter, and why each one is here:
 *   UTC              — the only zone where the old code was correct
 *   Europe/Madrid    — the app's target market, and UTC+2 in summer
 *   America/New_York — the mirror bug: UTC−4, so the UTC day rolls at 20:00 local
 *   Pacific/Kiritimati — UTC+14, the extreme east
 *   Pacific/Marquesas  — UTC−09:30, a half-hour offset
 *   Australia/Eucla    — UTC+08:45, a quarter-hour offset
 */
const ZONES = [
  'UTC',
  'Europe/Madrid',
  'America/New_York',
  'Pacific/Kiritimati',
  'Pacific/Marquesas',
  'Australia/Eucla',
]

describe('localDayOf', () => {
  it.each(ZONES)('is the local calendar date in %s', (tz) => {
    inZone(tz, () => {
      // 2026-07-28T23:30 local, built from local components in this very zone.
      const at = new Date(2026, 6, 28, 23, 30)
      expect(localDayOf(at)).toBe('2026-07-28')
      // And half an hour later it is tomorrow, everywhere.
      expect(localDayOf(new Date(at.getTime() + 31 * 60_000))).toBe('2026-07-29')
    })
  })

  it('disagrees with the UTC date exactly where the old code was wrong', () => {
    // 2026-07-29T00:30 in Madrid is 2026-07-28T22:30 UTC. The old
    // `toISOString().slice(0, 10)` returned the UTC date: yesterday.
    inZone('Europe/Madrid', () => {
      const at = new Date(2026, 6, 29, 0, 30)
      expect(at.toISOString().slice(0, 10)).toBe('2026-07-28') // the bug
      expect(localDayOf(at)).toBe('2026-07-29') // the contract
    })
  })

  it('pads single-digit months and days to a sortable key', () => {
    inZone('Europe/Madrid', () => {
      expect(localDayOf(new Date(2026, 0, 5, 12, 0))).toBe('2026-01-05')
    })
  })
})

describe('localWallMsOf and localMidnightWallMsOf', () => {
  it.each(ZONES)('puts midnight exactly one day-boundary apart in %s', (tz) => {
    inZone(tz, () => {
      const day = new Date(2026, 6, 28, 13, 14, 15, 678)
      const midnight = localMidnightWallMsOf(day)
      // Midnight in wall-ms is always an exact multiple of a day: that is what makes
      // the Rust's `wall_ms / 86_400_000` land on the learner's date.
      expect(midnight % 86_400_000).toBe(0)
      // And the instant sits at its wall-clock time-of-day past that midnight.
      const intoDay = localWallMsOf(day) - midnight
      expect(intoDay).toBe(((13 * 60 + 14) * 60 + 15) * 1000 + 678)
    })
  })

  it('reads the offset from midnight, not from the instant, across a DST spring-forward', () => {
    // Madrid springs forward at 02:00 on 2026-03-29: the day is 23 real hours long and
    // starts in CET (+1) while its afternoon is in CEST (+2). Taking the afternoon's
    // offset would place "midnight" an hour before the day actually started.
    inZone('Europe/Madrid', () => {
      const afternoon = new Date(2026, 2, 29, 15, 0)
      const midnight = localMidnightWallMsOf(afternoon)

      // Every instant in the local day agrees on where the day began...
      for (let hour = 0; hour < 24; hour++) {
        const at = new Date(2026, 2, 29, hour, 30)
        expect(localDayOf(at)).toBe('2026-03-29')
        expect(localMidnightWallMsOf(at)).toBe(midnight)
      }

      // ...and the wall-clock time-of-day survives the lost hour, which is the point:
      // 15:00 is 15 hours into the day even though only 14 have elapsed.
      expect(localWallMsOf(afternoon) - midnight).toBe(15 * 3_600_000)

      // Consecutive local days stay exactly one day apart in the wall frame, so day
      // keys never skip or repeat around a transition.
      const nextMidnight = localMidnightWallMsOf(new Date(2026, 2, 30, 15, 0))
      expect(nextMidnight - midnight).toBe(86_400_000)
    })
  })
})

describe('streakDayOf', () => {
  it.each(ZONES)('counts a 01:30 session for yesterday in %s', (tz) => {
    inZone(tz, () => {
      const lateNight = new Date(2026, 6, 29, 1, 30)
      expect(localDayOf(lateNight)).toBe('2026-07-29')
      expect(streakDayOf(lateNight)).toBe('2026-07-28')
    })
  })

  it.each(ZONES)('counts an 06:00 session for today in %s', (tz) => {
    inZone(tz, () => {
      const morning = new Date(2026, 6, 29, 6, 0)
      expect(streakDayOf(morning)).toBe('2026-07-29')
    })
  })

  it('flips at exactly 04:00 local', () => {
    inZone('Europe/Madrid', () => {
      expect(streakDayOf(new Date(2026, 6, 29, 3, 59, 59, 999))).toBe('2026-07-28')
      expect(streakDayOf(new Date(2026, 6, 29, 4, 0, 0, 0))).toBe('2026-07-29')
    })
  })

  it('agrees with localDayOf for the rest of the day', () => {
    inZone('America/New_York', () => {
      for (let hour = 4; hour < 24; hour++) {
        const at = new Date(2026, 6, 29, hour, 0)
        expect(streakDayOf(at)).toBe(localDayOf(at))
      }
    })
  })
})
