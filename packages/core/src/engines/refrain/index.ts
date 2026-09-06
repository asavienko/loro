/**
 * RefrainEngine — the Daily Refrain. THE v1 HERO.
 *
 * Blueprint: Loro.dc.html:1405-1532, logic 3343-3424.
 * Spec: docs/product/functional-spec.md#12-the-refrain
 *
 * One phrase, six reps, a different MANNER each rep:
 *   Echo → Chorus → Speed → Cloze → Call → Cold
 *
 * Six reps of one phrase are six different cognitive events — imitation, synchrony,
 * compression, generation, translation, free recall — not one event six times.
 *
 * Two things this engine must get right:
 *   • Latency is MEASURED, never computed. `null` when onset wasn't detected.
 *   • The daily set is chosen once and frozen. "You always see today."
 */

import type {
  Attempt,
  Availability,
  EngineContext,
  GateSpec,
  PracticeEngine,
  PracticeItem,
  ProgressDelta,
  PromptSpec,
  SessionHandle,
  SessionPlan,
  SessionSummary,
} from '../types.js'
import {
  availableWhenActive,
  distinctPhrases,
  itemAtCursor,
  itemFor,
  metaNumber,
  universalDelta,
  workedItems,
} from '../common.js'
import type { Difficulty, PhraseState } from '../../domain/phrase.js'
import type { UserPhraseId } from '../../domain/ids.js'
import { LadderRung, isActive, repsToday } from '../../domain/phrase.js'

export const REFRAIN_MODES = ['echo', 'chorus', 'speed', 'cloze', 'call', 'cold'] as const
export type RefrainMode = (typeof REFRAIN_MODES)[number]

/**
 * Everything one mode is, on one row.
 *
 * A mode is not four independent settings — it is one cognitive event defined by all four
 * at once: the rate it hears the model at (or doesn't), the beat it is paced by, how much
 * of the phrase is on screen, and what counts as having said it. Presentation copy is keyed
 * by the mode in the app. Read as a table, "what is Chorus?" is one row.
 */
interface RefrainModeSpec {
  /** Model-audio rate, or null when the mode deliberately withholds the model. */
  readonly modelRate: number | null
  readonly beatMs: number
  /** Takes the mask because only Cloze uses it; the rest ignore it. */
  readonly prompt: (clozeMask: readonly number[]) => PromptSpec
  readonly gate: GateSpec
}

/**
 * The progression. Cloze, Call, and Cold withhold the model and demand the WHOLE phrase —
 * that widening gap between what is given and what is asked for IS the Refrain.
 */
const MODE_SPEC: Record<RefrainMode, RefrainModeSpec> = {
  // Echo/Chorus/Speed shadow a model, so a partial match is enough.
  echo: {
    modelRate: 0.95,
    beatMs: 720,
    prompt: () => ({ show: 'full' }),
    gate: { kind: 'asr-partial', minTokens: 1 },
  },
  chorus: {
    modelRate: 0.95,
    beatMs: 720,
    prompt: () => ({ show: 'full' }),
    gate: { kind: 'asr-partial', minTokens: 1 },
  },
  speed: {
    modelRate: 1.15,
    // The faster beat is the only cue that Speed differs.
    beatMs: 340,
    prompt: () => ({ show: 'full' }),
    gate: { kind: 'asr-partial', minTokens: 1 },
  },
  // The production gate proper: generate it without the model.
  cloze: {
    modelRate: null,
    beatMs: 720,
    prompt: (clozeMask) => ({ show: 'cloze', clozeMask }),
    gate: { kind: 'asr-full' },
  },
  call: {
    modelRate: null,
    beatMs: 720,
    prompt: () => ({ show: 'meaning' }),
    gate: { kind: 'asr-full' },
  },
  cold: {
    modelRate: null,
    beatMs: 720,
    prompt: () => ({ show: 'nothing', hookOnly: true }),
    gate: { kind: 'asr-full' },
  },
}

/** Reps per phrase per day. Overlearning is deliberate — the target does NOT shorten. */
export const DEFAULT_REP_TARGET = 6

/** Distinct lock-in days before a phrase graduates out of rotation. */
export const LOCK_IN_DAYS_TO_GRADUATE = 4

/** Set size from the learner's daily-minutes answer. */
export function refrainSetSize(dailyMinutes: number): number {
  if (dailyMinutes <= 5) return 3
  if (dailyMinutes <= 10) return 5
  return 8
}

/** The mode for a rep index, clamped at the last. Reps past Cold stay Cold. */
export function modeForRep(repIndex: number): RefrainMode {
  const i = Math.min(Math.max(repIndex, 0), REFRAIN_MODES.length - 1)
  return REFRAIN_MODES[i] ?? 'cold'
}

/** Model-audio rate, or null when the mode deliberately withholds the model. */
export function modelRateForMode(mode: RefrainMode): number | null {
  return MODE_SPEC[mode].modelRate
}

/** Beat tempo. Speed mode's faster beat is the only cue that it differs. */
export function beatMsForMode(mode: RefrainMode): number {
  return MODE_SPEC[mode].beatMs
}

