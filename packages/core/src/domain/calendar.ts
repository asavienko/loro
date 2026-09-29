/**
 * Day boundaries and streaks — the TypeScript mirror of `core-rs/src/calendar.rs`.
 *
 * TWO day keys, deliberately:
 *   • `localDay`  — midnight to midnight. The Refrain's frozen set rolls here, because
 *                   a learner mid-ritual must not watch today's set change under them.
 *   • `streakDay` — midnight PLUS a four-hour grace window, so practising at 01:30
 *                   counts for yesterday. The alternative punishes night owls.
 *
 * See docs/architecture/scheduling.md#day-boundaries for why they differ.
 *
 * ── Why this file exists at all ──
 * `core-rs` owns every number that must be identical across platforms (ADR-0002), and
 * these are such numbers — the widget computes a streak natively, with no JS in reach.
 * UniFFI already exports `streak_day_for` (and the rest of this module). No production JS
 * calls this mirror since the app moved to its own clock (apps/mobile/src/shared/state/clock.ts);
 * it stays as the TypeScript side of the shared parity fixtures.
 * The JSON WASM `bridge.rs` does not dispatch calendar methods (HLC is bridged). Parity
 * fixtures (`calendar.fixtures.json`) are asserted by both `calendar.test.ts` and
 * `core-rs/tests/parity.rs`, so a divergence fails the build in one language or the
 * other. This module stays the JS owner until plan 70's widgets call UniFFI directly —
 * do not delete it because the native export exists. See
 * plans/archive/2026-07-30/05-fix-shared-maths-duplication.md.
 *
 * ── The wall-ms convention ──
 * Every `*WallMs` argument is LOCAL wall-clock milliseconds: epoch ms shifted by the
 * device's UTC offset, so that dividing by 86 400 000 lands on the learner's calendar
 * day rather than UTC's. The crate has no clock and no timezone database, which is why
 * the shift happens at the caller's edge and never in here.
 */

/** A local calendar date, `YYYY-MM-DD`. */
export type LocalDay = string

const MS_PER_DAY = 86_400_000

/**
 * Hours after midnight during which practice still counts for the previous day.
 * Mirrors `calendar::STREAK_GRACE_HOURS`.
 */
export const STREAK_GRACE_HOURS = 4

/**
 * The day a timestamp belongs to for STREAK purposes, applying the grace window.
 *
 * Both arguments are local wall-clock ms (see the module header).
 */
export function streakDayFor(atWallMs: number, localMidnightWallMs: number): LocalDay {
  const graceMs = STREAK_GRACE_HOURS * 3_600_000
  const effective =
    atWallMs < localMidnightWallMs + graceMs
      ? // Inside the grace window: count it for the previous day.
        atWallMs - graceMs
      : atWallMs
  return formatYmd(effective)
}

/**
 * Days between two local dates, positive when `b` is later. Calendar days, not
 * elapsed hours. `null` when either string is not `YYYY-MM-DD`.
 */
export function daysBetween(a: string, b: string): number | null {
  const ja = julian(a)
  const jb = julian(b)
  if (ja === null || jb === null) return null
  return jb - ja
}

/**
 * Whether a streak survives, given the last practised day and today.
 *
 * A gap of 0 (same day) or 1 (yesterday) keeps it. **Timezone travel never breaks a
 * streak**: a negative gap — flying west, so the local date moved backwards — counts
 * as the same day.
 */
export function streakSurvives(lastDay: string, today: string): boolean {
  const gap = daysBetween(lastDay, today)
  return gap !== null && gap <= 1
}

/**
 * The current streak length, from the set of days the learner practised.
 *
 * `practiceDays` need not be sorted or deduped. A gap of more than one calendar day
 * ends the run. A streak whose last day is yesterday is still alive and still counted:
 * today is not over, and nothing here shames a missed day (non-negotiable #3).
 *
 * Unparseable days are DROPPED, not treated as a gap. They sort after every real date
 * (`'n' > '2'`), so counting them would let one corrupt row zero a real streak — a
 * number the learner earned disappearing because of a storage bug.
 */
export function streak(practiceDays: readonly string[], today: string): number {
  const days = [...new Set(practiceDays)].filter((d) => julian(d) !== null).sort()
  const last = days[days.length - 1]
  if (last === undefined || !streakSurvives(last, today)) return 0

  let count = 1
  let cursor = last
  for (let i = days.length - 2; i >= 0; i--) {
    const day = days[i]
    if (day === undefined) break
    if (daysBetween(day, cursor) !== 1) break
    count++
    cursor = day
  }
  return count
}

// ─────────────────────────────────────────────────────────────────────────────
// Mirrors of the crate's private helpers. Integer division is written with
// Math.trunc / Math.floor to match Rust's `/` on i32 and `div_euclid` exactly —
// a float divide here would drift from the Rust by a day at the boundaries.
// ─────────────────────────────────────────────────────────────────────────────

/** Parse `YYYY-MM-DD` into a day number, for differencing. Fliegel–Van Flandern. */
function julian(s: string): number | null {
  const parts = s.split('-')
  if (parts.length !== 3) return null
  const [ys, ms, ds] = parts
  if (ys === undefined || ms === undefined || ds === undefined) return null
  const y = parseIntStrict(ys)
  const m = parseIntStrict(ms)
  const d = parseIntStrict(ds)
  if (y === null || m === null || d === null) return null
  if (m < 1 || m > 12 || d < 1 || d > 31) return null

  const a = Math.trunc((14 - m) / 12)
  const y2 = y + 4800 - a
  const m2 = m + 12 * a - 3
  return (
    d +
    Math.trunc((153 * m2 + 2) / 5) +
    365 * y2 +
    Math.trunc(y2 / 4) -
    Math.trunc(y2 / 100) +
    Math.trunc(y2 / 400) -
    32_045
  )
}

/**
 * Rust's `str::parse::<i32>()` — all digits or nothing.
 * `Number('7 ')` is 7 and `parseInt('7x')` is 7; both would accept input the Rust
 * rejects, and a parity test that passes for the wrong reason is worse than none.
 */
function parseIntStrict(s: string): number | null {
  if (!/^\d+$/.test(s)) return null
  return Number(s)
}

/** Format local wall-clock ms as `YYYY-MM-DD`. */
function formatYmd(wallMs: number): string {
  const days = Math.floor(wallMs / MS_PER_DAY)
  const { y, m, d } = fromDays(days)
  return `${pad(y, 4)}-${pad(m, 2)}-${pad(d, 2)}`
}

/** Inverse of `julian`, for the Unix epoch day count. */
function fromDays(daysSinceEpoch: number): { y: number; m: number; d: number } {
  // 1970-01-01 is Julian day 2440588.
  const jd = daysSinceEpoch + 2_440_588
  const a = jd + 32_044
  const b = Math.trunc((4 * a + 3) / 146_097)
  const c = a - Math.trunc((146_097 * b) / 4)
  const dd = Math.trunc((4 * c + 3) / 1461)
  const e = c - Math.trunc((1461 * dd) / 4)
  const mm = Math.trunc((5 * e + 2) / 153)
  return {
    y: 100 * b + dd - 4800 + Math.trunc(mm / 10),
    m: mm + 3 - 12 * Math.trunc(mm / 10),
    d: e - Math.trunc((153 * mm + 2) / 5) + 1,
  }
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, '0')
}
