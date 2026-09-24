import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { loadTokens } from './tokens.js'
import { generateOutputs } from './generate.js'
import {
  contrastRatio,
  createContrastReport,
  parseHex,
  passes,
  ratio,
  AA_BODY,
  AA_LARGE,
} from '@loro/design-tokens/contrast'

describe('contrast maths', () => {
  it('matches known WCAG values', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1)
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 3)
  })

  it('is symmetric', () => {
    expect(ratio('#9f3c16', '#fcf9f4')).toBe(ratio('#fcf9f4', '#9f3c16'))
  })

  it('parses shorthand hex', () => {
    expect(parseHex('#fff')).toEqual({ r: 255, g: 255, b: 255 })
    expect(parseHex('abc')).toEqual({ r: 170, g: 187, b: 204 })
  })

  it('rejects a non-colour', () => {
    expect(() => parseHex('not-a-colour')).toThrow(/hex/)
  })

  it('applies the right threshold per text size', () => {
    // A known mid-contrast pair: 3:1 large passes, 4.5:1 body does not.
    expect(passes('#bf5722', '#f6f2ea', 'large')).toBe(true)
    expect(passes('#bf5722', '#f6f2ea', 'body')).toBe(false)
  })

  it('uses the WCAG 2.2 AA thresholds', () => {
    expect(AA_BODY).toBe(4.5)
    expect(AA_LARGE).toBe(3.0)
  })
})

