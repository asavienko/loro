import type { PhraseState } from '@loro/core'
import type { DisplayPhrase as CatalogPhrase } from '../../src/store/learningCatalog'

export function ownedPhraseLines(
  owned: readonly PhraseState[],
  catalog: readonly CatalogPhrase[],
): { targetText: string; translation: string }[] {
  const catalogById = new Map(catalog.map((phrase) => [phrase.id, phrase]))
  const lines: { targetText: string; translation: string }[] = []
  for (const row of owned) {
    if (row.phraseId === null) {
      if (row.ownEs !== undefined && row.ownEs.length > 0) {
        lines.push({ targetText: row.ownEs, translation: row.ownEn ?? '' })
      }
      continue
    }
    const phrase = catalogById.get(row.phraseId)
    if (phrase !== undefined) {
      lines.push({ targetText: phrase.targetText, translation: phrase.translation })
    }
  }
  return lines
}

export function ownedTargetTexts(
  owned: readonly PhraseState[],
  catalog: readonly CatalogPhrase[],
): string[] {
  return ownedPhraseLines(owned, catalog).map((line) => line.targetText)
}
