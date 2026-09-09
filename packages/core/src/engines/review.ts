/** P3-30: Review input boundary. Scheduling and ordering remain canonical-core work. */
import type { TargetLocale } from '../domain/languages.js'
import type { UserPhraseId } from '../domain/ids.js'
import { isDue, type PhraseState, type Tag } from '../domain/phrase.js'
import type {
  Attempt,
  Availability,
  EngineContext,
  PracticeEngine,
  PracticeItem,
  ProgressDelta,
  SessionHandle,
  SessionPlan,
  SessionSummary,
} from './types.js'
import {
  canonicalReviewDelta,
  distinctPhrases,
  itemAtCursor,
  itemFor,
  workedItems,
} from './common.js'

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

/** Four explicit learner choices map one-to-one to canonical FSRS ratings. */
export const REVIEW_GRADES = ['again', 'hard', 'good', 'easy'] as const
export type ReviewGrade = (typeof REVIEW_GRADES)[number]

/**
 * A finite, course-scoped review session.
 *
 * `attemptId` is deliberately outside this pure engine contract. The store supplies a stable id
 * when it commits a grade, and `committed_attempt` makes retries idempotent in the same local
 * transaction as the phrase, review event, checkpoint and outbox writes. Undo is not represented
 * here: acknowledged reviews require plan 68's compensating-operation semantics.
 */
export interface ReviewAttemptContract {
  readonly itemId: string
  readonly phraseId: UserPhraseId
  readonly grade: ReviewGrade
  /** Epoch milliseconds from the injected device clock. */
  readonly at: number
}

/** `dailyMinutes × 4` is the documented review-load ceiling (practice-engines.md). */
export function reviewLimit(dailyMinutes: EngineContext['settings']['dailyMinutes']): number {
  return dailyMinutes * 4
}

/**
 * P3-30: explicit-grade FSRS review.
 *
 * This engine only plans phrases that already have a due canonical schedule. Unscheduled phrases
 * remain visible to the caller as `ReviewCandidates.unscheduled`; choosing their first-review
 * policy belongs to the canonical FSRS boundary, never to this route or engine.
 */
export class ReviewEngine implements PracticeEngine {
  readonly id = 'srs' as const

  constructor(readonly targetLocale: TargetLocale) {}

  private async candidates(ctx: EngineContext): Promise<ReviewCandidates> {
    return reviewCandidates(await ctx.phrases.all(), this.targetLocale, ctx.clock.now())
  }

  async availability(ctx: EngineContext): Promise<Availability> {
    const candidates = await this.candidates(ctx)
    return candidates.state === 'due'
      ? { state: 'available' }
      : { state: 'unavailable', reason: `review-${candidates.state}` }
  }

  async plan(ctx: EngineContext): Promise<SessionPlan> {
    const candidates = await this.candidates(ctx)
    // Candidate order comes from the repository boundary. The engine may cap work but may not
    // calculate a competing FSRS rank or synthesize an interval for an unscheduled phrase.
    const due = candidates.due.slice(0, reviewLimit(ctx.settings.dailyMinutes))
    return {
      engineId: this.id,
      items: due.map((phrase) => ({
        itemId: `${phrase.id}#review`,
        phraseId: phrase.id,
        mode: 'review',
        prompt: { show: 'meaning' },
        gate: { kind: 'self-report' },
        audio: null,
        meta: { focus: reviewFocus(phrase.tags), due: phrase.srs?.due ?? null },
      })),
      estimatedMs: 0,
      closed: true,
    }
  }

  next(session: SessionHandle): Promise<PracticeItem | null> {
    return itemAtCursor(session)
  }

  async record(
    session: SessionHandle,
    attempt: Attempt,
    ctx?: EngineContext,
  ): Promise<ProgressDelta> {
    const item = itemFor(session, attempt)
    if (attempt.selfGrade === undefined || !REVIEW_GRADES.includes(attempt.selfGrade))
      throw new Error('Review requires an explicit learner grade')
    if (ctx === undefined) throw new Error('Review requires its canonical engine context')
    const phrase = await ctx.phrases.byId(item.phraseId)
    if (phrase === null) throw new Error('Review phrase no longer exists')
    if ((phrase.targetLocale ?? 'es-ES') !== this.targetLocale)
      throw new Error('Review phrase belongs to another target course')
    if (!isDue(phrase, attempt.at)) throw new Error('Review phrase is no longer due')

    return canonicalReviewDelta(
      ctx,
      item,
      attempt,
      phrase,
      { reps: 1, latencyMs: null },
      { required: true },
    )
  }

  summarize(session: SessionHandle): Promise<SessionSummary> {
    const worked = workedItems(session)
    return Promise.resolve({
      engineId: this.id,
      phrasesTouched: distinctPhrases(worked),
      phrasesProduced: 0,
      durationMs: 0,
      extra: {},
    })
  }
}
