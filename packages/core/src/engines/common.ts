/**
 * What every engine does the same way.
 *
 * Engines differ in exactly three things — selection, sequencing, and evaluation
 * (`types.ts`). Everything else is contract plumbing, and each engine having its own
 * copy of it is how the next engine ends up forgetting a signal.
 *
 * ── Why `universalDelta` matters more than the rest ──
 * RULE 5 says every engine maintains every progress signal it can legitimately compute,
 * INCLUDING ones it does not display. The conformance suite (`conformance.ts`) catches an
 * engine that forgets, but only after it is written. `universalDelta` makes forgetting
 * hard in the first place: `reps` and `latencyMs` are REQUIRED arguments, so an author
 * has to decide about latency rather than omit it — and omitting it is exactly how a
 * screen ends up with no read-out and no one noticing (non-negotiable #2 / rule 4).
 *
 * See docs/architecture/practice-engines.md
 */

import type { PhraseState } from '../domain/phrase.js'
import type {
  Attempt,
  Availability,
  EngineContext,
  PracticeItem,
  ProgressDelta,
  SessionHandle,
} from './types.js'

// ─────────────────────────────────────────────────────────────────────────────
// Session plumbing
// ─────────────────────────────────────────────────────────────────────────────

/** The item an attempt refers to. Throws — an attempt for an unplanned item is a bug. */
export function itemFor(session: SessionHandle, attempt: Attempt): PracticeItem {
  const item = session.plan.items.find((i) => i.itemId === attempt.itemId)
  if (item === undefined) throw new Error(`unknown item ${attempt.itemId}`)
  return item
}

/** The item under the cursor, or `null` when the plan is exhausted. Every `next()`. */
export function itemAtCursor(session: SessionHandle): Promise<PracticeItem | null> {
  return Promise.resolve(session.plan.items[session.cursor] ?? null)
}

/**
 * A number from an item's engine-specific `meta` bag.
 *
 * `meta` is `Record<string, unknown>` by design — the feature layer renders whatever an
 * engine puts there — so reading it back is a cast at every call site otherwise.
 */
export function metaNumber(item: PracticeItem, key: string, fallback: number): number {
  return Number(item.meta[key] ?? fallback)
}

/** The items already worked in this session — what `summarize()` reports over. */
export function workedItems(session: SessionHandle): readonly PracticeItem[] {
  return session.plan.items.slice(0, session.cursor)
}

/** How many distinct phrases those items touched. */
export function distinctPhrases(items: readonly PracticeItem[]): number {
  return new Set(items.map((i) => i.phraseId)).size
}

/**
 * Available unless the learner has nothing in rotation.
 *
 * Every engine so far is unavailable for exactly one reason and available otherwise;
 * `reason` is the engine's own, because "stream-empty" and "no-phrases" are different
 * things to say to a learner.
 */
export function availableWhenActive(
  ctx: EngineContext,
  emptyReason: string,
): Promise<Availability> {
  return ctx.phrases
    .active()
    .then((active) =>
      active.length === 0
        ? ({ state: 'unavailable', reason: emptyReason } as const)
        : ({ state: 'available' } as const),
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// Rule 5
// ─────────────────────────────────────────────────────────────────────────────

/** The signals no engine may leave out. See the module header. */
export interface UniversalSignals {
  /** INCREMENT. 0 when the attempt did not count as one. */
  readonly reps: number
  /**
   * MEASURED, or `null`. Never estimated, never derived from a rep index. An engine that
   * cannot detect onset passes `null` — that is a real answer, not a missing one.
   */
  readonly latencyMs: number | null
  /** INCREMENT. Omit entirely for engines with no notion of a play. */
  readonly plays?: number
}

/**
 * The universal half of a `ProgressDelta`. Spread it, then add the engine's own signals:
 *
 * ```ts
 * return Promise.resolve({
 *   ...universalDelta(item, attempt, { reps: 1, latencyMs: attempt.latencyMs }),
 *   rung: LadderRung.Bent,
 * })
 * ```
 */
export function universalDelta(
  item: PracticeItem,
  attempt: Attempt,
  signals: UniversalSignals,
): ProgressDelta {
  return {
    phraseId: item.phraseId,
    reps: signals.reps,
    // `exactOptionalPropertyTypes`: an engine with no plays must have no key, not an
    // `undefined` one.
    ...(signals.plays === undefined ? {} : { plays: signals.plays }),
    lastPracticedAt: attempt.at,
    latencySampleMs: signals.latencyMs,
  }
}

/**
 * The FSRS half of `record()`: grade → `fsrsReview` → algorithm identity → `review`.
 * Speak, Refrain and Review differ in selection and extra signals, not this path.
 */
export function canonicalReviewDelta(
  ctx: EngineContext,
  item: PracticeItem,
  attempt: Attempt,
  phrase: PhraseState,
  signals: UniversalSignals,
  options: { skip?: boolean; required?: boolean } = {},
): ProgressDelta {
  const grade = ctx.core.reviewGrade(attempt)
  const srs = options.skip
    ? undefined
    : ctx.core.fsrsReview(
        phrase,
        grade,
        attempt.at,
        attempt.selfGrade === undefined ? attempt.confidence : undefined,
      )
  if (options.required ? !srs?.algorithm : srs !== undefined && !srs.algorithm)
    throw new Error('Canonical review must identify its algorithm')
  return {
    ...universalDelta(item, attempt, signals),
    ...(srs === undefined
      ? {}
      : { srs, review: { grade, at: attempt.at, algorithm: srs.algorithm ?? '' } }),
  }
}
