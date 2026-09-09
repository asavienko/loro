/** P3-30: Review input boundary. Scheduling and ordering remain canonical-core work. */
import type { TargetLocale } from '../domain/languages.js'
import { isDue, type PhraseState, type Tag } from '../domain/phrase.js'

export type ReviewFocus = 'pronunciation' | 'memory-hook' | 'high-use' | 'recall'

/** Authored priority, including mixed-tag phrases (Loro.dc.html:2769–2774). */
export function reviewFocus(tags: readonly Tag[]): ReviewFocus {
  if (tags.includes('pron')) return 'pronunciation'
  if (tags.includes('remember')) return 'memory-hook'
  if (tags.includes('useful')) return 'high-use'
  return 'recall'
}

export interface ReviewCandidates {
  readonly targetLocale: TargetLocale
  /** Epoch milliseconds supplied by the app clock, as in FsrsState.due. */
  readonly at: number
  /** No schedule is different from a reviewed phrase that is not due yet. */
  readonly state: 'empty-course' | 'no-schedule' | 'nothing-due' | 'due'
  /** Repository order is preserved; this boundary does not invent a ranking algorithm. */
  readonly due: readonly PhraseState[]
  /** These need a first-review policy, not an invented historical FSRS state. */
  readonly unscheduled: readonly PhraseState[]
}

/**
 * Call with live repository rows (tombstones excluded). Review eligibility deliberately
 * includes graduated phrases, unlike daily rotation. Native UI language does not reset
 * a target course. Legacy rows belong to Spanish, as in PhraseState's persistence contract.
 * This is an input partition, not a session plan or evidence that any review happened.
 */
export function reviewCandidates(
  phrases: readonly PhraseState[],
  targetLocale: TargetLocale,
  at: number,
): ReviewCandidates {
  if (!Number.isFinite(at)) throw new Error('Review requires a finite clock instant')
  const course = phrases.filter((phrase) => (phrase.targetLocale ?? 'es-ES') === targetLocale)
  const eligible = course.filter((phrase) => !phrase.learned)
  const due = eligible.filter((phrase) => isDue(phrase, at))
  const unscheduled = eligible.filter((phrase) => phrase.srs === null)
  const state =
    course.length === 0
      ? 'empty-course'
      : due.length > 0
        ? 'due'
        : eligible.length > 0 && unscheduled.length === eligible.length
          ? 'no-schedule'
          : 'nothing-due'
  return { targetLocale, at, state, due, unscheduled }
}
