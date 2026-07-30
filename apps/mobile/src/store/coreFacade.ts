/**
 * A TEMPORARY JavaScript stand-in for `packages/core-rs`. Nothing here is canonical.
 *
 * `LoroCoreFacade` (packages/core/src/engines/types.ts) is the subset of loro-core an
 * engine may use, injected rather than imported so engines stay pure. On device it must be
 * backed by the Rust core: ADR-0002 says every number that has to be identical across
 * platforms — FSRS intervals, ranking, the cloze mask, ASR token matching — is implemented
 * ONCE, in Rust, because two implementations diverge and a learner's schedule is what
 * diverges. The UniFFI binding is not wired up yet, so the app injects this object.
 *
 * Two of these are not merely duplicates, they are fabrications standing in for the real
 * thing, and they are the reason this file is quarantined rather than tidied:
 *
 *   • `fsrsReview` returns a made-up interval table with `difficulty` pinned to 5, feeding
 *     the field the memory-model screen is specified to plot as a real forgetting curve
 *     (ADR-0004). `core-rs/src/fsrs/mod.rs` still has the `todo!`.
 *   • `clozeMask` always blanks the SECOND token. `core-rs/src/select.rs:121-122` says it
 *     must be the most informative content word, never an article or a preposition.
 *
 * They are non-negotiable #2 violations that predate this file, and changing a number here
 * changes what a learner sees. So the values below are reproduced EXACTLY as they were
 * inline in the store, and fixing them is plans/05-fix-shared-maths-duplication.md — whose
 * job this file exists to make small: replace this one module with the binding, delete it,
 * and no call site moves.
 *
 * Do not add a number here. Do not adjust one. Anything new belongs in `core-rs`.
 *
 * ── AND IT IS A THIRD COPY: the production facade is the test fake ──
 *
 * `fakeCore()` at `packages/core/src/testing/index.ts:136-181` is this object, near
 * verbatim — so the app ships the fixture the engine tests assert against. Obvious as that
 * looks, DO NOT unify them here. They diverge at ONE line, in `matchTokens`:
 *
 *     this file             complete: next >= t.length
 *     testing/index.ts:178  complete: next >= t.length && t.length > 0
 *
 * For an EMPTY target the app answers `true` and the fixture answers `false`. That is the
 * ASR production gate: unifying on core's version would stop an empty phrase completing,
 * and unifying on this one would change what the engine suite proves. Which is correct is a
 * question for plans/05 and `core-rs/src/asr.rs:64`, and it needs the parity check, not a
 * merge. Until then the divergence is DELIBERATE and recorded here.
 */

import { foldDiacritics, REPEAT_TARGET, type LoroCoreFacade } from '@loro/core'

export const jsCoreFacade: LoroCoreFacade = {
  // The one line here that is NOT a duplicate: `REPEAT_TARGET` is the canonical declaration
  // (`domain/phrase.ts:42`, `{ hard: 4, med: 3, easy: 2 }`, blueprint `Loro.dc.html:2526`),
  // exported and — until now — used by nothing. Identical values to the `? :` chain this
  // replaces, and a `Record<Difficulty, number>` cannot silently miss a new difficulty the
  // way the chain's trailing `: 3` did.
  repeatTarget: (d) => REPEAT_TARGET[d],
  streamRank: (p, now) => {
    let r = p.plays
    r += p.difficulty === 'hard' ? -6 : p.difficulty === 'easy' ? 4 : 0
    if (p.loved) r -= 3
    if (p.srs !== null && p.srs.due <= now) r -= 4
    return r
  },
  clozeMask: () => [1],
  fsrsReview: (_s, grade, at) => {
    const days = grade === 1 ? 0.007 : grade === 2 ? 1 : grade === 3 ? 3 : 5
    return { stability: days, difficulty: 5, due: at + days * 86_400_000 }
  },
  matchTokens: (heard, target, revealed) => {
    const norm = (x: string): string => foldDiacritics(x.toLowerCase()).replace(/[^a-z0-9ñ]/g, '')
    const h = heard.map(norm).filter(Boolean)
    const t = target.map(norm)
    let cursor = 0
    let matched = revealed
    for (let k = revealed; k < t.length; k++) {
      const idx = h.indexOf(t[k] ?? '', cursor)
      if (idx < 0) break
      cursor = idx + 1
      matched = k + 1
    }
    const next = Math.max(matched, revealed)
    return {
      revealed: next,
      justIndex: next > revealed ? next - 1 : -1,
      complete: next >= t.length,
    }
  },
}
