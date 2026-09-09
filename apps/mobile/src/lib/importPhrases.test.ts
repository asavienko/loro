import { describe, expect, it } from 'vitest'
import {
  IMPORT_MAX_CHARACTERS,
  IMPORT_MAX_ROWS,
  isImportTooLarge,
  parseImportedPhrases,
} from './importPhrases'

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
})
