import { currentNativeLanguage } from './i18n'
/**
 * The device clock — the ONE place in the app that constructs a `Date`.
 *
 * It is one place on purpose, and ESLint enforces it (`new Date()` is restricted
 * everywhere under `apps/mobile/` except this file). The bug this replaces was a single
 * line — `new Date().toISOString().slice(0, 10)` — that returned a **UTC** date while
 * the `Clock` contract promised a local one, and it reached every engine at once
 * through `engineContext()`. A learner in Madrid practising at 00:30 wrote reps against
 * yesterday and watched today's Refrain set re-roll at 02:00.
 *
 * Two day keys, and they are not interchangeable:
 *   • `localDay()`  — midnight to midnight. The Refrain's frozen set rolls here.
 *   • `streakDay()` — plus a four-hour grace window, so 01:30 counts for yesterday.
 *
 * The arithmetic lives in `@loro/core`'s calendar module (mirroring
 * `core-rs/src/calendar.rs`), not here. This file's whole job is to turn the platform's
 * timezone knowledge into the local wall-clock milliseconds that maths expects.
 *
 * See docs/architecture/scheduling.md#day-boundaries
 */

import { streakDayFor, type Clock } from '@loro/core'

const MS_PER_MINUTE = 60_000

const pad = (n: number): string => String(n).padStart(2, '0')

/**
 * `YYYY-MM-DD` from a Date's LOCAL components.
 *
 * Never `toISOString()` — that is UTC by definition, which is the entire bug.
 */
export function localDayOf(at: Date): string {
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`
}

/**
 * Local wall-clock ms: epoch ms shifted so that dividing by a day lands on the
 * learner's calendar date instead of UTC's.
 *
 * `getTimezoneOffset()` returns the minutes to ADD to local time to reach UTC (−120 in
 * Madrid in summer), so it is subtracted here.
 */
export function localWallMsOf(at: Date): number {
  return at.getTime() - at.getTimezoneOffset() * MS_PER_MINUTE
}

/**
 * Midnight at the start of `at`'s local day, in the same wall-clock frame.
 *
 * The offset is read from **that midnight**, not from `at`, so a day containing a DST
 * transition still starts where the learner's clock says it does.
 */
export function localMidnightWallMsOf(at: Date): number {
  const midnight = new Date(at.getFullYear(), at.getMonth(), at.getDate(), 0, 0, 0, 0)
  return localWallMsOf(midnight)
}

/** The streak day key for an instant — `localDay` plus the grace window. */
export function streakDayOf(at: Date): string {
  return streakDayFor(localWallMsOf(at), localMidnightWallMsOf(at))
}

/**
 * The last `count` local days, oldest first, each with its weekday initial.
 *
 * What the Progress week-row draws. Built from local date components rather than by
 * subtracting 24 hours, so the day either side of a DST transition is still one day away.
 */
export function recentLocalDays(count: number, at: Date = new Date()): RecentDay[] {
  const days: RecentDay[] = []
  for (let back = count - 1; back >= 0; back--) {
    // `new Date(y, m, d - back)` normalises across month and year boundaries.
    const d = new Date(at.getFullYear(), at.getMonth(), at.getDate() - back)
    days.push({
      day: localDayOf(d),
      initial: d.toLocaleDateString(currentNativeLanguage(), { weekday: 'narrow' }),
    })
  }
  return days
}

export interface RecentDay {
  /** 'YYYY-MM-DD', the same key shape the store's practice history uses. */
  day: string
  /** One letter, in the device's locale. */
  initial: string
}

/**
 * The full local date — "Tuesday, 29 July" — in the device's locale.
 *
 * The v1.1 root header names the actual day (`Navigation.dc.html:113`), where the earlier Today
 * header printed a weekday and a tagline ("Tuesday · the daily refrain"). A display string rather
 * than a day key, but it lives here because it needs a `Date` and this is the one file allowed one.
 */
export function localDateLabel(): string {
  return new Date().toLocaleDateString(currentNativeLanguage(), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

/**
 * The device's local wall-clock time as zero-padded `HH:MM`.
 *
 * Deliberately the same shape the engine settings keep wave times in
 * (`waveTimes: ['08:00', '13:00', '19:00']`), so the day list compares them as strings and
 * neither side is ever parsed into minutes. Zero-padded 24-hour strings sort the way the
 * clock does, which is the whole trick.
 */
export function localTimeLabel(): string {
  const at = new Date()
  return `${pad(at.getHours())}:${pad(at.getMinutes())}`
}

/**
 * The real clock. Injected into engines and read by the store; nothing else should
 * need the time.
 */
export const deviceClock: Clock = {
  now: () => Date.now(),
  localDay: () => localDayOf(new Date()),
  streakDay: () => streakDayOf(new Date()),
}
