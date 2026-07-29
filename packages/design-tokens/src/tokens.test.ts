import { describe, expect, it } from 'vitest'
import { loadTokens } from './tokens.js'
import { contrastRatio, parseHex, passes, ratio, AA_BODY, AA_LARGE } from './contrast.js'

describe('contrast maths', () => {
  it('matches known WCAG values', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1)
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 3)
  })

  it('is symmetric', () => {
    expect(ratio('#bf5722', '#f6f2ea')).toBe(ratio('#f6f2ea', '#bf5722'))
  })

  it('parses shorthand hex', () => {
    expect(parseHex('#fff')).toEqual({ r: 255, g: 255, b: 255 })
    expect(parseHex('abc')).toEqual({ r: 170, g: 187, b: 204 })
  })

  it('rejects a non-colour', () => {
    expect(() => parseHex('not-a-colour')).toThrow(/hex/)
  })

  it('applies the right threshold per text size', () => {
    // Coral accent on the app surface: 4.0:1 — large text only.
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
    expect(t.shadow.raised).toContain('191,87,34')
  })

  it('keeps radius.lg at 12 — the workhorse', () => {
    expect(t.radius.lg).toBe(12)
  })
})