/** `min(100, round(reps / target * 100))`. Blueprint contract. */
export function automaticity(repsToday: number, target: number): number {
  if (target <= 0) return 0
  return Math.min(100, Math.round((repsToday / target) * 100))
}

/** The four warming bands. The card's colour IS the feedback signal. */
export type WarmBand = 'cold' | 'warm' | 'hot' | 'peak'

/** Presentation-neutral effort state. Mobile maps this key to localized copy. */
export type EffortState = 'ready' | WarmBand

/**
 * One ladder, read two ways.
 *
 * The band paints the card and the label says the same thing in words, so they are the
 * same rung of the same progression — 33 and 66 stated twice, five lines apart, is two
 * places for the boundaries to drift and a card that says "warming up" while glowing hot.
 * `cold` is the floor and so has no minimum.
 */
const WARM_BANDS = [
  { min: 100, band: 'peak' },
  { min: 66, band: 'hot' },
  { min: 33, band: 'warm' },
] as const satisfies readonly {
  readonly min: number
  readonly band: WarmBand
}[]

function bandFor(automaticityPct: number): WarmBand {
  return WARM_BANDS.find((candidate) => automaticityPct >= candidate.min)?.band ?? 'cold'
}

/**
 * The semantic effort state. Presentation maps the state to localized copy.
 */
export function effortState(reps: number, automaticityPct: number): EffortState {
  return reps === 0 ? 'ready' : bandFor(automaticityPct)
}

export function warmBand(automaticityPct: number): WarmBand {
  return bandFor(automaticityPct)
}

/**
 * Choose today's closed set, in priority order:
 *   1. Phrases mid-graduation (already in rotation, not yet at 4 lock-in days)
 *   2. Today's trip drop, when a trip is active
 *   3. Weakest — lowest automaticity, then hard-rated
 *   4. New material, to fill
 *
 * Persisted once per day by the caller and NEVER recomputed mid-day, so a learner
 * can always finish the set they were shown.
 */
export function selectRefrainSet(
  candidates: readonly PhraseState[],
  size: number,
  tripPhraseIds: readonly UserPhraseId[] = [],
): readonly UserPhraseId[] {
  const picked: UserPhraseId[] = []
  const seen = new Set<string>()
  const take = (p: PhraseState): void => {
    if (!seen.has(p.id) && picked.length < size) {
      seen.add(p.id)
      picked.push(p.id)
    }
  }

  // The selector is handed raw candidates by some callers, so it filters again rather than
  // trusting them — but through the one domain predicate, not a second copy of the rule.
  const eligible = candidates.filter(isActive)

  // 1 · unfinished business
  eligible
    .filter((p) => p.lockInDays > 0 && p.lockInDays < LOCK_IN_DAYS_TO_GRADUATE)
    .sort((a, b) => b.lockInDays - a.lockInDays || a.id.localeCompare(b.id))
    .forEach(take)

  // 2 · today's trip drop
  const trip = new Set(tripPhraseIds)
  eligible
    .filter((p) => trip.has(p.id))
    .sort((a, b) => a.id.localeCompare(b.id))
    .forEach(take)

  // 3 · weakest first
  eligible
    .filter((p) => p.reps > 0)
    .sort(
      (a, b) =>
        a.automaticity - b.automaticity ||
        difficultyWeight(b) - difficultyWeight(a) ||
        a.id.localeCompare(b.id),
    )
    .forEach(take)

  // 4 · new material
  eligible
    .filter((p) => p.reps === 0)
    .sort((a, b) => a.addedAt - b.addedAt || a.id.localeCompare(b.id))
    .forEach(take)

  return picked
}

/** How strongly a difficulty rating pulls a phrase forward when automaticity ties. */
const DIFFICULTY_WEIGHT: Record<Difficulty, number> = { hard: 2, med: 1, easy: 0 }

function difficultyWeight(p: PhraseState): number {
  return DIFFICULTY_WEIGHT[p.difficulty]
}

export class RefrainEngine implements PracticeEngine {
  readonly id = 'refrain' as const

  availability(ctx: EngineContext): Promise<Availability> {
    return availableWhenActive(ctx, 'no-phrases')
  }