describe('token source', () => {
  const t = loadTokens()

  it('produces one structured contrast report for the CLI and browser consumers', () => {
    const report = createContrastReport(t)

    expect(report).toMatchObject({ checked: 137, passed: true, violations: [] })
    expect(report.accentThemes).toEqual([
      { name: 'coral', checked: 14, failed: 0, passes: true },
      { name: 'sunset', checked: 14, failed: 0, passes: true },
      { name: 'teal', checked: 14, failed: 0, passes: true },
      { name: 'berry', checked: 14, failed: 0, passes: true },
    ])
    expect(report.constraints).toEqual(['warming.peak: text must be >=17px semibold'])
  })

  it('reports an accent violation with the shared WCAG threshold', () => {
    const changed = structuredClone(t)
    changed.accents.coral!.accentInk = '#ffffff'

    const report = createContrastReport(changed)
    const coral = report.accentThemes.find(({ name }) => name === 'coral')

    expect(report.passed).toBe(false)
    expect(coral).toMatchObject({ failed: 6, passes: false })
    expect(report.violations[0]).toMatchObject({
      pair: 'accent.coral.accentInk on surface.app',
      need: AA_BODY,
      passes: false,
      accentTheme: 'coral',
    })
  })

  it('loads all four accent themes', () => {
    expect(Object.keys(t.accents).sort()).toEqual(['berry', 'coral', 'sunset', 'teal'])
    expect(t.defaultAccent).toBe('coral')
  })

  it('gives every accent all three variants', () => {
    for (const [name, theme] of Object.entries(t.accents)) {
      expect(theme.accent, name).toMatch(/^#[0-9a-f]{6}$/i)
      expect(theme.accentInk, name).toMatch(/^#[0-9a-f]{6}$/i)
      expect(theme.accentOnDark, name).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('keeps accentInk darker than accent — that is the whole point of the split', () => {
    for (const [name, theme] of Object.entries(t.accents)) {
      const onApp = (hex: string): number => contrastRatio(hex, t.surface.app!)
      expect(onApp(theme.accentInk), `${name}: accentInk must out-contrast accent`).toBeGreaterThan(
        onApp(theme.accent),
      )
    }
  })

  it('makes every accentInk usable as body text', () => {
    for (const [name, theme] of Object.entries(t.accents)) {
      expect(ratio(theme.accentInk, t.surface.app!), name).toBeGreaterThanOrEqual(AA_BODY)
    }
  })

  it('strips the $comment documentation keys', () => {
    const hasDollar = (o: object): boolean => Object.keys(o).some((k) => k.startsWith('$'))
    expect(hasDollar(t.surface)).toBe(false)
    expect(hasDollar(t.accents)).toBe(false)
    expect(hasDollar(t.scale.mastery)).toBe(false)
    expect(hasDollar(t.scale.ladder)).toBe(false)
  })

  it('orders the ladder scale as a competence hierarchy', () => {
    expect(Object.keys(t.scale.ladder)).toEqual([
      'accumulated',
      'bent',
      'transferred',
      'pressureTested',
      'deployed',
    ])
  })

  it('orders the mastery scale', () => {
    expect(Object.keys(t.scale.mastery)).toEqual(['new', 'learning', 'strong', 'mastered'])
  })

  it('has four warming bands covering 0-100%', () => {
    expect(Object.keys(t.scale.warming)).toEqual(['cold', 'warm', 'hot', 'peak'])
    expect(t.scale.warming.peak!.bg).toContain('linear-gradient')
  })

  it('tints the primary CTA shadow with the accent, not grey', () => {
    // It is what makes the button feel warm rather than pasted on.
    expect(t.shadow.raised).toContain('159,60,22')
  })

  it('extracts the v1.3 Account method elevation recipes from the HTML', () => {
    expect(t.shadow.methodContact).toBe('0 2px 4px rgba(35,30,24,.03)')
    expect(t.shadow.methodFilled).toBe('0 2px 4px rgba(35,30,24,.08)')
    expect(t.shadow.methodSoft).toBe('0 1px 2px rgba(35,30,24,.05)')
    expect(t.shadow.methodInset).toBe('inset 0 2px 4px rgba(28,28,25,.05)')
    expect(t.shadow.accentGlow).toBe('0 2px 8px rgba(200,90,50,.15)')
    expect(t.shadow.accentGlowStrong).toBe('0 2px 8px rgba(200,90,50,.25)')
    expect(t.shadow.accentGlowStay).toBe('0 2px 6px rgba(200,90,50,.25)')
    expect(t.shadow.emblemSoft).toBe('0 1px 2px rgba(35,30,24,.05)')
    expect(t.shadow.emblemRaised).toBe('0 4px 6px rgba(35,30,24,.10), 0 2px 4px rgba(35,30,24,.10)')
    expect(t.shadow.headerHairline).toBe('0 1px 8px rgba(28,28,25,.04)')
    expect(t.shadow.playRaised).toBe('0 10px 15px rgba(35,30,24,.10), 0 4px 6px rgba(35,30,24,.10)')
    expect(t.shadow.dockFloat).toBe('0 8px 24px rgba(35,30,24,.30)')
    expect(t.shadow.queueSoft).toBe('0 1px 1px rgba(35,30,24,.05)')
    expect(t.shadow.playerFloat).toBe('0 25px 50px rgba(35,30,24,.25)')
    expect(t.shadow.playGlow).toBe('0 6px 18px rgba(191,84,44,.35)')
    expect(t.shadow.pillRing).toBe('0 0 0 2px rgba(255,219,208,.40)')
    expect(t.shadow.rateRing).toBe('0 0 0 2px rgba(255,219,208,1)')
  })

  it('keeps radius.lg at 12 — the workhorse', () => {
    expect(t.radius.lg).toBe(12)
  })

  it('loads the complete authored typography, motion, and layout token families', () => {
    expect(Object.keys(t.typography.family)).toEqual(['sans', 'serif'])
    expect(Object.keys(t.typography.scale)).toHaveLength(16)
    expect(t.typography.scale.display).toMatchObject({
      size: 48,
      sizeMax: 56,
      weight: 400,
      tracking: '-0.02em',
      lineHeight: 1.167,
    })
    expect(t.typography.scale.bodyMd).toMatchObject({
      size: 16,
      weight: 400,
      lineHeight: 1.5,
      family: 'sans',
    })
    expect(Object.keys(t.motion.animation)).toHaveLength(11)
    expect(Object.keys(t.motion.transition)).toHaveLength(9)
    expect(t.motion.press.icon).toEqual({
      scale: 0.82,
      duration: 130,
      opacity: 0.6,
    })
    expect(t.motion.touch).toMatchObject({ minTapTarget: 44, iconHitArea: 44 })
    expect(t.gutter).toEqual({ dense: 16, default: 20, roomy: 24 })
    expect(t.size.progressBar).toEqual({ thin: 4, default: 6, thick: 9, mastery: 12 })
    expect(t.size.sheetHandle).toEqual({ width: 42, height: 5 })
    expect(t.surface.track).toBe('#efece1')
    expect(t.surface.shadowInk).toBe('#231e18')
    expect(t.shadow.card).toContain('35,30,24')
    expect(t.shadow.interactive).toContain('4px 16px')
    expect(t.shadow.interactive).toContain('1px 3px')
  })
})

describe('generated targets', () => {
  const tokens = loadTokens()

  it('is stable when the source tokens do not change', () => {
    expect(generateOutputs(tokens)).toEqual(generateOutputs(tokens))
  })

  it('keeps committed generated files in sync with their source', () => {
    for (const [target, output] of Object.entries(generateOutputs(tokens))) {
      expect(readFileSync(new URL(`../out/${target}`, import.meta.url), 'utf8'), target).toBe(
        output,
      )
    }
  })

  it('drifts in every target when a shared source token changes', () => {
    const baseline = generateOutputs(tokens)
    const changed = structuredClone(tokens)
    changed.typography.scale.body!.size += 1
    const regenerated = generateOutputs(changed)

    for (const target of Object.keys(baseline)) {
      expect(regenerated[target], target).not.toBe(baseline[target])
    }
  })

  it('emits typography, motion, controls, and sheet geometry with cross-target parity', () => {
    const outputs = generateOutputs(tokens)
    const ts = outputs['tokens.ts']!
    const swift = outputs['Tokens.swift']!
    const kotlin = outputs['Tokens.kt']!

    expect(ts).toContain('export const typography = {')
    expect(ts).toContain('export const motion = {')
    expect(ts).toContain('minTapTarget: 44')
    expect(ts).toContain('mastery: 12')

    expect(swift).toContain('public static let size: CGFloat = 48')
    expect(kotlin).toContain('val size: TextUnit = 48.sp')
    expect(swift).toContain('public static let durationMs = 400')
    expect(kotlin).toContain('const val durationMs = 400')
    expect(swift).toContain('public static let scale: CGFloat = 0.82')
    expect(kotlin).toContain('const val scale = 0.82')
    expect(swift).toContain('public static let minTapTarget: CGFloat = 44')
    expect(kotlin).toContain('val minTapTarget: Dp = 44.dp')
    expect(swift).toContain('public static let bottomLeftRadius: CGFloat = 40')
    expect(kotlin).toContain('val bottomLeftRadius: Dp = 40.dp')
    expect(swift).toContain('public static let mastery: CGFloat = 12')
    expect(kotlin).toContain('val mastery: Dp = 12.dp')
  })
})
