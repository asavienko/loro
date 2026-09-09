import { USER_PHRASE_SYNC_FIELDS, type PhraseState } from '@loro/core'
import type { AppData } from '../store/state'

export type LearnerFieldValues = Record<string, string | number | boolean | null>

/** Shared camelCase wire field spelling, with structured values encoded for the existing outbox. */
export function phraseFields(phrase: PhraseState): LearnerFieldValues {
  const { srs } = phrase
  const result: LearnerFieldValues = {}
  for (const { wire } of USER_PHRASE_SYNC_FIELDS) {
    if (wire === 'deletedAt' || wire.startsWith('srs')) continue
    const value = phrase[wire as keyof PhraseState]
    if (value === undefined) continue
    result[wire] = Array.isArray(value)
      ? JSON.stringify(value)
      : (value as string | number | boolean | null)
  }
  if (srs !== null) {
    Object.assign(result, {
      srsStability: srs.stability,
      srsDifficulty: srs.difficulty,
      srsDue: srs.due,
      srsLastReview: srs.lastReview,
      srsLapses: srs.lapses,
      srsState: srs.state,
      ...(srs.algorithm ? { srsAlgorithm: srs.algorithm } : {}),
    })
  }
  return result
}

export function changedFields(
  previous: LearnerFieldValues,
  next: LearnerFieldValues,
): LearnerFieldValues {
  return Object.fromEntries(Object.entries(next).filter(([key, value]) => previous[key] !== value))
}

export function settingsFields(state: AppData): LearnerFieldValues {
  return {
    languagePair: JSON.stringify({
      nativeLanguage: state.nativeLanguage,
      targetLocale: state.targetLocale,
    }),
    goal: state.goal,
    level: state.level,
    dailyMinutes: state.dailyMinutes,
  }
}
