/**
 * The phrase — the atom of the entire product.
 *
 * The CATALOG is immutable, versioned, shared content. LEARNER STATE is private,
 * synced, and per-user. They join on `phraseId` and are never merged into one type.
 */

import type { TargetLocale, NativeLanguage } from './languages.js'
import type { CatalogPhraseId, UserPhraseId } from './ids.js'

/**
 * The maximum persisted length for learner-authored phrase text and meanings, measured in
 * JavaScript UTF-16 code units. API schemas and every local input path share this limit.
 */
export const MAX_OWN_PHRASE_TEXT_CODE_UNITS = 2_000

// ─────────────────────────────────────────────────────────────────────────────
// The learner's two signals — the connective thread
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The learner's declaration of how hard a phrase is FOR THEM.
 * Note the labels: 'med' shows as "Learning" (a status, not a rating) and
 * 'hard' shows as "Difficult" (describing the phrase, not the learner).
 */
export type Difficulty = 'easy' | 'med' | 'hard'

/**
 * "What's tricky about it?" — about the NATURE of the difficulty, never its magnitude.
 * Magnitude is Difficulty's job. This separation is what lets the same "Difficult"
 * rating route to completely different drills.
 */
export type Tag =
  /** The sounds are the problem → say-it-out-loud cards, prosody priority */
  | 'pron'
  /** The meaning won't stick → surface the memory hook */
  | 'remember'
  /** "I will definitely need this" → retention priority, seeds scenes and survival decks */
  | 'useful'
  /** Specific lexical items trip me up → word-by-word drilling, cloze targeting */
  | 'words'

/** Stream repeat counts, from the blueprint (Loro.dc.html:2526). A contract, not a display model. */
export const REPEAT_TARGET: Record<Difficulty, number> = { hard: 4, med: 3, easy: 2 }

// ─────────────────────────────────────────────────────────────────────────────
// Progress models — three independent axes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The five-rung ladder: a permanent measure of DEPTH per phrase.
 * Loop C's model, but maintained from v1 by every engine so the Phrasebook
 * isn't empty on its first day. Monotonic — "you only climb or hold."
 */
export enum LadderRung {
  /** Recognise and repeat it */
  Accumulated = 0,
  /** Change its form — question, past tense, negation */
  Bent = 1,
  /** Use it in a context it wasn't taught in */
  Transferred = 2,
  /** Produce it fast, distracted, or under social pressure */
  PressureTested = 3,
  /** Use it spontaneously, unprompted, for real */
  Deployed = 4,
}

export type Theme =
  | 'Café'
  | 'Dining'
  | 'Travel'
  | 'Directions'
  | 'Shopping'
  | 'Small talk'
  | 'Survival'
  | 'Hotel'
  // Synthetic themes for learner-originated phrases
  | 'Imported'
  | 'Mine'
  | 'Captured'

/** Catalog themes exposed by Browse. Learner-originated synthetic themes are excluded. */
export const BROWSABLE_THEMES = [
  'Café',
  'Dining',
  'Travel',
  'Directions',
  'Shopping',
  'Small talk',
  'Survival',
  'Hotel',
] as const satisfies readonly Theme[]

export type BrowsableTheme = (typeof BROWSABLE_THEMES)[number]

export type Register = 'neutral' | 'casual' | 'formal'
export type Cefr = 'A1' | 'A2' | 'B1' | 'B2'

export const PHRASE_SOURCES = [
  'starter',
  'discover',
  'scenario',
  'browse',
  'custom',
  'import',
  'capture',
  'related',
  'drop',
  'chat',
  'generated',
] as const

export type PhraseSource = (typeof PHRASE_SOURCES)[number]

// ─────────────────────────────────────────────────────────────────────────────
// Catalog — immutable, shipped, never written by the app
// ─────────────────────────────────────────────────────────────────────────────

export interface WordGloss {
  readonly targetText: string
  readonly gloss: string
  /** What TTS should speak when `targetText` is a fragment: '¿Dón' → 'dónde'. Loro.dc.html:2483 */
  readonly say?: string
}

export interface Syllable {
  readonly t: string
  /** 0..1 */
  readonly stress: number
  /** Relative duration weight */
  readonly dur: number
}

export interface PhraseTeaching {
  readonly resp?: string
  readonly words?: readonly WordGloss[]
  readonly example?: { readonly targetText: string; readonly translation: string }
  readonly hint?: string
  readonly note?: string
}

