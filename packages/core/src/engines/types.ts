/**
 * The PracticeEngine contract.
 *
 * The blueprint ships three complete, mutually exclusive philosophies of daily
 * practice and deliberately declines to choose between them. They differ in exactly
 * three ways — selection, sequencing, and evaluation — which is precisely the surface
 * a strategy interface should abstract.
 *
 * See docs/architecture/practice-engines.md and ADR-0006.
 */

import type { Difficulty, LadderRung, PhraseState } from '../domain/phrase.js'
import type { UserPhraseId } from '../domain/ids.js'

export type EngineId =
  'stream' | 'refrain' | 'speak' | 'srs' | 'prosody' | 'pronunciation' | 'roleplay' | 'run'

// ─────────────────────────────────────────────────────────────────────────────
// What the engine hands the UI
// ─────────────────────────────────────────────────────────────────────────────

export interface PromptSpec {
  readonly show: 'full' | 'cloze' | 'meaning' | 'nothing'
  /** Token indices to blank. Chosen by loro-core::cloze_mask — content words, never articles. */
  readonly clozeMask?: readonly number[]
  readonly hookOnly?: boolean
}

export type GateSpec =
  /** No gate — passive playback. */
  | { readonly kind: 'listen' }
  /** The learner grades themselves. */
  | { readonly kind: 'self-report' }
  /** The WHOLE phrase must be produced. The production gate. */
  | { readonly kind: 'asr-full' }
  | { readonly kind: 'asr-partial'; readonly minTokens: number }
  /** A DSP score threshold. */
  | { readonly kind: 'score'; readonly minScore: number }
  /** Acknowledge and move on. */
  | { readonly kind: 'tap' }

export interface AudioSpec {
  readonly rate: number
  readonly source: 'catalog' | 'device-tts'
}

export interface PracticeItem {
  readonly itemId: string
  readonly phraseId: UserPhraseId
  /** Engine-specific: 'echo' | 'cloze' | 'recall' | 'pressure-2' | … */
  readonly mode: string
  readonly prompt: PromptSpec
  readonly gate: GateSpec
  readonly audio: AudioSpec | null
  /** Engine-specific payload the feature layer renders (cue level, beat copy, …). */
  readonly meta: Readonly<Record<string, unknown>>
}

export interface SessionPlan {
  readonly engineId: EngineId
  /** May be partial — engines can stream. */
  readonly items: readonly PracticeItem[]
  readonly estimatedMs: number
  /** true = finite and finishable (Refrain, Run). "You always see today." */
  readonly closed: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// What the learner did
// ─────────────────────────────────────────────────────────────────────────────

export interface ScoreBreakdown {
  readonly overall: number
  readonly syllables?: readonly number[]
  readonly contour?: readonly number[]
  readonly worstSyllableIndex?: number
  readonly fixCode?: string
}

export interface Attempt {
  readonly itemId: string
  readonly outcome: 'success' | 'partial' | 'skipped' | 'failed'
  /**
   * MEASURED, or null. Never estimated.
   * `null` is a first-class value: the UI hides the read-out rather than
   * substituting a plausible number. See docs/architecture/audio-speech.md
   */
  readonly latencyMs: number | null
  readonly transcript?: string
  readonly score?: ScoreBreakdown
  readonly selfGrade?: 'again' | 'hard' | 'good' | 'easy'
  readonly confidence?: 'forgot' | 'shaky' | 'ok' | 'strong' | 'instant'
  readonly hintsUsed: number
  readonly at: number
}

// ─────────────────────────────────────────────────────────────────────────────
// What the engine writes back — where rule 5 lives
// ─────────────────────────────────────────────────────────────────────────────

/**
 * RULE 5: every engine returns deltas for every signal it can legitimately update,
 * INCLUDING signals it does not display.
 *
 * A learner practising only in the Refrain still accrues FSRS state and ladder rungs.
 * That's what makes engine switching lossless and the loop experiment interpretable.
 * Enforced by the conformance suite, not by convention.
 *
 * ── Increment, absolute, or monotonic ──
 * Not every field means the same kind of thing, and a writer that gets this wrong
 * corrupts progress silently. Each field below says which it is. The three shapes:
 *
 *   • INCREMENT — add to the stored value (`reps: 1` means "one more rep"). Absent
 *     means zero. The conformance suite accumulates these across a phrase's work.
 *   • ABSOLUTE  — replace the stored value. Absent means "unchanged".
 *   • MONOTONIC — take the max of stored and new; the value may never fall.
 *
 * The store's `applyDelta` is the only place these rules are implemented, so this
 * comment and that function are the pair to read together.
 */
export interface ProgressDelta {
  readonly phraseId: UserPhraseId

