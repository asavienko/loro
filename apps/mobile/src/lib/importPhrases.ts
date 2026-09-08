/**
 * Offline text import parsing. A line is deliberately a small, reviewable unit:
 * `target | meaning` (tabs work too). Nothing leaves this module or becomes a row
 * until the learner explicitly accepts it on the Import surface.
 */

import { foldSearchText } from '@loro/core'

export interface ImportCandidate {
  readonly line: number
  readonly targetText: string
  readonly translation: string
  readonly issue: 'invalid' | 'duplicate' | null
}

export function normalizeImportedText(value: string): string {
  return value.normalize('NFC').replace(/\s+/gu, ' ').trim()
}

/** A matching key only for local duplicate review; stored text keeps its authored accents. */
export function importedPhraseKey(value: string): string {
  return foldSearchText(normalizeImportedText(value))
}

export function parseImportedPhrases(
  input: string,
  existingTargetTexts: readonly string[],
): ImportCandidate[] {
  return reviewImportedCandidates(
    input.split(/\r?\n/u).flatMap((line, index) => {
      if (line.trim() === '') return []
      const pieces = line.split(/\t|\|/u)
      return [
        {
          line: index + 1,
          targetText: normalizeImportedText(pieces[0] ?? ''),
          translation: normalizeImportedText(pieces.slice(1).join(' | ')),
          issue: null,
        },
      ]
    }),
    existingTargetTexts,
  )
}

/** Re-run after an edit so the review never promises that a duplicate will be saved. */
export function reviewImportedCandidates(
  candidates: readonly ImportCandidate[],
  existingTargetTexts: readonly string[],
): ImportCandidate[] {
  const seen = new Set(existingTargetTexts.map(importedPhraseKey).filter(Boolean))
  return candidates.map((candidate) => {
    const targetText = normalizeImportedText(candidate.targetText)
    const translation = normalizeImportedText(candidate.translation)
    if (targetText === '' || translation === '')
      return { ...candidate, targetText, translation, issue: 'invalid' }
    const key = importedPhraseKey(targetText)
    if (seen.has(key)) return { ...candidate, targetText, translation, issue: 'duplicate' }
    seen.add(key)
    return { ...candidate, targetText, translation, issue: null }
  })
}
