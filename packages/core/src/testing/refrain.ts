/** Test-only deterministic fixtures. Production arithmetic lives in Rust. */
import type { Difficulty, PhraseState } from '../domain/phrase.js'
import { isActive } from '../domain/phrase.js'
import type { UserPhraseId } from '../domain/ids.js'
import {
  REFRAIN_MODES,
  LOCK_IN_DAYS_TO_GRADUATE,
  type RefrainMode,
} from '../engines/refrain/index.js'

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
  return mode === 'speed' ? 1.15 : mode === 'echo' || mode === 'chorus' ? 0.95 : null
}

/** Beat tempo. Speed mode's faster beat is the only cue that it differs. */
export function beatMsForMode(mode: RefrainMode): number {
  return mode === 'speed' ? 340 : 720
}

/** `min(100, round(reps / target * 100))`. Blueprint contract. */
export function automaticity(repsToday: number, target: number): number {
  if (target <= 0) return 0
  return Math.min(100, Math.round((repsToday / target) * 100))
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
