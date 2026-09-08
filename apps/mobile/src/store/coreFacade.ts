/** Typed engine adapters over the same Rust code used by the API and native bindings. */
import { userPhraseId, type LoroCoreFacade } from '@loro/core'
import { coreCall } from '../lib/core'
import { loadLearningCatalog, targetForPhraseId } from '@loro/content'

interface ReviewedState {
  readonly stability: number
  readonly difficulty: number
  readonly due: number
  readonly last_review: number | null
  readonly lapses: number
}

export const rustCoreFacade: LoroCoreFacade = {
  repeatTarget: (difficulty) => coreCall('repeat_target', difficulty),
  streamRank: (phrase, now) =>
    coreCall('stream_rank', {
      plays: phrase.plays,
      difficulty: phrase.difficulty,
      loved: phrase.loved,
      due: phrase.srs?.due ?? null,
      now,
    }),
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
  fsrsReview: (phrase, grade, at) => {
    const result = coreCall<ReviewedState>('fsrs_review', {
      state: {
        stability: phrase.srs?.stability ?? 0,
        difficulty: phrase.srs?.difficulty ?? 5,
        due: phrase.srs?.due ?? at,
        last_review: phrase.srs?.lastReview ?? null,
        lapses: phrase.srs?.lapses ?? 0,
      },
      grade,
      at,
    })
    return {
      stability: result.stability,
      difficulty: result.difficulty,
      due: result.due,
      lastReview: result.last_review,
      lapses: result.lapses,
      // Reference no-steps policy keeps cards in the review phase, including lapses.
      state: 'review',
    }
  },
  matchTokens: (heard, target, revealed) => coreCall('match_tokens', { heard, target, revealed }),
}

/** Compatibility name for older tests; this object executes Rust, without a JS fallback. */
export const jsCoreFacade = rustCoreFacade
