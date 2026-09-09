import { describe, expect, it } from 'vitest'
import {
  IMPORT_MAX_CHARACTERS,
  IMPORT_MAX_ROWS,
  importInputForCandidates,
  isImportTooLarge,
  isReviewedImportTooLarge,
  parseImportedPhrases,
  reviewImportedCandidates,
  unsavedImportCandidates,
  type ImportCandidate,
} from './importPhrases'
import { MAX_OWN_PHRASE_TEXT_CODE_UNITS } from '@loro/core'

describe('offline phrase import', () => {
  it('normalizes Unicode and whitespace without changing the reviewed text meaning', () => {
    expect(parseImportedPhrases('  Que\u0301  tal |  How   are you? ', [])).toEqual([
      { line: 1, targetText: 'Qué tal', translation: 'How are you?', issue: null },
    ])
  })

  it('makes incomplete and duplicate lines reviewable instead of creating rows', () => {
    expect(parseImportedPhrases('Hola | Hi\nHola | Hello\nSin significado', [])).toEqual([
      { line: 1, targetText: 'Hola', translation: 'Hi', issue: null },
      { line: 2, targetText: 'Hola', translation: 'Hello', issue: 'duplicate' },
      { line: 3, targetText: 'Sin significado', translation: '', issue: 'invalid' },
    ])
  })

  it('reviews duplicates against already owned phrases with folded accents', () => {
    expect(parseImportedPhrases('Que tal | How are you?', ['Qué tal'])).toEqual([
      { line: 1, targetText: 'Que tal', translation: 'How are you?', issue: 'duplicate' },
    ])
    expect(parseImportedPhrases('¡Hola! | Hi', ['Hola'])).toEqual([
      { line: 1, targetText: '¡Hola!', translation: 'Hi', issue: 'duplicate' },
    ])
  })
})

describe('bounded offline import review', () => {
  it('rejects oversized input before normalization without returning a partial batch', () => {
    const atLimit = 'a'.repeat(IMPORT_MAX_CHARACTERS - 4) + ' | b'
    expect(isImportTooLarge(atLimit)).toBe(false)
    expect(parseImportedPhrases(atLimit, [])).toHaveLength(1)
    expect(isImportTooLarge(atLimit + 'c')).toBe(true)
    expect(parseImportedPhrases(atLimit + 'c', [])).toEqual([])
  })

  it('counts nonempty rows across all common line endings and permits a smaller retry', () => {
    const rows = Array.from({ length: IMPORT_MAX_ROWS }, (_, index) => `Hola ${index} | Hi`)
    const atLimit = rows.join('\r') + '\r\n \n'
    expect(isImportTooLarge(atLimit)).toBe(false)
    expect(parseImportedPhrases(atLimit, [])).toHaveLength(IMPORT_MAX_ROWS)
    expect(isImportTooLarge(atLimit + 'Extra | Extra')).toBe(true)
    expect(parseImportedPhrases(atLimit + 'Extra | Extra', [])).toEqual([])
    expect(parseImportedPhrases('Extra | Extra', [])).toHaveLength(1)
  })

  it('shares the sync field limit for targets and meanings without truncating drafts', () => {
    const atLimit = 'a'.repeat(MAX_OWN_PHRASE_TEXT_CODE_UNITS)
    const overLimit = `${atLimit}a`
    expect(parseImportedPhrases(`${atLimit} | ${atLimit}`, [])).toEqual([
      { line: 1, targetText: atLimit, translation: atLimit, issue: null },
    ])
    expect(parseImportedPhrases(`${overLimit} | meaning`, [])).toMatchObject([
      { targetText: overLimit, issue: 'too-long' },
    ])
    expect(parseImportedPhrases(`target | ${overLimit}`, [])).toMatchObject([
      { translation: overLimit, issue: 'too-long' },
    ])
  })

  it('rechecks an edited draft against field and normalized batch limits', () => {
    const draft = parseImportedPhrases('Hola | Hello', [])
    const edited = reviewImportedCandidates(
      [{ ...draft[0]!, targetText: '😀'.repeat(MAX_OWN_PHRASE_TEXT_CODE_UNITS) }],
      [],
    )
    // Emoji use two UTF-16 units each, matching the persisted Zod boundary.
    expect(edited[0]).toMatchObject({ issue: 'too-long', targetText: '😀'.repeat(2_000) })

    const rows: ImportCandidate[] = Array.from({ length: IMPORT_MAX_ROWS }, (_, index) => ({
      line: index + 1,
      targetText: `a${index}`,
      translation: 'b',
      issue: null,
    }))
    expect(isReviewedImportTooLarge(rows)).toBe(false)
    const oversized = reviewImportedCandidates(
      rows.map((candidate, index) =>
        index === 0
          ? { ...candidate, translation: 'e\u0301'.repeat(IMPORT_MAX_CHARACTERS) }
          : candidate,
      ),
      [],
    )
    expect(isReviewedImportTooLarge(oversized)).toBe(true)
    expect(oversized[0]).toMatchObject({ translation: 'é'.repeat(IMPORT_MAX_CHARACTERS) })
  })

  it('round-trips reviewed fields containing the import separators after a partial save', () => {
    const draft: ImportCandidate[] = [
      { line: 2, targetText: 'A | B', translation: '', issue: 'invalid' },
      { line: 3, targetText: 'Still here', translation: 'Meaning | with \\ slash', issue: null },
    ]
    expect(parseImportedPhrases(importInputForCandidates(draft), [])).toEqual([
      { ...draft[0], line: 1 },
      { ...draft[1], line: 2 },
    ])
  })

  it('retains the failed row and every later row when a batch write stops part-way through', () => {
    const candidates: ImportCandidate[] = [
      { line: 1, targetText: 'Saved', translation: 'Saved meaning', issue: null },
      { line: 2, targetText: 'Failed', translation: 'Failed meaning', issue: null },
      { line: 3, targetText: 'Later', translation: '', issue: 'invalid' },
    ]
    expect(unsavedImportCandidates(candidates, new Set([1]))).toEqual(candidates.slice(1))
    expect(unsavedImportCandidates(candidates, new Set())).toEqual(candidates)
  })
})
