/** Typed engine adapters over the same Rust code used by the API and native bindings. */
import {
  isActive,
  LEGACY_PREVIEW_ALGORITHM,
  userPhraseId,
  type FsrsState,
  type LoroCoreFacade,
} from '@loro/core'
import { loadLearningCatalog, targetForPhraseId } from '@loro/content'
import { coreCall } from '../lib/core'

interface ReviewedState {
  readonly stability: number
  readonly difficulty: number
  readonly due: number
  readonly last_review: number | null
  readonly lapses: number
  readonly state: FsrsState['state']
  readonly algorithm: string
}
function readSchedule({ last_review, ...rest }: ReviewedState): FsrsState {
  return { ...rest, lastReview: last_review }
}
function wireSchedule({ lastReview, ...rest }: FsrsState): ReviewedState {
  return { ...rest, last_review: lastReview, algorithm: rest.algorithm ?? LEGACY_PREVIEW_ALGORITHM }
}

export const rustCoreFacade: LoroCoreFacade = {
  orderStream: (candidates, now) =>
    coreCall<string[]>('order_stream', {
      candidates: candidates.map((phrase) => ({
        id: phrase.id,
        active: isActive(phrase),
        plays: phrase.plays,
        difficulty: phrase.difficulty,
        loved: phrase.loved,
        due: phrase.srs?.due ?? null,
      })),
      now,
    }).map(userPhraseId),
  repeatTarget: (difficulty) => coreCall('repeat_target', difficulty),
  streamRank: (phrase, now) =>
    coreCall('stream_rank', {
      plays: phrase.plays,
      difficulty: phrase.difficulty,
      loved: phrase.loved,
      due: phrase.srs?.due ?? null,
      now,
    }),
  automaticity: (reps, target) => coreCall('automaticity', { reps, target }),
  refrainSetSize: (dailyMinutes) => coreCall('refrain_set_size', dailyMinutes),
  modeForRep: (index) => coreCall('mode_for_rep', index),
  modelRateForMode: (mode) => coreCall('model_rate_for_mode', mode),
  beatMsForMode: (mode) => coreCall('beat_ms_for_mode', mode),
  clozeMask: (phrase) => {
    const language = phrase.targetLocale ?? targetForPhraseId(phrase.phraseId ?? '')
    // Target text is independent of the learner's native language. Read the bundled
    // catalog directly so the scheduler never imports presentation or the live store.
    const catalogText =
      phrase.phraseId === null
        ? undefined
        : loadLearningCatalog(language, 'en').phrases.find((entry) => entry.id === phrase.phraseId)
            ?.targetText
    return coreCall('cloze_mask', { text: catalogText ?? phrase.ownEs ?? '', language })
  },
  selectRefrainSet: (candidates, size, tripPhraseIds = []) =>
    coreCall<string[]>('select_refrain_set', {
      candidates: candidates.map((phrase) => ({
        id: phrase.id,
        difficulty: phrase.difficulty,
        learned: phrase.learned,
        graduated: phrase.graduatedAt !== null,
        lockInDays: phrase.lockInDays,
        automaticity: phrase.automaticity,
        reps: phrase.reps,
        addedAt: phrase.addedAt,
      })),
      size,
      tripPhraseIds,
    }).map(userPhraseId),
  reviewGrade: (attempt) =>
    coreCall('review_grade', {
      success: attempt.outcome === 'success',
      hintsUsed: attempt.hintsUsed,
      selfGrade: attempt.selfGrade ?? null,
      confidence: attempt.confidence ?? null,
    }),
  rerate: (phrase, declared) =>
    phrase.srs === null
      ? null
      : readSchedule(
          coreCall<ReviewedState>('fsrs_rerate', {
            state: wireSchedule(phrase.srs),
            declared,
            tags: phrase.tags,
          }),
        ),
  fsrsReview: (phrase, grade, at, confidence) => {
    // Unversioned preview memory is retained exactly; only an observed review adopts
    // the authored policy. Adding a phrase never creates synthetic review history.
    const state =
      phrase.srs === null
        ? coreCall<ReviewedState>('fsrs_initialize', {
            declared: phrase.difficulty,
            tags: phrase.tags,
            at,
          })
        : wireSchedule(phrase.srs)
    return readSchedule(
      coreCall<ReviewedState>('fsrs_review', { state, grade, at, confidence: confidence ?? null }),
    )
  },
  matchTokens: (heard, target, revealed) => coreCall('match_tokens', { heard, target, revealed }),
}

/** Compatibility name for older tests; this object executes Rust, without a JS fallback. */
export const jsCoreFacade = rustCoreFacade
