import { describe, expect, it } from 'vitest'
import { decodeImportDraft, decodeImportDrafts } from './importDraft'

describe('import draft recovery', () => {
  it('keeps only complete local draft checkpoints', () => {
    expect(
      decodeImportDraft(
        JSON.stringify({ targetLocale: 'es-ES', nativeLanguage: 'en', input: 'Hola | Hi' }),
      ),
    ).toEqual({ targetLocale: 'es-ES', nativeLanguage: 'en', input: 'Hola | Hi' })
    expect(decodeImportDraft('{')).toBeNull()
    expect(
      decodeImportDraft(JSON.stringify({ targetLocale: 'es-ES', input: 'Hola | Hi' })),
    ).toBeNull()
  })

  it('retains valid independent pair checkpoints while dropping malformed entries', () => {
    expect(
      decodeImportDrafts(
        JSON.stringify({
          'en:es-ES': { targetLocale: 'es-ES', nativeLanguage: 'en', input: 'Hola | Hi' },
          malformed: { targetLocale: 'es-ES', nativeLanguage: 'en' },
        }),
      ),
    ).toEqual({
      'en:es-ES': { targetLocale: 'es-ES', nativeLanguage: 'en', input: 'Hola | Hi' },
    })
  })
})
