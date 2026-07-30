import { accents, defaultAccent } from '@loro/design-tokens'
import { describe, expect, it } from 'vitest'
import { resolveTheme } from './themeContext'

describe('resolveTheme', () => {
  it('defaults to the generated accent and system motion preference', () => {
    expect(resolveTheme(undefined, undefined, true, undefined)).toEqual({
      accentName: defaultAccent,
      accent: accents[defaultAccent],
      reducedMotion: true,
      textScale: 1,
    })
  })

  it('resolves every generated accent by its typed name', () => {
    for (const accentName of Object.keys(accents) as (keyof typeof accents)[]) {
      expect(resolveTheme(accentName, undefined, false, undefined).accent).toBe(accents[accentName])
    }
  })

  it('lets an inspection override win over the system motion preference', () => {
    const inspectionAccent = (Object.keys(accents) as (keyof typeof accents)[]).find(
      (name) => name !== defaultAccent,
    )!
    expect(resolveTheme(inspectionAccent, false, true, 3.1)).toEqual({
      accentName: inspectionAccent,
      accent: accents[inspectionAccent],
      reducedMotion: false,
      textScale: 3.1,
    })
  })
})
