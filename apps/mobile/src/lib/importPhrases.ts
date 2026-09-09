/**
 * Offline text import parsing. A line is deliberately a small, reviewable unit:
 * `target | meaning` (tabs work too). Nothing leaves this module or becomes a row
 * until the learner explicitly accepts it on the Import surface.
 */

import { foldSearchText, MAX_OWN_PHRASE_TEXT_CODE_UNITS } from '@loro/core'

/** Keep review rendering bounded; batch and field lengths are JavaScript UTF-16 code units. */
export const IMPORT_MAX_CHARACTERS = 20_000
export const IMPORT_MAX_ROWS = 50

/** Reject the whole batch rather than silently losing the tail of the learner's work. */
export function isImportTooLarge(input: string): boolean {
  if (input.length > IMPORT_MAX_CHARACTERS) return true
  return input.split(/\r\n|[\r\n]/u).filter((line) => line.trim() !== '').length > IMPORT_MAX_ROWS
}

export interface ImportCandidate {
  readonly line: number
  readonly targetText: string
  readonly translation: string
  readonly issue: 'invalid' | 'duplicate' | 'too-long' | null
}

/** The normalized text is what can be persisted, so it is what consumes the reviewed batch budget. */
export function reviewedImportCodeUnits(candidates: readonly ImportCandidate[]): number {
  return candidates.reduce(
    (total, { targetText, translation }) => total + targetText.length + translation.length + 4,
    0,
  )
}

export function isReviewedImportTooLarge(candidates: readonly ImportCandidate[]): boolean {
  return (
    candidates.length > IMPORT_MAX_ROWS ||
    reviewedImportCodeUnits(candidates) > IMPORT_MAX_CHARACTERS
  )
}

/** Keep a partially saved review editable without leaving already-persisted rows in its draft. */
export function importInputForCandidates(candidates: readonly ImportCandidate[]): string {
  return candidates
    .map(({ targetText, translation }) => `${targetText} | ${translation}`)
    .join('\n')
}

/** A failed write stays in the review: only rows confirmed by the store leave the draft. */
export function unsavedImportCandidates(
  candidates: readonly ImportCandidate[],
  savedLines: ReadonlySet<number>,
): ImportCandidate[] {
  return candidates.filter((candidate) => !savedLines.has(candidate.line))
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
  if (isImportTooLarge(input)) return []
  return reviewImportedCandidates(
    input.split(/\r\n|[\r\n]/u).flatMap((line, index) => {
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
    if (
      targetText.length > MAX_OWN_PHRASE_TEXT_CODE_UNITS ||
      translation.length > MAX_OWN_PHRASE_TEXT_CODE_UNITS
    )
      return { ...candidate, targetText, translation, issue: 'too-long' }
    const key = importedPhraseKey(targetText)
    if (seen.has(key)) return { ...candidate, targetText, translation, issue: 'duplicate' }
    seen.add(key)
    return { ...candidate, targetText, translation, issue: null }
  })
}