export interface CatalogPhrase {
  readonly id: CatalogPhraseId
  readonly targetLocale: TargetLocale
  readonly targetText: string
  /** Idiomatic meanings keyed by the learner's native language. */
  readonly translations: Partial<Record<NativeLanguage, string>>
  readonly theme: Theme
  readonly emoji: string

  /** IPA is target-specific; respelling and coaching are native/target-pair-specific. */
  readonly respIpa?: string
  readonly teaching?: Partial<Record<NativeLanguage, PhraseTeaching>>
  readonly register?: Register
  readonly cefr?: Cefr

  readonly audio?: { readonly uri: string; readonly sha256: string; readonly ms: number }
  /** 14-point normalised native pitch contour — what the prosody chart draws. */
  readonly f0Native?: readonly number[]
  readonly syl?: readonly Syllable[]

  readonly deprecatedBy?: CatalogPhraseId
  readonly catalogVersion: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Learner state — private, synced, per-user
// ─────────────────────────────────────────────────────────────────────────────

/** Versioned canonical policy; Rust owns the implementation and matching wire identifier. */
export const FSRS_ALGORITHM = 'fsrs-6-default-c8ca282-loro-v1'
/** Known persisted 90% preview policy, retained without discarding real memory evidence. */
export const LEGACY_PREVIEW_ALGORITHM = 'fsrs-6/py-fsrs-6.3.2/default-90-no-steps'

export interface FsrsState {
  readonly stability: number
  readonly difficulty: number
  readonly due: number
  readonly lastReview: number | null
  readonly lapses: number
  readonly state: 'new' | 'learning' | 'review' | 'relearning'
  /** Absent only on older preview wire records; persistence retains explicit provenance. */
  readonly algorithm?: string
}

export interface PhraseState {
  /** Legacy rows belong to the original English → Spanish course. */
  targetLocale?: TargetLocale
  ownMeaningLanguage?: NativeLanguage
  readonly id: UserPhraseId
  /** Null for learner-authored phrases. */
  readonly phraseId: CatalogPhraseId | null
  readonly ownEs?: string
  readonly ownEn?: string
  readonly ownTheme?: Theme
  readonly ownEmoji?: string
  readonly source: PhraseSource

  // ── the learner's signals ──
  readonly difficulty: Difficulty
  readonly tags: readonly Tag[]
  readonly loved: boolean
  readonly learned: boolean
  readonly note: string | null

  // ── universal progress ──
  readonly plays: number
  readonly reps: number
  readonly addedAt: number
  readonly lastPracticedAt: number | null
  readonly graduatedAt: number | null

  /** Maintained by EVERY engine, even those that never show an interval. Rule 5. */
  readonly srs: FsrsState | null

  // ── Loop B ──
  readonly repsToday: number
  /**
   * The local_day the counter belongs to. Reading `repsToday` without checking
   * this against today is a bug — the repository returns 0 on mismatch.
   */
  readonly repsTodayDay: string | null
  readonly automaticity: number
  /** Distinct days locked in; 4 → graduated. */
  readonly lockInDays: number

  // ── Loop C, maintained from v1 ──
  readonly rung: LadderRung
  readonly stumbles: number

  // ── prosody ──
  readonly cueLevel: number
  readonly axPerception: number
  readonly axRecall: number
  readonly axProduction: number
}

/** Catalog + learner state, joined. What a screen actually renders. */
export interface PhraseView extends PhraseState {
  readonly targetText: string
  readonly translation: string
  readonly theme: Theme
  readonly emoji: string
  readonly catalog: CatalogPhrase | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Derivations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ELIGIBILITY — whether a row may be planned with: neither marked learned by the learner nor
 * graduated by the app. Either one takes the row out of rotation, and a row can have one without
 * the other, so both have to be asked. A tombstoned row never reaches here: a `PhraseState` has
 * no `deletedAt`.
 */
export function isActive(p: Pick<PhraseState, 'learned' | 'graduatedAt'>): boolean {
  return !p.learned && p.graduatedAt === null
}

/**
 * Today's rep count, guarded against a stale counter.
 * A stale `repsToday` could otherwise inflate automaticity.
 */
export function repsToday(
  p: Pick<PhraseState, 'repsToday' | 'repsTodayDay'>,
  localDay: string,
): number {
  return p.repsTodayDay === localDay ? p.repsToday : 0
}
