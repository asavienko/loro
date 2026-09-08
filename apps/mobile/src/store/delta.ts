/**
 * Applying an engine delta — the ONLY place a progress field is written.
 *
 * A screen calls `engine.record(...)` and hands the `ProgressDelta` to the store; nothing
 * else writes progress. `ProgressDelta` (packages/core/src/engines/types.ts) declares, per
 * field, whether a signal is an INCREMENT, an ABSOLUTE, or MONOTONIC — read that comment
 * and this file together.
 *
 * That declaration used to be honoured by a hand-written object literal, one branch per
 * field, and a hand-written literal has no way to notice a field it forgot: the store wrote
 * a subset of the engine's ten-plus signals (rule 5) and invented `axProduction + 2` for
 * one of them, so the conformance suite proved a property the app never exercised. So the
 * classification is a TABLE keyed by every field of `ProgressDelta`:
 *
 *   • `DELTA_RULES` is `Record<DeltaField, DeltaRule>`, so a signal added to the contract
 *     is a TYPE ERROR here until someone classifies it. It cannot be silently dropped.
 *   • A field the store deliberately does not store says so, in the table, with a reason —
 *     "not handled" and "handled by ignoring it, on purpose" stop looking alike.
 */

import {
  LOCK_IN_DAYS_TO_GRADUATE,
  type FsrsState,
  type PhraseState,
  type ProgressDelta,
} from '@loro/core'

/** Every signal a delta can carry. `phraseId` names the row, so it is not a signal. */
type DeltaField = Exclude<keyof ProgressDelta, 'phraseId'>

/** How one signal reaches the row. Returns only the fields it owns. */
type DeltaWrite = (p: PhraseState, d: ProgressDelta) => Partial<PhraseState>

type DeltaRule =
  /** INCREMENT — add to the stored value. Absent means zero. */
  | { readonly kind: 'increment'; readonly write: DeltaWrite }
  /** ABSOLUTE — replace the stored value. Absent means unchanged. */
  | { readonly kind: 'absolute'; readonly write: DeltaWrite }
  /** MONOTONIC — take the max; the value may never fall. */
  | { readonly kind: 'monotonic'; readonly write: DeltaWrite }
  /**
   * Written, but not field-for-field: one signal that lands on several columns, or needs
   * the local day. Implemented by the named function below, not by this table.
   */
  | { readonly kind: 'derived'; readonly by: string }
  /** No column to write it to yet, and deliberately not faked. */
  | { readonly kind: 'unstored'; readonly why: string }

/**
 * The classification. Every field of `ProgressDelta`, exactly once.
 *
 * The `by` / `why` strings are read by nothing — they are the documentation the type system
 * makes it impossible to omit.
 *
 * Exported for the coverage guard in `delta.test.ts`, which does for this table what
 * `packages/core/src/sync/fieldPolicy.test.ts` does for `FIELD_POLICY`: the type forces a
 * new signal to be classified, and the test forces the sample delta to grow with it, so
 * neither guard can be satisfied by deleting the other.
 */
export const DELTA_RULES: Readonly<Record<DeltaField, DeltaRule>> = {
  // ── INCREMENTS ──
  reps: { kind: 'increment', write: (p, d) => ({ reps: p.reps + (d.reps ?? 0) }) },
  plays: { kind: 'increment', write: (p, d) => ({ plays: p.plays + (d.plays ?? 0) }) },
  stumbles: { kind: 'increment', write: (p, d) => ({ stumbles: p.stumbles + (d.stumbles ?? 0) }) },
  axes: {
    kind: 'increment',
    write: (p, d) => ({
      axPerception: bumpAxis(p.axPerception, d.axes?.perception),
      axRecall: bumpAxis(p.axRecall, d.axes?.recall),
      axProduction: bumpAxis(p.axProduction, d.axes?.production),
    }),
  },

  // ── ABSOLUTES ──
  lastPracticedAt: {
    kind: 'absolute',
    write: (p, d) => ({ lastPracticedAt: d.lastPracticedAt ?? p.lastPracticedAt }),
  },
  difficulty: { kind: 'absolute', write: (p, d) => ({ difficulty: d.difficulty ?? p.difficulty }) },
  learned: { kind: 'absolute', write: (p, d) => ({ learned: d.learned ?? p.learned }) },
  automaticity: {
    kind: 'absolute',
    write: (p, d) => ({ automaticity: d.automaticity ?? p.automaticity }),
  },

  // ── MONOTONIC ──
  rung: {
    kind: 'monotonic',
    write: (p, d) => ({ rung: d.rung === undefined ? p.rung : Math.max(p.rung, d.rung) }),
  },
  cueLevel: {
    kind: 'monotonic',
    write: (p, d) => ({
      cueLevel: d.cueLevel === undefined ? p.cueLevel : Math.max(p.cueLevel, d.cueLevel),
    }),
  },

  // ── DERIVED ──
  repsToday: { kind: 'derived', by: 'dayScopedReps — writes the counter and its day stamp' },
  srs: { kind: 'derived', by: 'mergedSrs — merged as a group, carrying lapses and state' },
  lockedInToday: { kind: 'derived', by: 'lockIn — a flag becomes lockInDays and graduatedAt' },

  // ── NOT STORED YET, and deliberately not faked ──
  latencySampleMs: {
    kind: 'unstored',
    why: 'the latency store lands with the measurement fix (plans/03). Dropping the sample is honest; writing it onto an invented field would not be',
  },
  staleReset: {
    kind: 'unstored',
    why: 'Loop C staleness has no home until the Phrasebook (plans/28)',
  },
}

