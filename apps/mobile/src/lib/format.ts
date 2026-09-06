import { message } from './i18n'
/**
 * Learner-facing formatting.
 *
 * These live here rather than inline in components because they encode blueprint
 * contracts, and a contract that lives in a component gets quietly reinvented on the
 * next screen.
 */

/**
 * Interval formatting, from the blueprint (`Loro.dc.html:3009`).
 *
 * The blueprint's FIXED interval labels are a display model; these format FSRS's real
 * computed output. See docs/architecture/adr/0004-fsrs-scheduler.md
 */
export function formatInterval(days: number): string {
  if (days < 0.9) return message('format.soon')
  if (days < 1.6) return message('format.tomorrow')
  if (days < 30) return message('format.days', { days: Math.round(days) })
  return message('format.weeks', { weeks: Math.round(days / 7) })
}

/**
 * A measured latency, or `null` when speech onset was never detected.
 *
 * RULE 4: every number shown to a learner is real. `null` renders as nothing — the
 * read-out is HIDDEN rather than filled with a plausible estimate.
 * See docs/architecture/audio-speech.md#recording-and-latency
 *
 * ── Why there is no longer a clamp ──
 * This used to print `Math.min(Math.max(ms, 300), 5000)`, and both ends were falsehoods about a
 * measurement that had already been taken. A 90 ms sample was RAISED to `0.3s` and a 12-second
 * one was CAPPED at `5.0s` — the fast rep the learner was proud of and the long pause they took
 * both became numbers that never happened, and the cap made every slow rep look identical to
 * every other. "Clamped for display only" is not a defence: the display is the only place the
 * learner meets the number.
 *
 * ── Why the unit changes below a second ──
 * The blueprint's formatter is one decimal of a second (`3413`), which cannot show a sub-100 ms
 * sample at all: `.toFixed(1)` renders 45 ms as `0.0s`, and a measured value that prints as zero
 * is as untrue as an estimate. Under a second the read-out is whole milliseconds, which is the
 * precision the measurement actually has, and at or above a second it is the blueprint's
 * `N.Ns`. The boundary is exact — 999 ms is `999 ms`, 1000 ms is `1.0s` — so no value is ever
 * rendered by both branches.
 *
 * A negative sample is not a slow rep, it is a broken clock, so it reads as unmeasured. Real
 * speech-onset measurement lands in plan 63; this is only how a measured value is written down.
 */
export function formatLatency(ms: number | null): string | null {
  if (ms === null || ms < 0) return null
  if (ms < 1000) return `${String(Math.round(ms))} ms`
  return `${(ms / 1000).toFixed(1)}s`
}

/** The countdown's days-to-go, from two local dates. */
export function daysUntil(fromLocalDay: string, toLocalDay: string): number {
  const day = (s: string): number => {
    const [y = 0, m = 1, d = 1] = s.split('-').map(Number)
    return Date.UTC(y, m - 1, d) / 86_400_000
  }
  return day(toLocalDay) - day(fromLocalDay)
}

/** `38 / 100` readiness, as a percentage for the ring. */
export function ownershipPct(owned: number, target: number): number {
  if (target <= 0) return 0
  return Math.min(100, Math.round((owned / target) * 100))
}
