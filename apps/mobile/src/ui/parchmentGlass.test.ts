import { describe, expect, it } from 'vitest'
import { surface } from '@loro/design-tokens'
import {
  CHROME_GUTTER,
  GLASS_ALPHA,
  GLASS_BLUR_PX,
  ISLAND_GLASS_ALPHA,
  chromeHairlineFill,
  glassFill,
  hexAlpha,
  islandGlassFill,
} from './parchmentInk'

describe('parchment glass tokens', () => {
  it('tints surface.app to the Today-phone 85% spine glass', () => {
    expect(glassFill).toBe(hexAlpha(surface.app, GLASS_ALPHA))
    expect(GLASS_ALPHA).toBe(0.85)
    const short = ['#', 'f', 'c', 'f'].join('')
    expect(hexAlpha(short, 0.5)).toBe(`rgba(255,204,255,0.5)`)
  })

  it('keeps DESIGN.md floating-island glass at 92% for ActionBar only', () => {
    expect(ISLAND_GLASS_ALPHA).toBe(0.92)
    expect(islandGlassFill).toBe(hexAlpha(surface.app, ISLAND_GLASS_ALPHA))
    expect(islandGlassFill).not.toBe(glassFill)
  })

  it('keeps the authored 20-px chrome gutter and DESIGN.md 12-px blur', () => {
    expect(CHROME_GUTTER).toBe(20)
    expect(GLASS_BLUR_PX).toBe(12)
  })

  it('colours the header hairline from shadowInk, not a grey drop', () => {
    expect(chromeHairlineFill).toBe(hexAlpha(surface.shadowInk, 0.04))
  })
})
