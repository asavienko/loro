/**
 * A phrase row for tests: every field present, overridable. Uses no clock or randomness, so
 * each fixture is reproducible.
 */
import { catalogPhraseId, userPhraseId } from './ids.js'
import { LadderRung, type PhraseState } from './phrase.js'

/** A fixed instant. 2026-07-28T09:41:00Z. */
export const T0 = 1_785_231_660_000

export function makePhrase(id: string, overrides: Partial<PhraseState> = {}): PhraseState {
  return {
    id: userPhraseId(id),
    phraseId: catalogPhraseId(id),
    source: 'starter',
    difficulty: 'med',
    tags: [],
    loved: false,
    learned: false,
    note: null,
    plays: 0,
    reps: 0,
    addedAt: T0 - 86_400_000,
    lastPracticedAt: null,
    graduatedAt: null,
    srs: null,
    repsToday: 0,
    repsTodayDay: null,
    automaticity: 0,
    lockInDays: 0,
    rung: LadderRung.Accumulated,
    stumbles: 0,
    cueLevel: 0,
    axPerception: 0,
    axRecall: 0,
    axProduction: 0,
    ...overrides,
  }
}
