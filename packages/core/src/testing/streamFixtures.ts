/**
 * Documented Stream numbers for `@loro/core` test doubles.
 *
 * Canonical computation lives in `packages/core-rs/src/rank.rs` and is asserted through
 * WASM in `apps/mobile/src/lib/core.test.ts`. `fakeCore()` looks these up; it does not
 * reimplement the formulae. Unknown inputs throw so a new call site cannot go green on
 * a second algorithm.
 *
 * Blueprint: Loro.dc.html:2526 (repeat target), 2527 (rank offsets).
 */

import type { Difficulty, PhraseState } from '../domain/phrase.js'

const REPEAT_TARGET = {
  hard: 4,
  med: 3,
  easy: 2,
} as const satisfies Record<Difficulty, number>

/** plays|difficulty|loved|due → rank. Offsets: hard −6, easy +4, loved −3, due −4. */
const STREAM_RANK = new Map<string, number>([
  ['0|easy|0|0', 4],
  ['0|easy|1|0', 1],
  ['0|hard|0|0', -6],
  ['0|hard|1|0', -9],
  ['0|med|0|0', 0],
  ['0|med|1|0', -3],
  ['2|hard|1|0', -7],
  ['3|med|0|0', 3],
  ['3|med|1|0', 0],
  ['5|easy|0|0', 9],
  ['5|hard|0|0', -1],
  ['20|hard|0|0', 14],
])

function missingFixture(label: string, input: string): never {
  throw new Error(`fakeCore has no ${label} fixture for ${input}`)
}

function streamRankKey(
  plays: number,
  difficulty: Difficulty,
  loved: boolean,
  due: boolean,
): string {
  return `${plays}|${difficulty}|${loved ? 1 : 0}|${due ? 1 : 0}`
}

/** Hard 4, med 3, easy 2. Loro.dc.html:2526. */
export function fixtureRepeatTarget(difficulty: Difficulty): number {
  return REPEAT_TARGET[difficulty] ?? missingFixture('repeatTarget', difficulty)
}

/** `plays` plus the documented offsets. Loro.dc.html:2527. */
export function fixtureStreamRank(phrase: PhraseState, now: number): number {
  const due = phrase.srs !== null && phrase.srs.due <= now
  const key = streamRankKey(phrase.plays, phrase.difficulty, phrase.loved, due)
  return STREAM_RANK.get(key) ?? missingFixture('streamRank', key)
}
