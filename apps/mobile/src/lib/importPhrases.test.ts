import { describe, expect, it } from 'vitest'
import { parseImportedPhrases } from './importPhrases'

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
