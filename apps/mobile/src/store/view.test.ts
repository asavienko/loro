/**
 * The row ⋈ catalog join.
 *
 * The case worth pinning is the learner-authored row: its text lives on the row, and the
 * theme/emoji fallback is applied in TWO places — resolved at write time by `newOwnPhrase`
 * and at read time by `toView`. If those two ever disagree, the same phrase renders one way
 * when it is created and another way after a reload, which is why they now read one constant.
 */

import { describe, expect, it } from 'vitest'
import type { CatalogPhraseId, UserPhraseId } from '@loro/core'
import { catalogPhrases } from './catalog'
import { blankPhraseState, newOwnPhrase, OWN_PHRASE_FALLBACK } from './phraseFactory'
import { toView } from './view'

const rowId = 'row-1' as UserPhraseId
const AT = 1_785_231_660_000

describe('toView', () => {
  it('takes the text from the catalog entry a row joins to', () => {
    const cat = catalogPhrases[0]
    expect(cat).toBeDefined()
    if (cat === undefined) return

    const view = toView(blankPhraseState(rowId, cat.id as CatalogPhraseId, 'starter', AT))
    expect(view.targetText).toBe(cat.es)
    expect(view.translation).toBe(cat.en)
    expect(view.theme).toBe(cat.theme)
    expect(view.emoji).toBe(cat.emoji)
    expect(view.catalog?.id).toBe(cat.id)
  })

  it('renders a learner-authored row from the row itself', () => {
    const view = toView(
      newOwnPhrase(rowId, { targetText: 'Me lo apunto', translation: "I'll note that down" }, AT),
    )
    expect(view.targetText).toBe('Me lo apunto')
    expect(view.catalog).toBeNull()
  })

  it('agrees with the write-time fallback for a row that named no theme or emoji', () => {
    // Written by the factory…
    const written = toView(newOwnPhrase(rowId, { targetText: 'Vale', translation: 'OK' }, AT))
    // …and a row that reached the store without those fields at all.
    const bare = toView({
      ...blankPhraseState(rowId, null, 'custom', AT),
      ownEs: 'Vale',
      ownEn: 'OK',
    })

    expect(written.theme).toBe(bare.theme)
    expect(written.emoji).toBe(bare.emoji)
    expect(bare.theme).toBe(OWN_PHRASE_FALLBACK.theme)
    expect(bare.emoji).toBe(OWN_PHRASE_FALLBACK.emoji)
  })

  it('falls back to empty text rather than showing a missing catalog id', () => {
    // Content ships independently of the app: a row can outlive the phrase it joined to.
    const view = toView(blankPhraseState(rowId, 'gone-in-v2' as CatalogPhraseId, 'discover', AT))
    expect(view.targetText).toBe('')
    expect(view.translation).toBe('')
    expect(view.catalog).toBeNull()
  })
})
