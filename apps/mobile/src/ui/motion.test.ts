import { motion, scale } from '@loro/design-tokens'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  BEAT_TEMPO_MS,
  REDUCED_MOTION_CROSSFADE_MS,
  SPEED_BEAT_TEMPO_MS,
  barJump,
  clampAutomaticity,
  fadeIn,
  parseEasing,
  popIn,
  pressScale,
  reducedMotionPlan,
  sheetUp,
  tokenHex,
  warmingBand,
  warmingStops,
  withToken,
  wordUnblur,
} from './motion'

const here = dirname(fileURLToPath(import.meta.url))

describe('motion adapter', () => {
  it('parses authored cubic-bezier tokens into control points', () => {
    expect(parseEasing(motion.easing.out.value)).toEqual([0.2, 0.8, 0.2, 1])
    expect(parseEasing(motion.easing.pop.value)).toEqual([0.2, 0.85, 0.25, 1])
    expect(parseEasing(motion.easing.press.value)).toEqual([0.3, 0.7, 0.3, 1])
    expect(parseEasing(motion.easing.inOut.value)).toBe('inOut')
    expect(parseEasing(motion.easing.linear.value)).toBe('linear')
    expect(parseEasing('ease')).toBe('ease')
  })

  it('maps animation and transition tokens without inventing durations', () => {
    expect(withToken('sheetUp')).toMatchObject({
      durationMs: 340,
      easing: 'pop',
      reducedMotion: 'crossfade',
    })
    expect(sheetUp.durationMs).toBe(340)
    expect(popIn).toMatchObject({ durationMs: 400, easing: 'pop', reducedMotion: 'crossfade' })
    expect(fadeIn.reducedMotion).toBe('keep')
    expect(withToken('eqB')).toMatchObject({ durationMs: 1000, staggerMs: 150, loop: true })
    expect(withToken('barJump')).toMatchObject({ durationMs: 720, staggerMs: 120, loop: true })
    expect(barJump(SPEED_BEAT_TEMPO_MS).durationMs).toBe(340)
    expect(BEAT_TEMPO_MS.default).toBe(720)
    expect(wordUnblur).toMatchObject({ durationMs: 350, reducedMotion: 'instant' })
    expect(warmingBand).toMatchObject({ durationMs: 500, reducedMotion: 'keepColour' })
    expect(withToken('contourTrace').durationMs).toBe(motion.transition.contourTrace.totalMs)
  })

  it('exposes press scales and durations from generated tokens', () => {
    expect(pressScale('button')).toEqual({ scale: 0.98, durationMs: 150, opacity: undefined })
    expect(pressScale('icon')).toEqual({ scale: 0.82, durationMs: 130, opacity: 0.6 })
    expect(pressScale('row').durationMs).toBe(160)
  })

  it('declares a reduced-motion plan for every authored outcome', () => {
    expect(reducedMotionPlan('crossfade')).toEqual({
      kind: 'crossfade',
      durationMs: REDUCED_MOTION_CROSSFADE_MS,
      spatial: false,
      loop: false,
      glow: false,
    })
    expect(reducedMotionPlan('instant').durationMs).toBe(0)
    expect(reducedMotionPlan('static').loop).toBe(false)
    expect(reducedMotionPlan('keepColour')).toMatchObject({ glow: false, spatial: false })
    expect(reducedMotionPlan('keep').spatial).toBe(true)
    expect(reducedMotionPlan('scrubber').kind).toBe('scrubber')
  })

  it('reads warming stops from generated tokens, not source literals', () => {
    const stops = warmingStops()
    expect(stops.map((stop) => stop.at)).toEqual([0, 33, 66, 100])
    expect(stops[0]?.background).toBe(tokenHex(scale.warming.cold.bg))
    expect(stops[1]?.background).toBe(tokenHex(scale.warming.warm.bg))
    expect(stops[2]?.background).toBe(tokenHex(scale.warming.hot.bg))
    expect(stops[3]?.background).toBe(tokenHex(scale.warming.peak.bg))
    expect(clampAutomaticity(-4)).toBe(0)
    expect(clampAutomaticity(140)).toBe(100)
    expect(clampAutomaticity(50)).toBe(50)
  })
})

describe('motion adapter integrity', () => {
  it('stays free of Reanimated and setInterval so Node tests can import it', () => {
    const source = readFileSync(join(here, 'motion.ts'), 'utf8')
    expect(source).not.toMatch(/react-native-reanimated/)
    expect(source).not.toMatch(/setInterval/)
    expect(source).not.toMatch(/from ['"]moti['"]/)
    expect(source).not.toMatch(/from ['"]tamagui['"]/)
  })

  it('does not drive kit animations with setInterval or a second motion library', () => {
    const files = [
      'motionRuntime.ts',
      'primitives/Arrival.tsx',
      'primitives/WarmingSurface.tsx',
      'primitives/BeatBars.tsx',
      'primitives/Equalizer.tsx',
      'primitives/PulseRing.tsx',
      'primitives/UnblurText.tsx',
      'primitives/Pressable.tsx',
      'primitives/Sheet.tsx',
    ]
    for (const file of files) {
      const path = join(here, file)
      if (!existsSync(path)) continue
      const source = readFileSync(path, 'utf8')
      expect(source, file).not.toMatch(/setInterval\s*\(/)
      expect(source, file).not.toMatch(/from ['"]moti['"]/)
      expect(source, file).not.toMatch(/from ['"]@gorhom\/bottom-sheet['"]/)
      expect(source, file).not.toMatch(/from ['"]native-base['"]/)
      expect(source, file).not.toMatch(/from ['"]tamagui['"]/)
    }
  })
})
