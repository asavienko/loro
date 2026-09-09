import { describe, expect, it } from 'vitest'
import { decodeImportDraft } from './importDraft'

describe('import draft recovery', () => {
  it('keeps only complete local draft checkpoints', () => {
    expect(
      decodeImportDraft(JSON.stringify({ targetLocale: 'es-ES', nativeLanguage: 'en', input: 'Hola | Hi' })),
    ).toEqual({ targetLocale: 'es-ES', nativeLanguage: 'en', input: 'Hola | Hi' })
    expect(decodeImportDraft('{')).toBeNull()
    expect(decodeImportDraft(JSON.stringify({ targetLocale: 'es-ES', input: 'Hola | Hi' }))).toBeNull()
  })
})
