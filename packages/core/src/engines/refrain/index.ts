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
import type { PhraseState } from '../../domain/phrase.js'
import type { UserPhraseId } from '../../domain/ids.js'
import { LadderRung, repsToday } from '../../domain/phrase.js'

export const REFRAIN_MODES = ['echo', 'chorus', 'speed', 'cloze', 'call', 'cold'] as const
export type RefrainMode = (typeof REFRAIN_MODES)[number]

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
  switch (mode) {
    case 'echo':
    case 'chorus':
      return 0.95
    case 'speed':
      return 1.15
    // Cloze, Call, and Cold withhold the model. That IS the progression.
    case 'cloze':
    case 'call':
    case 'cold':
      return null
  }
}

/** Beat tempo. Speed mode's faster beat is the only cue that it differs. */
export function beatMsForMode(mode: RefrainMode): number {
  return mode === 'speed' ? 340 : 720
}

/** The mic label per mode. */
export function micLabelForMode(mode: RefrainMode): string {
  return {
    echo: 'Say it',
    chorus: 'Chorus it',
    speed: 'Faster!',
    cloze: 'Fill & say',
    call: 'Respond',
    cold: 'Say it cold',
  }[mode]
}

/** `min(100, round(reps / target * 100))`. Blueprint contract. */
export function automaticity(repsToday: number, target: number): number {
  if (target <= 0) return 0
  return Math.min(100, Math.round((repsToday / target) * 100))
}

/**
 * The plain-language effort label. The progression matters more than the individual
 * strings — it ships as a group for translation.
 */
export function effortLabel(reps: number, automaticityPct: number): string {
  if (reps === 0) return 'tap to begin'
  if (automaticityPct >= 100) return 'instant & smooth'
  if (automaticityPct >= 66) return 'quick & smooth'
  if (automaticityPct >= 33) return 'getting smoother'
  return 'warming up'
}

/** The four warming bands. The card's colour IS the feedback signal. */
export type WarmBand = 'cold' | 'warm' | 'hot' | 'peak'
export function warmBand(automaticityPct: number): WarmBand {
  if (automaticityPct >= 100) return 'peak'
  if (automaticityPct >= 66) return 'hot'
  if (automaticityPct >= 33) return 'warm'
  return 'cold'
}

function promptForMode(mode: RefrainMode, clozeMask: readonly number[]): PromptSpec {
  switch (mode) {
    case 'echo':
    case 'chorus':
    case 'speed':
      return { show: 'full' }
    case 'cloze':
      return { show: 'cloze', clozeMask }
    case 'call':
      return { show: 'meaning' }
    case 'cold':
      return { show: 'nothing', hookOnly: true }
  }
}

function gateForMode(mode: RefrainMode): GateSpec {
  switch (mode) {
    // Echo/Chorus/Speed shadow a model, so a partial match is enough.
    case 'echo':
    case 'chorus':
    case 'speed':
      return { kind: 'asr-partial', minTokens: 1 }
    // The production gate proper: generate it without the model.
    case 'cloze':
    case 'call':
    case 'cold':
      return { kind: 'asr-full' }
  }
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

  const eligible = candidates.filter((p) => !p.learned && p.graduatedAt === null)

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

function difficultyWeight(p: PhraseState): number {
  return p.difficulty === 'hard' ? 2 : p.difficulty === 'med' ? 1 : 0
}

export class RefrainEngine implements PracticeEngine {
  readonly id = 'refrain' as const

  async availability(ctx: EngineContext): Promise<Availability> {
    const active = await ctx.phrases.active()
    return active.length === 0
      ? { state: 'unavailable', reason: 'no-phrases' }
      : { state: 'available' }
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
        const rate = modelRateForMode(mode)
        items.push({
          itemId: `${id}#${rep}`,
          phraseId: id,
          mode,
          prompt: promptForMode(mode, mask),
          gate: gateForMode(mode),
          audio: rate === null ? null : { rate, source: 'catalog' },
          meta: {
            repIndex: rep,
            repTarget: target,
            beatMs: beatMsForMode(mode),
            micLabel: micLabelForMode(mode),
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
    return Promise.resolve(session.plan.items[session.cursor] ?? null)
  }

  record(session: SessionHandle, attempt: Attempt): Promise<ProgressDelta> {
    const item = session.plan.items.find((i) => i.itemId === attempt.itemId)
    if (item === undefined) throw new Error(`unknown item ${attempt.itemId}`)

    const repIndex = Number(item.meta.repIndex ?? 0)
    const repTarget = Number(item.meta.repTarget ?? DEFAULT_REP_TARGET)
    const success = attempt.outcome === 'success'
    const repsToday = repIndex + (success ? 1 : 0)
    const auto = automaticity(repsToday, repTarget)
    const mode = item.mode as RefrainMode

    // Rule 5: a Refrain rep is an implicit FSRS review even though this screen
    // never shows an interval. Produced hint-free at a later mode is a 'Good';
    // anything needing hints or a model is a 'Hard'.
    const grade: 1 | 2 | 3 | 4 = !success ? 1 : attempt.hintsUsed > 0 ? 2 : 3
    const srs = ctx_srs(session, attempt, grade)

    // Rule 5 again: producing from a cue-free mode is evidence of Bent-level depth.
    const earnsBent = success && (mode === 'cloze' || mode === 'call') && attempt.hintsUsed === 0
    // Speed mode under 0.8s is genuine pressure-testing.
    const earnsPressure =
      success && mode === 'speed' && attempt.latencyMs !== null && attempt.latencyMs < 800

    return Promise.resolve({
      phraseId: item.phraseId,
      reps: success ? 1 : 0,
      lastPracticedAt: attempt.at,
      repsToday,
      automaticity: auto,
      lockedInToday: auto >= 100,
      // MEASURED or null. Never derived from the rep index.
      latencySampleMs: attempt.latencyMs,
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
    const done = session.plan.items.slice(0, session.cursor)
    const unique = new Set(done.map((i) => i.phraseId))
    const produced = done.filter((i) => i.gate.kind === 'asr-full').length
    return Promise.resolve({
      engineId: this.id,
      phrasesTouched: unique.size,
      phrasesProduced: produced,
      durationMs: done.length * 9_000,
      extra: { repsToday: done.length, setSize: unique.size },
    })
  }
}

/**
 * Derive the FSRS write for a rep.
 *
 * Kept as a seam so the mapping lives in ONE place and can be reviewed against
 * calibration data — the implicit-grade mappings are a judgement call, not a proof.
 * See docs/architecture/scheduling.md#grade-mapping
 */
function ctx_srs(
  _session: SessionHandle,
  attempt: Attempt,
  grade: 1 | 2 | 3 | 4,
): ProgressDelta['srs'] {
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