/**
 * Apply one delta to one row.
 *
 * Two properties of this loop are load-bearing, and both are easy to "optimise" away:
 *
 *   1. **Every rule runs on every delta**, including when the delta carries nothing for it.
 *      `bumpAxis(p.axPerception, undefined)` re-clamps a stored axis that is somehow out of
 *      range, so a row is repaired by the next delta rather than carrying a bad percentage
 *      forever. A reducer that skipped absent keys would silently drop that repair, and the
 *      empty-delta test could not see it — its fixture axes are already 0. Pinned by
 *      `delta.test.ts` "clamps a stored axis even when the delta carries no axes".
 *   2. **Every rule reads the ORIGINAL row**, never a partly-written one. The fields are
 *      disjoint by construction, so the result cannot depend on the order the table happens
 *      to iterate in.
 */
export function applyDeltaToPhrase(
  p: PhraseState,
  d: ProgressDelta,
  localDay: string,
): PhraseState {
  let next: PhraseState = { ...p }
  for (const rule of Object.values(DELTA_RULES)) {
    if (rule.kind === 'derived' || rule.kind === 'unstored') continue
    next = { ...next, ...rule.write(p, d) }
  }
  return { ...next, ...dayScopedReps(d, localDay), ...mergedSrs(p, d), ...lockIn(p, d) }
}

/**
 * `repsToday` is ABSOLUTE and day-scoped, so the counter and its day stamp move together.
 *
 * Absent means the engine is not reporting a day count, so BOTH stay as they are — writing
 * a fresh count under a stale stamp, or a stale count under today's, is how `repsToday`
 * starts lying. Staleness is handled where it is read, by `repsToday(p, day)`.
 */
function dayScopedReps(d: ProgressDelta, localDay: string): Partial<PhraseState> {
  if (d.repsToday === undefined) return {}
  return { repsToday: d.repsToday, repsTodayDay: localDay }
}

/** FSRS is ABSOLUTE and merged as a GROUP — see `nextSrs`. */
function mergedSrs(p: PhraseState, d: ProgressDelta): Partial<PhraseState> {
  if (d.srs === undefined) return {}
  return { srs: nextSrs(p.srs, d.srs, d.lastPracticedAt ?? null) }
}

/**
 * `lockedInToday` is a FLAG; `lockInDays` counts DISTINCT days, so the increment has to be
 * idempotent within a day. It is, without storing a "locked in on" marker: the crossing
 * from below 100 to 100 can only happen once per day, because a new day resets `repsToday`
 * and therefore `automaticity`.
 *
 * Four distinct lock-in days graduates a phrase out of rotation. Nothing wrote `lockInDays`
 * before this existed, so graduation was unreachable; wiring one without the other would
 * leave phrases in rotation forever — which is why both come out of one function.
 */
function lockIn(p: PhraseState, d: ProgressDelta): Partial<PhraseState> {
  const auto = d.automaticity ?? p.automaticity
  const lockedInNow = d.lockedInToday === true && p.automaticity < 100 && auto >= 100
  const lockInDays = p.lockInDays + (lockedInNow ? 1 : 0)
  const graduatedAt =
    p.graduatedAt === null && lockInDays >= LOCK_IN_DAYS_TO_GRADUATE
      ? (d.lastPracticedAt ?? p.lastPracticedAt)
      : p.graduatedAt
  return { lockInDays, graduatedAt }
}

/** Axes are percentages. Clamped to 0…100 — the old store clamped at 99, arbitrarily. */
function bumpAxis(current: number, delta: number | undefined): number {
  return Math.max(0, Math.min(100, current + (delta ?? 0)))
}

/**
 * FSRS state, merged as a group.
 *
 * The canonical scheduler supplies review time, lapses and state together. Older
 * engine deltas preserve existing values until they supply this metadata too.
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
    lastReview: next.lastReview ?? at ?? prev?.lastReview ?? null,
    lapses: next.lapses ?? prev?.lapses ?? 0,
    state: next.state ?? prev?.state ?? 'learning',
  }
}
