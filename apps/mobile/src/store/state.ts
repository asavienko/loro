/**
 * The store's data shape, its initial value, and the pure functions that write it.
 *
 * Separate from `index.ts` so the write rules can be tested without a store instance,
 * and so the initial state is one declaration rather than a list repeated in `create()`
 * and `reset()` — a `reset()` that enumerates fields always drifts from the state that
 * gains them, which is how `dailyMinutes` and `streakDays` survived a "reset" and leaked
 * to the next learner on a shared device.
 */

import {
  LOCK_IN_DAYS_TO_GRADUATE,
  type FsrsState,
  type PhraseState,
  type ProgressDelta,
} from '@loro/core'

export interface Toast {
  message: string
  undo?: () => void
}

/** Everything the store holds. Actions live in `index.ts`; this is only the data. */
export interface AppData {
  onboarded: boolean
  goal: string | null
  dailyMinutes: 5 | 10 | 20
  phrases: PhraseState[]
  toast: Toast | null
  selectedId: string | null
  /**
   * The distinct STREAK days on which the learner completed at least one rep, ascending
   * and deduped.
   *
   * A history, not a count. A count cannot be recomputed after a gap, cannot survive a
   * clock change, and cannot draw a calendar — and the number it replaces was the literal
   * `streakDays: 1`, rendered to the learner as a fact with flames next to it.
   *
   * Keyed on `clock.streakDay()`, not `localDay()`: a 01:30 session belongs to the
   * evening it continues.
   */
  practiceDays: string[]

  // Refrain day state — chosen once, FROZEN. "You always see today."
  refrainSet: string[]
  refrainDay: string | null
  /**
   * Ids substituted into today's set after it was frozen, because their original was
   * deleted. Kept so the frozen-set promise stays legible: the set was not re-rolled,
   * a member was replaced.
   */
  refrainSubstituted: string[]
}

/**
 * The one declaration of a fresh app.
 *
 * `reset()` spreads this, so a field added here is cleared by reset for free.
 */
export const INITIAL_STATE: AppData = {
  onboarded: false,
  goal: null,
  dailyMinutes: 10,
  phrases: [],
  toast: null,
  selectedId: null,
  practiceDays: [],
  refrainSet: [],
  refrainDay: null,
  refrainSubstituted: [],
}

/** The data half of the store, for assertions and (later) persistence. */
export function dataOf(state: AppData): AppData {
  return {
    onboarded: state.onboarded,
    goal: state.goal,
    dailyMinutes: state.dailyMinutes,
    phrases: state.phrases,
    toast: state.toast,
    selectedId: state.selectedId,
    practiceDays: state.practiceDays,
    refrainSet: state.refrainSet,
    refrainDay: state.refrainDay,
    refrainSubstituted: state.refrainSubstituted,
  }
}

/**
 * How much practice history is kept.
 *
 * The Progress screen never shows more than a year, and a streak breaks after one missed
 * day, so a longer tail would be storage the product cannot use. Documented in
 * docs/architecture/data-model.md.
 */
export const PRACTICE_DAY_RETENTION = 400

/**
 * Record a streak day. Idempotent, sorted, and bounded.
 *
 * Sorted and deduped on write so every reader gets the same shape, and so the stored
 * array is a set rather than a log of taps.
 */
export function addPracticeDay(days: readonly string[], day: string): string[] {
  if (days.includes(day)) return days as string[]
  const next = [...days, day].sort()
  return next.length > PRACTICE_DAY_RETENTION
    ? next.slice(next.length - PRACTICE_DAY_RETENTION)
    : next
}

// ─────────────────────────────────────────────────────────────────────────────
// Applying an engine delta
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Apply one engine delta to one row. The ONLY place progress fields are written.
 *
 * Which fields are increments, which are absolute, and which are monotonic is declared
 * on `ProgressDelta` — read the two together. Before this existed, the store hand-wrote
 * a subset of the signals and invented `axProduction: p.axProduction + 2`, so the
 * engine's ten-plus signals (rule 5) were unreachable from the UI and the conformance
 * suite proved a property the app never exercised.
 */
