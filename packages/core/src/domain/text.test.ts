import { describe, expect, it } from 'vitest'
import { foldDiacritics, foldSearchText } from './text.js'

describe('foldDiacritics', () => {
  it('removes combining marks while preserving case and punctuation', () => {
    expect(foldDiacritics('¿ALÉRGICO, señor?')).toBe('¿ALERGICO, senor?')
  })

  it('leaves unaccented text unchanged', () => {
    expect(foldDiacritics('already plain')).toBe('already plain')
  })
})

describe('F-08 search folding', () => {
  it('matches case and Spanish accents without merging distinct Cyrillic letters', () => {
    expect(foldSearchText('CAFÉ')).toBe('cafe')
    expect(foldSearchText('Й')).not.toBe(foldSearchText('И'))
    expect(foldSearchText('Ё')).not.toBe(foldSearchText('Е'))
    expect(foldSearchText('И\u0306')).toBe(foldSearchText('Й'))
  })
})
