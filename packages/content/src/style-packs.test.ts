import { describe, expect, it } from 'vitest'
import { MUSIC_STYLE_IDS } from '@loro/core'
import {
  MUSIC_STYLE_PACK_VERSION,
  MUSIC_STYLE_PACKS,
  musicStylePack,
  resolveMusicStylePacks,
} from './style-packs.js'

describe('music style packs (p3f-03)', () => {
  it('maps every stable style id to English vendor arrays', () => {
    expect(Object.keys(MUSIC_STYLE_PACKS).sort()).toEqual([...MUSIC_STYLE_IDS].sort())
    for (const styleId of MUSIC_STYLE_IDS) {
      const pack = musicStylePack(styleId)
      expect(pack.pack_version).toBe(MUSIC_STYLE_PACK_VERSION)
      expect(pack.positive_styles.length).toBeGreaterThanOrEqual(6)
      expect(pack.positive_styles[0]?.length).toBeGreaterThan(0)
    }
    expect(resolveMusicStylePacks(['acoustic_folk', 'modern_pop']).map((p) => p.style_id)).toEqual([
      'acoustic_folk',
      'modern_pop',
    ])
    expect(() => musicStylePack('death_metal')).toThrow(/Unknown music style/)
    expect(() => resolveMusicStylePacks(['modern_pop', 'modern_pop'])).toThrow(/Duplicate/)
  })
})
