/**
 * WCAG 2.2 contrast maths, and the rules Loro's warm low-contrast palette needs.
 *
 * The palette sits near the AA boundary by design, so this is a build gate rather
 * than an audit. See ADR-0013 and docs/architecture/accessibility.md#contrast-audit
 */

export interface Rgb {
  r: number
  g: number
  b: number
}

export function parseHex(hex: string): Rgb {
  const h = hex.replace('#', '').trim()
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h
  if (!/^[0-9a-fA-F]{6}$/.test(full)) throw new Error(`not a hex colour: ${hex}`)
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  }
}

/** WCAG relative luminance. */
export function luminance({ r, g, b }: Rgb): number {
  const channel = (v: number): number => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** Contrast ratio, 1..21. */
export function contrastRatio(fg: string, bg: string): number {
  const a = luminance(parseHex(fg))
  const b = luminance(parseHex(bg))
  const [hi, lo] = a > b ? [a, b] : [b, a]
  return (hi + 0.05) / (lo + 0.05)
}

export const AA_BODY = 4.5
export const AA_LARGE = 3.0

export type TextSize = 'body' | 'large'

export function passes(fg: string, bg: string, size: TextSize): boolean {
  return contrastRatio(fg, bg) >= (size === 'body' ? AA_BODY : AA_LARGE)
}

/** Round to 2dp for reporting. */
export function ratio(fg: string, bg: string): number {
  return Math.round(contrastRatio(fg, bg) * 100) / 100
}

interface ContrastAccent {
  readonly accent: string
  readonly accentInk: string
  readonly accentOnDark: string
  readonly wash: string
}

interface ContrastSemanticFamily {
  readonly text: string
  readonly bg?: string
}

interface ContrastWarmingBand {
  readonly bg: string
  readonly text: string
  readonly textSizeFloor?: string
}

/** The browser-safe subset of generated tokens used by the contrast gate. */
export interface ContrastTokens {
  readonly surface: Readonly<Record<string, string>>
  readonly ink: Readonly<Record<string, string>>
  readonly semantic: Readonly<Record<string, ContrastSemanticFamily>>
  readonly accents: Readonly<Record<string, ContrastAccent>>
  readonly onDark: Readonly<Record<string, string>>
  readonly scale: {
    readonly warming: Readonly<Record<string, ContrastWarmingBand>>
    readonly mastery: Readonly<Record<string, string>>
    readonly ladder: Readonly<Record<string, string>>
    readonly confidence: Readonly<Record<string, string>>
  }
}

export interface ContrastPairResult {
  readonly pair: string
  readonly got: number
  readonly need: number
  readonly note: string
  readonly passes: boolean
  /** Present when the pairing belongs to one runtime-selectable accent theme. */
  readonly accentTheme?: string
}

export interface AccentContrastResult {
  readonly name: string
  readonly checked: number
  readonly failed: number
  readonly passes: boolean
}

export interface ContrastReport {
  readonly pairings: readonly ContrastPairResult[]
  readonly violations: readonly ContrastPairResult[]
  readonly constraints: readonly string[]
  readonly accentThemes: readonly AccentContrastResult[]
  readonly checked: number
  readonly passed: boolean
}

/**
 * Evaluate every foreground/background pairing rendered by the app.
 *
 * This function deliberately has no Node imports so the CLI, mobile app, and browser workbench all
 * consume one set of WCAG thresholds and pairing definitions.
 */
export function createContrastReport(t: ContrastTokens): ContrastReport {
  const pairings: ContrastPairResult[] = []
  const constraints: string[] = []

  const requiredSurface = (name: string): string => {
    const hex = t.surface[name]
    if (hex === undefined) throw new Error(`missing required surface token 'surface.${name}'`)
    return hex
  }
  const appBg = requiredSurface('app')
  const surfaces: readonly (readonly [string, string])[] = [
    ['surface.app', appBg],
    ['surface.card', requiredSurface('card')],
    ['surface.sunken', requiredSurface('sunken')],
    ['surface.sunken2', requiredSurface('sunken2')],
  ]

  const check = (
    foregroundName: string,
    foreground: string,
    backgroundName: string,
    background: string,
    minimum: number,
    note = '',
    accentTheme?: string,
  ): void => {
    const got = ratio(foreground, background)
    pairings.push({
      pair: `${foregroundName} on ${backgroundName}`,
      got,
      need: minimum,
      note,
      passes: got >= minimum,
      ...(accentTheme === undefined ? {} : { accentTheme }),
    })
  }

  for (const [backgroundName, background] of surfaces) {
    for (const [name, foreground] of Object.entries(t.ink)) {
      const minimum = name === 'muted2' || name === 'muted3' ? AA_LARGE : AA_BODY
      check(
        `ink.${name}`,
        foreground,
        backgroundName,
        background,
        minimum,
        minimum === AA_LARGE ? 'large text / non-text only' : '',
      )
    }
  }

  for (const [name, family] of Object.entries(t.semantic)) {
    check(`semantic.${name}.text`, family.text, 'surface.app', appBg, AA_BODY)
    if (family.bg !== undefined) {
      check(`semantic.${name}.text`, family.text, `semantic.${name}.bg`, family.bg, AA_BODY)
    }

    const base = /^(.*?)(Alt|Meta)$/.exec(name)?.[1]
    const baseBackground = base === undefined ? undefined : t.semantic[base]?.bg
    if (base !== undefined && baseBackground !== undefined) {
      check(`semantic.${name}.text`, family.text, `semantic.${base}.bg`, baseBackground, AA_BODY)
    }
  }

  for (const [key, theme] of Object.entries(t.accents)) {
    const themeSurfaces: readonly (readonly [string, string])[] = [
      ...surfaces,
      [`accent.${key}.wash`, theme.wash],
    ]
    for (const [backgroundName, background] of themeSurfaces) {
      check(
        `accent.${key}.accentInk`,
        theme.accentInk,
        backgroundName,
        background,
        AA_BODY,
        'text on light',
        key,
      )
      check(
        `accent.${key}.accent`,
        theme.accent,
        backgroundName,
        background,
        AA_LARGE,
        'fills / >=17px semibold only',
        key,
      )
    }
    check(
      'white',
      '#ffffff',
      `accent.${key}.accent`,
      theme.accent,
      AA_LARGE,
      'button labels >=17px semibold',
      key,
    )
    check(`accent.${key}.accentOnDark`, theme.accentOnDark, 'darkCard', '#141310', AA_BODY, '', key)
  }

  for (const [name, foreground] of Object.entries(t.onDark)) {
    if (foreground.startsWith('rgba')) continue
    const minimum = name === 'muted' ? AA_LARGE : AA_BODY
    check(`onDark.${name}`, foreground, 'darkCard', '#141310', minimum)
    check(`onDark.${name}`, foreground, 'surface.dark', requiredSurface('dark'), minimum)
  }

  for (const [band, spec] of Object.entries(t.scale.warming)) {
    const background = spec.bg.startsWith('linear-gradient')
      ? (/#[0-9a-f]{6}/i.exec(spec.bg.split(',').slice(1).join(','))?.[0] ?? '#ffffff')
      : spec.bg
    const minimum = spec.textSizeFloor === 'large' ? AA_LARGE : AA_BODY
    check(
      `warming.${band}.text`,
      spec.text,
      `warming.${band}.bg`,
      background,
      minimum,
      spec.textSizeFloor === undefined ? '' : 'large-text-only band',
    )
    if (spec.textSizeFloor === 'large') {
      constraints.push(`warming.${band}: text must be >=17px semibold`)
    }
  }

  for (const group of ['mastery', 'ladder', 'confidence'] as const) {
    for (const [name, foreground] of Object.entries(t.scale[group])) {
      check(`scale.${group}.${name}`, foreground, 'surface.app', appBg, AA_LARGE, 'bar/pip fill')
    }
  }

  const violations = pairings.filter((pairing) => !pairing.passes)
  const accentThemes = Object.keys(t.accents).map((name) => {
    const themePairings = pairings.filter((pairing) => pairing.accentTheme === name)
    const failed = themePairings.filter((pairing) => !pairing.passes).length
    return { name, checked: themePairings.length, failed, passes: failed === 0 }
  })

  return {
    pairings,
    violations,
    constraints,
    accentThemes,
    checked: pairings.length,
    passed: violations.length === 0,
  }
}
