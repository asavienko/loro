/** Typed transport adapter. Every result is computed by the loaded canonical Rust core. */
import {
  isActive,
  isDue,
  userPhraseId,
  type Difficulty,
  type FsrsState,
  type LoroCoreFacade,
  type PhraseState,
  type Tag,
} from '@loro/core'
import { getCore } from '../core/loader'

const DIFFICULTY: Record<Difficulty, string> = { hard: 'Hard', med: 'Med', easy: 'Easy' }
const TAG: Record<Tag, string> = {
  pron: 'Pron',
  remember: 'Remember',
  useful: 'Useful',
  words: 'Words',
}
const MODES = {
  echo: 'Echo',
  chorus: 'Chorus',
  speed: 'Speed',
  cloze: 'Cloze',
  call: 'Call',
  cold: 'Cold',
} as const
const SELF_GRADES = { again: 'Again', hard: 'Hard', good: 'Good', easy: 'Easy' } as const
const CONFIDENCE = {
  forgot: 'Forgot',
  shaky: 'Shaky',
  ok: 'Ok',
  strong: 'Strong',
  instant: 'Instant',
} as const
const GRADES = { 1: 'Again', 2: 'Hard', 3: 'Good', 4: 'Easy' } as const
const RUNGS = ['Accumulated', 'Bent', 'Transferred', 'PressureTested', 'Deployed'] as const

type WireSrs = Omit<FsrsState, 'lastReview' | 'algorithm'> & {
  last_review: number | null
  algorithm: string
}

// The compiled core validates requests; operation-specific result types live at this boundary.
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
function call<T>(request: object): T {
  validateNumbers(request)
  return getCore().coreCall(request) as T
}

/** JSON must not turn non-finite optional values into meaningful nulls. */
function validateNumbers(value: unknown): void {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value))) {
      throw new Error('Unsafe canonical numeric input')
    }
  } else if (Array.isArray(value)) {
    value.forEach(validateNumbers)
  } else if (value !== null && typeof value === 'object') {
    Object.values(value).forEach(validateNumbers)
  }
}

function wireMode(mode: string): string {
  if (!Object.hasOwn(MODES, mode)) throw new Error('Unknown canonical practice mode')
  return MODES[mode as keyof typeof MODES]
}

function wirePhrase(p: PhraseState, now: number): object {
  return {
    id: p.id,
    difficulty: DIFFICULTY[p.difficulty],
    tags: p.tags.map((tag) => TAG[tag]),
    loved: p.loved,
    learned: p.learned,
    plays: p.plays,
    reps: p.reps,
    last_practiced_at: p.lastPracticedAt,
    srs_due: isDue(p, now) ? p.srs?.due : null,
    srs_stability: p.srs?.stability ?? null,
    srs_difficulty: p.srs?.difficulty ?? null,
    reps_today: p.repsToday,
    reps_today_day: p.repsTodayDay,
    lock_in_days: p.lockInDays,
    rung: RUNGS[p.rung],
    stumbles: p.stumbles,
    cue_level: p.cueLevel,
  }
}

export const canonicalCoreFacade: LoroCoreFacade = {
  orderStream: (phrases, now) =>
    call<string[]>({
      op: 'order_stream',
      phrases: phrases.filter(isActive).map((p) => wirePhrase(p, now)),
      now_ms: now,
    }).map(userPhraseId),
  repeatTarget: (difficulty) => call({ op: 'repeat_target', difficulty: DIFFICULTY[difficulty] }),
  streamRank: (p, now) => call({ op: 'stream_rank', phrase: wirePhrase(p, now), now_ms: now }),
  clozeMask: (tokens, targetLocale, eligibleIndices) =>
    call({
      op: 'cloze_mask',
      tokens,
      target_locale: targetLocale,
      eligible_indices: eligibleIndices,
    }),
  automaticity: (reps, target) => call({ op: 'automaticity', reps_today: reps, target }),
  refrainSetSize: (dailyMinutes) => call({ op: 'refrain_set_size', daily_minutes: dailyMinutes }),
  selectRefrainSet: (candidates, size, tripIds = []) => {
    const trip = new Set(tripIds)
    return call<string[]>({
      op: 'select_refrain_set',
      size,
      candidates: candidates.map((p) => ({
        id: p.id,
        eligible: isActive(p),
        lock_in_days: p.lockInDays,
        trip: trip.has(p.id),
        reps: p.reps,
        automaticity: p.automaticity,
        difficulty: DIFFICULTY[p.difficulty],
        added_at: p.addedAt,
      })),
    }).map(userPhraseId)
  },
  modeForRep: (index) =>
    call<string>({ op: 'mode_for_rep', rep_index: index }).toLowerCase() as ReturnType<
      LoroCoreFacade['modeForRep']
    >,
  modelRateForMode: (mode) => call({ op: 'model_rate_for_mode', mode: wireMode(mode) }),
  beatMsForMode: (mode) => call({ op: 'beat_ms_for_mode', mode: wireMode(mode) }),
  rerate: (phrase, difficulty) => {
    const prior = phrase.srs
    if (prior?.algorithm === undefined) return prior
    const { lastReview, ...rest } = prior
    const { last_review: nextLastReview, ...result } = call<WireSrs>({
      op: 'fsrs_rerate',
      state: { ...rest, last_review: lastReview },
      declared: DIFFICULTY[difficulty],
      tags: phrase.tags.map((tag) => TAG[tag]),
    })
    return { ...result, lastReview: nextLastReview }
  },
  reviewGrade: (attempt) =>
    call({
      op: 'review_grade',
      success: attempt.outcome === 'success',
      hints_used: attempt.hintsUsed,
      self_grade: attempt.selfGrade ? SELF_GRADES[attempt.selfGrade] : null,
      confidence: attempt.confidence ? CONFIDENCE[attempt.confidence] : null,
    }),
  fsrsReview: (phrase, grade, at, confidence) => {
    // The core owns the provenance identifier. Legacy schedules are invalidated, without
    // inventing a review history or discarding observed phrase progress.
    const initialized = call<WireSrs>({
      op: 'fsrs_initialize',
      declared: DIFFICULTY[phrase.difficulty],
      tags: phrase.tags.map((tag) => TAG[tag]),
      at_ms: at,
    })
    const prior = phrase.srs
    if (prior?.algorithm !== undefined && prior.algorithm !== initialized.algorithm) {
      throw new Error('Unsupported scheduler algorithm')
    }
    const state: WireSrs =
      prior?.algorithm === initialized.algorithm
        ? {
            stability: prior.stability,
            difficulty: prior.difficulty,
            due: prior.due,
            last_review: prior.lastReview,
            lapses: prior.lapses,
            state: prior.state,
            algorithm: prior.algorithm,
          }
        : initialized
    const { last_review: lastReview, ...result } = call<WireSrs>({
      ...(confidence
        ? { op: 'fsrs_review_confidence', confidence: CONFIDENCE[confidence] }
        : { op: 'fsrs_review', grade: GRADES[grade] }),
      state,
      at_ms: at,
    })
    return { ...result, lastReview }
  },
  matchTokens: (heard, target, revealed) => {
    const result = call<{ revealed: number; just_index: number; complete: boolean }>({
      op: 'match_tokens',
      heard,
      target,
      revealed,
      fuzzy: false,
    })
    return { revealed: result.revealed, justIndex: result.just_index, complete: result.complete }
  },
}
