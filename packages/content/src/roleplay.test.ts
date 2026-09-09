import { describe, expect, it } from 'vitest'
import {
  BUNDLED_ROLEPLAY_CONTENT_VERSION,
  BUNDLED_ROLEPLAY_SCHEMA_VERSION,
  DEFAULT_ROLEPLAY_THEME,
  bundledRoleplayScene,
  bundledRoleplayThemes,
} from './roleplay.js'

describe('bundled roleplay catalog', () => {
  it('has explicit content provenance for persisted sessions and future updates', () => {
    expect(BUNDLED_ROLEPLAY_SCHEMA_VERSION).toBe(1)
    expect(BUNDLED_ROLEPLAY_CONTENT_VERSION).toBe(1)
  })

  it('has a complete offline scene behind every offered theme', () => {
    for (const theme of bundledRoleplayThemes()) {
      const scene = bundledRoleplayScene(theme)
      expect(scene.turns).toHaveLength(3)
      for (const turn of scene.turns) {
        expect(turn.options).toHaveLength(3)
        expect(turn.options.filter((option) => option.best)).toHaveLength(1)
      }
    }
  })

  it('uses the authored default for an unknown theme without consulting a provider', () => {
    expect(bundledRoleplayScene('not-a-theme')).toBe(bundledRoleplayScene(DEFAULT_ROLEPLAY_THEME))
  })
})
