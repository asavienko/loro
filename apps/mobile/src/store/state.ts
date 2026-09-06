/**
 * The store's data shape and its initial value.
 *
 * Separate from the store instance so the shape can be asserted on without one, and so the
 * initial state is one declaration rather than a list repeated in `create()` and `reset()`
 * — a `reset()` that enumerates fields always drifts from the state that gains them, which
 * is how `dailyMinutes` and `streakDays` survived a "reset" and leaked to the next learner
 * on a shared device.
 *
 * Data only. The actions are slices under `slices/`, and the one function that writes a
 * progress field is `delta.ts`.
 */

import type { NativeLanguage, TargetLocale, PhraseState, SessionHandle } from '@loro/core'

export interface Toast {
  message: string
  undo?: () => void
}

/** Everything the store holds. Actions live in `slices/`; this is only the data. */
export interface RefrainResume {
  session: SessionHandle | null
  cursor: number
  lastLatency: number | null
  history: (number | null)[]
  done: boolean
}
export const EMPTY_REFRAIN_RESUME: RefrainResume = {
  session: null,
  cursor: 0,
  lastLatency: null,
  history: [],
  done: false,
}
export interface CourseState {
  streamCursor: number
  refrainResume: RefrainResume
  onboarded: boolean
  phrases: PhraseState[]
  selectedId: string | null
  refrainSet: string[]
  refrainDay: string | null
  refrainSubstituted: string[]
}
export interface AppData {
  streamCursor: number
  refrainResume: RefrainResume
  nativeLanguage: NativeLanguage
  targetLocale: TargetLocale
  languageChosen: boolean
  courses: Partial<Record<TargetLocale, CourseState>>
  onboarded: boolean
  goal: string | null
  /**
   * The learner's self-reported Spanish (`beg` | `some` | `conf`), or `null` before onboarding.
   *
   * Collected since the screen shipped and DROPPED at the moment of commit — `completeOnboarding`
   * took three of the four answers, so the level question's own helper ("Sets how long and tricky
   * your first phrases are") described a setting that did not exist and the ready screen could
   * only summarise three answers (`P1-04`, `P1-08`).
   *
   * Persisting it is not the same as acting on it: biasing initial phrase length and difficulty is
   * plan 60's set selection, and until then this is a stored answer and nothing reads it. That is
   * the order plan 50 §3 called for — never ship a question whose answer is discarded.
   *
   * `settings.level` already carries a declared `lww` merge class
   * (`packages/core/src/sync/fieldPolicy.ts`), so this is the field the sync contract expected.
   */
  level: string | null
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
  streamCursor: 0,
  refrainResume: EMPTY_REFRAIN_RESUME,
  nativeLanguage: 'en',
  targetLocale: 'es-ES',
  languageChosen: false,
  courses: {},
  onboarded: false,
  goal: null,
  level: null,
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
    nativeLanguage: state.nativeLanguage,
    targetLocale: state.targetLocale,
    languageChosen: state.languageChosen,
    courses: state.courses,
    streamCursor: state.streamCursor,
    refrainResume: state.refrainResume,
    onboarded: state.onboarded,
    goal: state.goal,
    level: state.level,
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