  async plan(ctx: EngineContext): Promise<SessionPlan> {
    const active = await ctx.phrases.active()
    const size = ctx.settings.repTarget > 0 ? refrainSetSize(ctx.settings.dailyMinutes) : 0
    const setIds = selectRefrainSet(active, size, ctx.trip?.phraseIds ?? [])
    const byId = new Map(active.map((p) => [p.id, p]))
    const target = ctx.settings.repTarget || DEFAULT_REP_TARGET
    const today = ctx.clock.localDay()

    const items: PracticeItem[] = []
    for (const id of setIds) {
      const phrase = byId.get(id)
      if (phrase === undefined) continue
      const mask = ctx.core.clozeMask(id)
      // RESUME, don't restart. A phrase already at 4 of 6 reps today gets its remaining
      // two, at the modes that follow — so `repIndex` is the day's rep number and
      // `record()`'s absolute `repsToday` cannot walk the stored count backwards.
      // Read through the day guard, so yesterday's counter reads as zero.
      for (let rep = repsToday(phrase, today); rep < target; rep++) {
        const mode = modeForRep(rep)
        const spec = MODE_SPEC[mode]
        items.push({
          itemId: `${id}#${rep}`,
          phraseId: id,
          mode,
          prompt: spec.prompt(mask),
          gate: spec.gate,
          audio: spec.modelRate === null ? null : { rate: spec.modelRate, source: 'catalog' },
          meta: {
            repIndex: rep,
            repTarget: target,
            beatMs: spec.beatMs,
            automaticity: automaticity(rep, target),
            warmBand: warmBand(automaticity(rep, target)),
          },
        })
      }
    }

    return {
      engineId: this.id,
      items,
      estimatedMs: items.length * 9_000,
      // THE point of Loop B: a closed set you can see in full and finish.
      closed: true,
    }
  }

  next(session: SessionHandle): Promise<PracticeItem | null> {
    return itemAtCursor(session)
  }

  record(session: SessionHandle, attempt: Attempt): Promise<ProgressDelta> {
    const item = itemFor(session, attempt)
    const repIndex = metaNumber(item, 'repIndex', 0)
    const repTarget = metaNumber(item, 'repTarget', DEFAULT_REP_TARGET)
    const success = attempt.outcome === 'success'
    // Named for what it is, not shadowing the `repsToday` derivation imported above.
    const repsTodayAfter = repIndex + (success ? 1 : 0)
    const auto = automaticity(repsTodayAfter, repTarget)
    const mode = item.mode as RefrainMode

    // Rule 5: a Refrain rep is an implicit FSRS review even though this screen
    // never shows an interval. Produced hint-free at a later mode is a 'Good';
    // anything needing hints or a model is a 'Hard'.
    const grade: 1 | 2 | 3 | 4 = !success ? 1 : attempt.hintsUsed > 0 ? 2 : 3
    const srs = fsrsWriteFor(attempt, grade)

    // Rule 5 again: producing from a cue-free mode is evidence of Bent-level depth.
    const earnsBent = success && (mode === 'cloze' || mode === 'call') && attempt.hintsUsed === 0
    // Speed mode under 0.8s is genuine pressure-testing.
    const earnsPressure =
      success && mode === 'speed' && attempt.latencyMs !== null && attempt.latencyMs < 800

    return Promise.resolve({
      ...universalDelta(item, attempt, {
        reps: success ? 1 : 0,
        // MEASURED or null. Never derived from the rep index.
        latencyMs: attempt.latencyMs,
      }),
      repsToday: repsTodayAfter,
      automaticity: auto,
      lockedInToday: auto >= 100,
      ...(srs === undefined ? {} : { srs }),
      ...(earnsPressure
        ? { rung: LadderRung.PressureTested }
        : earnsBent
          ? { rung: LadderRung.Bent }
          : {}),
      ...(success ? {} : { stumbles: 1 }),
      axes: { production: success ? 2 : 0, recall: mode === 'cold' ? 6 : 2 },
    })
  }

  async summarize(session: SessionHandle): Promise<SessionSummary> {
    const done = workedItems(session)
    const unique = distinctPhrases(done)
    const produced = done.filter((i) => i.gate.kind === 'asr-full').length
    return Promise.resolve({
      engineId: this.id,
      phrasesTouched: unique,
      phrasesProduced: produced,
      durationMs: done.length * 9_000,
      extra: { repsToday: done.length, setSize: unique },
    })
  }
}

/**
 * Derive the FSRS write for a rep.
 *
 * Kept as a seam so the mapping lives in ONE place and can be reviewed against
 * calibration data — the implicit-grade mappings are a judgement call, not a proof.
 * See docs/architecture/scheduling.md#grade-mapping
 *
 * ⚠️ This duplicates `LoroCoreFacade.fsrsReview`, which `record()` cannot reach: the
 * `PracticeEngine` contract passes a session and an attempt, not the `EngineContext` that
 * carries the injected core. Every engine therefore has to hand-roll FSRS, which is the
 * cross-platform divergence ADR-0002 exists to prevent. Tracked in
 * plans/05-fix-shared-maths-duplication.md; fixing it needs a contract change.
 */
function fsrsWriteFor(attempt: Attempt, grade: 1 | 2 | 3 | 4): ProgressDelta['srs'] {
  // A skipped rep is not a review.
  if (attempt.outcome === 'skipped') return undefined
  // Placeholder scheduling until loro-core's FSRS lands (M0). The SHAPE is correct —
  // a real interval derived from the grade — and the conformance suite asserts that
  // every engine produces one.
  const days = grade === 1 ? 0.007 : grade === 2 ? 1 : grade === 3 ? 3 : 5
  return {
    stability: days,
    difficulty: 5,
    due: attempt.at + days * 86_400_000,
  }
}