  // Universal — every engine updates these.
  /** INCREMENT. */
  readonly reps?: number
  /** INCREMENT. */
  readonly plays?: number
  /** ABSOLUTE. */
  readonly lastPracticedAt?: number
  /**
   * ABSOLUTE, and MEASURED or null — never estimated. `null` is a real value meaning
   * "onset was not detected", and the UI hides the read-out rather than substituting.
   */
  readonly latencySampleMs?: number | null

  // FSRS — maintained even by engines that never show an interval.
  /** ABSOLUTE, and merged as a GROUP: taking `due` from one device and `stability` from
   * another would produce a scheduling state no algorithm ever computed. */
  readonly srs?: {
    readonly stability: number
    readonly difficulty: number
    readonly due: number
    readonly lastReview?: number | null
    readonly lapses?: number
    readonly state?: 'new' | 'learning' | 'review' | 'relearning'
  }

  // Loop B.
  /**
   * ABSOLUTE, and day-scoped: it is the count for the engine's current local day, so a
   * writer must stamp `repsTodayDay` alongside it. An engine plans from the reps already
   * done today, which is what makes a resumed session continue rather than restart.
   */
  readonly repsToday?: number
  /** ABSOLUTE. `min(100, round(repsToday / target × 100))`. */
  readonly automaticity?: number
  /**
   * A FLAG, not a counter: "this phrase reached 100% today". The store turns it into
   * `lockInDays`, which counts DISTINCT days, so it must be idempotent within a day.
   */
  readonly lockedInToday?: boolean

  // Loop C — maintained from v1 so the Phrasebook isn't empty on day one.
  /** MONOTONIC — "you only climb or hold". */
  readonly rung?: LadderRung
  /** INCREMENT. */
  readonly stumbles?: number
  /** A FLAG: Loop C staleness was reset by this attempt. */
  readonly staleReset?: boolean

  // Prosody.
  /** MONOTONIC — a cue level never decreases. */
  readonly cueLevel?: number
  /**
   * INCREMENTS, clamped to 0…100.
   *
   * NOTE: until the DSP lands (plans/19, plans/27) the engines supply a fixed
   * progression here rather than a score derived from real signal processing. Nothing
   * displays these yet, and nothing may display them until they are real — see
   * non-negotiable #2.
   */
  readonly axes?: {
    readonly perception?: number
    readonly recall?: number
    readonly production?: number
  }

