/**
 * The catalog lookups.
 *
 * `packPhrases` is what onboarding seeds a stream from, so its two failure modes are both
 * learner-visible on the very first screen: a duplicate row for a phrase two packs share,
 * and a crash (or a hole) when a pack names an id the shipped catalog no longer has —
 * content ships independently of the app (ADR-0009), so that is a real state.
 */

import { describe, expect, it } from 'vitest'
import { catalogById, catalogPhrases, packPhrases, packs } from './catalog'

describe('the catalog', () => {
  it('indexes every phrase by its id', () => {
    expect(catalogById.size).toBe(catalogPhrases.length)
    for (const p of catalogPhrases) expect(catalogById.get(p.id)).toBe(p)
  })
})

describe('packPhrases', () => {
  it('resolves a pack to its catalog entries, in pack order', () => {
    const pack = packs[0]
    expect(pack).toBeDefined()
    if (pack === undefined) return

    expect(packPhrases([pack.id]).map((c) => c.id)).toEqual([...pack.phrases])
  })

  it('seeds one row per phrase when two packs overlap', () => {
    const pack = packs[0]
    expect(pack).toBeDefined()
    if (pack === undefined) return

    // The same pack twice is the cheapest overlap there is, and the one a learner can
    // actually cause by tapping a card twice.
    const ids = packPhrases([pack.id, pack.id]).map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toEqual([...pack.phrases])
  })

  it('drops an id the catalog does not have rather than throwing', () => {
    expect(packPhrases(['no-such-pack'])).toEqual([])
  })

  it('is empty for no packs — onboarding may legitimately skip them', () => {
    expect(packPhrases([])).toEqual([])
  })
})
