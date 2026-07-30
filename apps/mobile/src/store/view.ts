/**
 * The view mapper: a stored row joined to its catalog entry.
 *
 * The join lives here and nowhere else, so a screen never reaches into the catalog on its
 * own. Two rows render through the same function: a catalog phrase (text from content) and
 * a learner-authored one (text from the row, `phraseId === null`), and a screen must not
 * have to know which it has.
 */

import type { PhraseState } from '@loro/core'
import type { CatalogPhrase } from '@loro/content'
import { catalogById } from './catalog'
import { OWN_PHRASE_FALLBACK } from './phraseFactory'

export interface PhraseView extends PhraseState {
  es: string
  en: string
  theme: string
  emoji: string
  catalog: CatalogPhrase | null
}

export function toView(p: PhraseState): PhraseView {
  const cat = p.phraseId === null ? null : (catalogById.get(p.phraseId) ?? null)
  return {
    ...p,
    es: cat?.es ?? p.ownEs ?? '',
    en: cat?.en ?? p.ownEn ?? '',
    theme: cat?.theme ?? p.ownTheme ?? OWN_PHRASE_FALLBACK.theme,
    emoji: cat?.emoji ?? p.ownEmoji ?? OWN_PHRASE_FALLBACK.emoji,
    catalog: cat,
  }
}