  // Learner-facing flags an engine may set.
  /** ABSOLUTE. */
  readonly difficulty?: Difficulty
  /** ABSOLUTE. */
  readonly learned?: boolean
}

/** One writable progress signal. `phraseId` is the address, not a signal. */
export type ProgressSignal = Exclude<keyof ProgressDelta, 'phraseId'>

/**
 * Every signal, enumerable at runtime — the list `conformance.ts` walks so that each
 * engine must classify each one as maintained or exempt.
 *
 * This is `FIELD_POLICY`'s trick applied to rule 5. Declaring a signal on `ProgressDelta`
 * is a promise that some engine keeps it; without a list to walk, adding a sixteenth is
 * silent, and it stays unwritten by anything until someone happens to count. That is how
 * `cueLevel` came to be declared and maintained by nobody.
 */
export const PROGRESS_SIGNALS = [
  'reps',
  'plays',
  'lastPracticedAt',
  'latencySampleMs',
  'srs',
  'repsToday',
  'automaticity',
  'lockedInToday',
  'rung',
  'stumbles',
  'staleReset',
  'cueLevel',
  'axes',
  'difficulty',
  'learned',
] as const satisfies readonly ProgressSignal[]

type MustBeNever<T extends never> = T
/**
 * Compile error the moment a signal is added to `ProgressDelta` without being listed
 * above — `satisfies` alone proves the list is sound, not that it is complete.
 */
export type AllProgressSignalsListed = MustBeNever<
  Exclude<ProgressSignal, (typeof PROGRESS_SIGNALS)[number]>
>

// ─────────────────────────────────────────────────────────────────────────────
// Context and the engine itself
// ─────────────────────────────────────────────────────────────────────────────

export interface Clock {
  now(): number
  /** The device's LOCAL calendar date, 'YYYY-MM-DD'. Drives day boundaries offline. */
  localDay(): string
  /**
   * The day this instant counts for in a STREAK — `localDay()` plus a four-hour grace
   * window, so practising at 01:30 extends yesterday rather than starting a new day.
   *
   * Deliberately not the same key as `localDay()`: the Refrain's frozen set must roll
   * at midnight (a learner mid-ritual cannot have today's set change under them) while
   * a streak must not. Two keys, two reasons.
   * See docs/architecture/scheduling.md#day-boundaries
   */
  streakDay(): string
}

export interface PhraseRepository {
  all(): Promise<readonly PhraseState[]>
  byId(id: UserPhraseId): Promise<PhraseState | null>
  active(): Promise<readonly PhraseState[]>
  due(at: number): Promise<readonly PhraseState[]>
}

export interface PracticeSettings {
  readonly dailyMinutes: 5 | 10 | 20
  readonly waveTimes: readonly string[]
  readonly repTarget: number
}

export interface TripContext {
  readonly state: 'planning' | 'countdown' | 'abroad' | 'completed'
  readonly arrivalDate: string
  readonly phraseIds: readonly UserPhraseId[]
}

export interface EngineContext {
  readonly phrases: PhraseRepository
  /** Injected — no engine calls Date.now(). */
  readonly clock: Clock
  /** loro-core: FSRS, ranking, selection, scoring. */
  readonly core: LoroCoreFacade
  readonly settings: PracticeSettings
  readonly trip: TripContext | null
  readonly flags: { bool(k: string, d: boolean): boolean; number(k: string, d: number): number }
  /** Injected — no engine calls Math.random(). */
  readonly seed: number
  /** Persisted ordered membership for today; even an empty frozen set is authoritative. */
  readonly refrainSet?: readonly UserPhraseId[]
}

/**
 * The subset of loro-core an engine may use.
 *
 * Injected rather than imported, so engines stay pure and testable without the
 * native binding. See docs/architecture/adr/0002-shared-rust-core.md
 */
export interface LoroCoreFacade {
  streamRank(p: PhraseState, now: number): number
  repeatTarget(d: Difficulty): number
  /** Token indices to blank. Content words only, never articles or prepositions. */
  clozeMask(phrase: PhraseState): readonly number[]
  selectRefrainSet(
    candidates: readonly PhraseState[],
    size: number,
    tripPhraseIds?: readonly UserPhraseId[],
  ): readonly UserPhraseId[]
  fsrsReview(state: PhraseState, grade: 1 | 2 | 3 | 4, at: number): ProgressDelta['srs']
  matchTokens(
    heard: readonly string[],
    target: readonly string[],
    revealed: number,
  ): { revealed: number; justIndex: number; complete: boolean }
}

export interface SessionHandle {
  readonly sessionId: string
  readonly plan: SessionPlan
  readonly cursor: number
}

export interface SessionSummary {
  readonly engineId: EngineId
  readonly phrasesTouched: number
  readonly phrasesProduced: number
  readonly durationMs: number
  readonly extra: Readonly<Record<string, unknown>>
}

export type Availability =
  | { readonly state: 'available' }
  | { readonly state: 'degraded'; readonly reason: string }
  | { readonly state: 'unavailable'; readonly reason: string }

export interface PracticeEngine {
  readonly id: EngineId

  /** Usable right now? (content available, permissions, flags) */
  availability(ctx: EngineContext): Promise<Availability>

  /** Build today's work. MUST NOT mutate the store. */
  plan(ctx: EngineContext): Promise<SessionPlan>

  /** The next item, or null when complete. */
  next(session: SessionHandle): Promise<PracticeItem | null>

  /** Record an attempt; return the deltas to persist. See ProgressDelta / rule 5. */
  record(session: SessionHandle, attempt: Attempt, ctx?: EngineContext): Promise<ProgressDelta>

  summarize(session: SessionHandle): Promise<SessionSummary>
}