export function applyDeltaToPhrase(
  p: PhraseState,
  d: ProgressDelta,
  localDay: string,
): PhraseState {
  // ABSOLUTE and day-scoped. Absent means the engine is not reporting a day count, so
  // the counter AND its day stamp both stay as they are — writing a fresh count under a
  // stale stamp, or a stale count under today's, is how `repsToday` starts lying.
  // Staleness is handled where it is read, by `repsToday(p, day)`.
  const reportsDay = d.repsToday !== undefined
  const auto = d.automaticity ?? p.automaticity

  // `lockInDays` counts DISTINCT days, so the increment has to be idempotent within a
  // day. It is, without storing a "locked in on" marker: the crossing from below 100 to
  // 100 can only happen once per day, because a new day resets `repsToday` and
  // therefore `automaticity`.
  const lockedInNow = d.lockedInToday === true && p.automaticity < 100 && auto >= 100
  const lockInDays = p.lockInDays + (lockedInNow ? 1 : 0)

  // Four distinct lock-in days graduates a phrase out of rotation. Nothing wrote
  // `lockInDays` before this function existed, so graduation was unreachable; wiring
  // one without the other would leave phrases in rotation forever.
  const graduatedAt =
    p.graduatedAt === null && lockInDays >= LOCK_IN_DAYS_TO_GRADUATE
      ? (d.lastPracticedAt ?? p.lastPracticedAt)
      : p.graduatedAt

  return {
    ...p,
    // INCREMENTS.
    reps: p.reps + (d.reps ?? 0),
    plays: p.plays + (d.plays ?? 0),
    stumbles: p.stumbles + (d.stumbles ?? 0),
    axPerception: bumpAxis(p.axPerception, d.axes?.perception),
    axRecall: bumpAxis(p.axRecall, d.axes?.recall),
    axProduction: bumpAxis(p.axProduction, d.axes?.production),

    // ABSOLUTE.
    lastPracticedAt: d.lastPracticedAt ?? p.lastPracticedAt,
    difficulty: d.difficulty ?? p.difficulty,
    learned: d.learned ?? p.learned,
    repsToday: reportsDay ? (d.repsToday ?? p.repsToday) : p.repsToday,
    repsTodayDay: reportsDay ? localDay : p.repsTodayDay,
    automaticity: auto,
    srs: d.srs === undefined ? p.srs : nextSrs(p.srs, d.srs, d.lastPracticedAt ?? null),

    // MONOTONIC.
    rung: d.rung === undefined ? p.rung : Math.max(p.rung, d.rung),
    cueLevel: d.cueLevel === undefined ? p.cueLevel : Math.max(p.cueLevel, d.cueLevel),

    // DERIVED from the flags above.
    lockInDays,
    graduatedAt,

    // NOT STORED YET, and deliberately not faked:
    //   • `latencySampleMs` — the latency store lands with the measurement fix
    //     (plans/03-fix-latency-measurement.md). Dropping the sample is honest; writing
    //     it onto an invented field would not be.
    //   • `staleReset` — Loop C staleness has no home until the Phrasebook
    //     (plans/28-screens-run-and-phrasebook.md).
  }
}

/** Axes are percentages. Clamped to 0…100 — the old store clamped at 99, arbitrarily. */
function bumpAxis(current: number, delta: number | undefined): number {
  return Math.max(0, Math.min(100, current + (delta ?? 0)))
}

/**
 * FSRS state, merged as a group.
 *
 * `lapses` and `state` are carried rather than computed: no engine reports them, and
 * the real transitions are FSRS's own (plans/17-fsrs-implementation-and-parity.md).
 * Guessing them here would put a made-up card state behind the memory-model screen.
 */
function nextSrs(
  prev: FsrsState | null,
  next: NonNullable<ProgressDelta['srs']>,
  at: number | null,
): FsrsState {
  return {
    stability: next.stability,
    difficulty: next.difficulty,
    due: next.due,
    lastReview: at ?? prev?.lastReview ?? null,
    lapses: prev?.lapses ?? 0,
    state: prev?.state ?? 'learning',
  }
}
