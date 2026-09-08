/** Deterministic test double. Production selection is implemented in Rust. */
import type { Difficulty, PhraseState } from '../domain/phrase.js'
import { isActive } from '../domain/phrase.js'
import type { UserPhraseId } from '../domain/ids.js'
const LOCK_IN_DAYS_TO_GRADUATE = 4
export function fakeSelectRefrainSet(
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
