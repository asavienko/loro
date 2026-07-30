import { describe, expect, it } from 'vitest'
import { foldDiacritics } from './text.js'

describe('foldDiacritics', () => {
  it('removes combining marks while preserving case and punctuation', () => {
    expect(foldDiacritics('¿ALÉRGICO, señor?')).toBe('¿ALERGICO, senor?')
  })

  it('leaves unaccented text unchanged', () => {
    expect(foldDiacritics('already plain')).toBe('already plain')
  })
})
