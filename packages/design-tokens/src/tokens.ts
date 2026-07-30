/**
 * Loads the token JSON and exposes it in a typed, flattened shape.
 *
 * The JSON is the source of truth (reviewable in a diff, extracted from the
 * blueprint); this module is the only place that knows its shape.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const tokensDir = join(here, '..', 'tokens')

const read = (name: string): Record<string, unknown> =>
  JSON.parse(readFileSync(join(tokensDir, name), 'utf8')) as Record<string, unknown>

export interface AccentTheme {
  label: string
  accent: string
  accentInk: string
  accentOnDark: string
  /**
   * The solid tinted wash — soft pill and card backgrounds. Per-theme, because a
   * coral wash under the teal accent is the kind of thing nobody notices until it
   * ships. Pair with `accentInk`; the contrast gate checks exactly that pairing.
   */
  wash: string
  /** Alpha overlays of the accent: selected, pressed, and soft borders. */
  tint: string
  tint2: string
  tintBorder: string
}

export interface TypographyFamily {
  value: string
  weights: number[]
  style?: string
  use: string | string[]
}

export interface TypographyStyle {
  size: number
  sizeMax?: number
  weight: number
  tracking?: string
  lineHeight?: number
  transform?: string
  family?: string
  style?: string
  variant?: string
  use: string
}

export interface TypographyTokens {
  family: Record<string, TypographyFamily>
  scale: Record<string, TypographyStyle>
  rules: string[]
}

export interface MotionStep {
  duration?: number
  stepMs?: number
  totalMs?: number
  range?: number[]
  easing?: string
  reducedMotion?: string
  properties?: string[]
  loop?: boolean
  stagger?: number
  use?: string
  note?: string
}

export interface PressFeedback {
  scale: number
  duration: number
  backgroundShift?: boolean
  brightness?: number
  opacity?: number
  shadow?: boolean
}

export interface MotionTokens {
  easing: Record<string, { value: string; use: string }>
  animation: Record<string, MotionStep>
  transition: Record<string, MotionStep>
  press: Record<string, PressFeedback | string>
  audioTiming: Record<string, { value: number; note: string }>
  touch: {
    minTapTarget: number
    iconHitArea: number
    tapHighlight: string
    touchAction: string
    userSelect: string
  }
}

export interface LayoutSizeTokens {
  emojiTile: Record<string, number>
  micButton: Record<string, number>
  scoreRing: number
  sheetHandle: { width: number; height: number }
  progressBar: Record<string, number>
  chartHeight: number
  waveformBars: number
  contourPoints: number
}

export interface Tokens {
  surface: Record<string, string>
  ink: Record<string, string>
  line: Record<string, string>
  semantic: Record<string, { text: string; bg?: string; border?: string }>
  scale: {
    mastery: Record<string, string>
    ladder: Record<string, string>
    confidence: Record<string, string>
    warming: Record<string, { bg: string; text: string; glow: string; range: string }>
  }
  onDark: Record<string, string>
  gradient: Record<string, string>
  accents: Record<string, AccentTheme>
  defaultAccent: string
  space: Record<string, number>
  gutter: Record<string, number>
  radius: Record<string, string | number>
  shadow: Record<string, string>
  size: LayoutSizeTokens
  typography: TypographyTokens
  motion: MotionTokens
}

/** Strip the `$comment`/`$…` documentation keys the JSON carries. */
function strip<T extends Record<string, unknown>>(o: T): T {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(o)) {
    if (k.startsWith('$')) continue
    out[k] = v
  }
  return out as T
}

/** `{ value: '#fff', … }` or `'#fff'` → `'#fff'`. */
function value(v: unknown): string {
  if (typeof v === 'string') return v
  if (v !== null && typeof v === 'object' && 'value' in v) return String(v.value)
  throw new Error(`token has no value: ${JSON.stringify(v)}`)
}

function mapValues(o: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(Object.entries(strip(o)).map(([k, v]) => [k, value(v)]))
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${path} must be an object`)
  }
  return value as Record<string, unknown>
}

function validateNumberMap(value: unknown, path: string): Record<string, number> {
  const source = strip(record(value, path))
  for (const [key, item] of Object.entries(source)) {
    if (typeof item !== 'number') throw new Error(`${path}.${key} must be a number`)
  }
  return source as Record<string, number>
}

function validateTypography(value: Record<string, unknown>): TypographyTokens {
  const family = strip(record(value.family, 'type.family')) as Record<string, TypographyFamily>
  const scale = strip(record(value.scale, 'type.scale')) as Record<string, TypographyStyle>
  const rules = value.rules

  for (const [key, token] of Object.entries(family)) {
    if (
      typeof token.value !== 'string' ||
      !Array.isArray(token.weights) ||
      !token.weights.every((weight) => typeof weight === 'number')
    ) {
      throw new Error(`type.family.${key} has an invalid value or weights`)
    }
  }
  for (const [key, token] of Object.entries(scale)) {
    if (typeof token.size !== 'number' || typeof token.weight !== 'number') {
      throw new Error(`type.scale.${key} has an invalid size or weight`)
    }
  }
  if (!Array.isArray(rules) || !rules.every((rule) => typeof rule === 'string')) {
    throw new Error('type.rules must be an array of strings')
  }
  return { family, scale, rules }
}

function validateMotion(value: Record<string, unknown>): MotionTokens {
  const easing = strip(record(value.easing, 'motion.easing')) as MotionTokens['easing']
  const animation = strip(record(value.animation, 'motion.animation')) as MotionTokens['animation']
  const transition = strip(
    record(value.transition, 'motion.transition'),
  ) as MotionTokens['transition']
  const press = strip(record(value.press, 'motion.press')) as MotionTokens['press']
  const audioTiming = strip(
    record(value.audioTiming, 'motion.audioTiming'),
  ) as MotionTokens['audioTiming']
  const touch = record(value.touch, 'motion.touch') as unknown as MotionTokens['touch']

  for (const [key, token] of Object.entries(easing)) {
    if (typeof token.value !== 'string')
      throw new Error(`motion.easing.${key}.value must be a string`)
  }
  for (const [groupName, group] of [
    ['animation', animation],
    ['transition', transition],
  ] as const) {
    for (const [key, token] of Object.entries(group)) {
      if (token.duration === undefined && token.stepMs === undefined) {
        throw new Error(`motion.${groupName}.${key} must define duration or stepMs`)
      }
    }
  }
  for (const [key, token] of Object.entries(audioTiming)) {
    if (typeof token.value !== 'number') {
      throw new Error(`motion.audioTiming.${key}.value must be a number`)
    }
  }
  if (typeof touch.minTapTarget !== 'number' || typeof touch.iconHitArea !== 'number') {
    throw new Error('motion.touch targets must be numbers')
  }
  return { easing, animation, transition, press, audioTiming, touch }
}

function validateSize(value: unknown): LayoutSizeTokens {
  const size = strip(record(value, 'layout.size'))
  const sheetHandle = record(size.sheetHandle, 'layout.size.sheetHandle')
  const scalarKeys = ['scoreRing', 'chartHeight', 'waveformBars', 'contourPoints'] as const
  for (const key of scalarKeys) {
    if (typeof size[key] !== 'number') throw new Error(`layout.size.${key} must be a number`)
  }
  if (typeof sheetHandle.width !== 'number' || typeof sheetHandle.height !== 'number') {
    throw new Error('layout.size.sheetHandle width and height must be numbers')
  }
  return {
    emojiTile: validateNumberMap(size.emojiTile, 'layout.size.emojiTile'),
    micButton: validateNumberMap(size.micButton, 'layout.size.micButton'),
    scoreRing: size.scoreRing as number,
    sheetHandle: sheetHandle as unknown as LayoutSizeTokens['sheetHandle'],
    progressBar: validateNumberMap(size.progressBar, 'layout.size.progressBar'),
    chartHeight: size.chartHeight as number,
    waveformBars: size.waveformBars as number,
    contourPoints: size.contourPoints as number,
  }
}

export function loadTokens(): Tokens {
  const color = read('color.json')
  const accent = read('accent.json')
  const layout = read('layout.json')
  const typeJson = read('type.json')
  const motionJson = read('motion.json')

  const scale = strip(color.scale as Record<string, unknown>)
  const themes = strip(accent.themes as Record<string, unknown>)
  const tints = strip(accent.tints as Record<string, unknown>)
  const alphaOf = (key: string): number => {
    const spec = tints[key] as { alpha?: number } | undefined
    if (spec?.alpha === undefined) throw new Error(`accent.json tints.${key} has no alpha`)
    return spec.alpha
  }
  const washes = strip((tints.wash ?? {}) as Record<string, unknown>) as Record<string, string>
  const [tintA, tint2A, borderA] = [alphaOf('tint'), alphaOf('tint2'), alphaOf('border')]
  /** `#rrggbb` + alpha → `rgba(r,g,b,a)`; RN has no 8-digit-hex support on Android. */
  const rgba = (hex: string, a: number): string => {
    const h = hex.replace('#', '')
    const c = (i: number): number => parseInt(h.slice(i, i + 2), 16)
    return `rgba(${c(0)},${c(2)},${c(4)},${a})`
  }

  return {
    surface: mapValues(color.surface as Record<string, unknown>),
    ink: mapValues(color.ink as Record<string, unknown>),
    line: mapValues(color.line as Record<string, unknown>),
    semantic: Object.fromEntries(
      Object.entries(strip(color.semantic as Record<string, unknown>)).map(([k, v]) => {
        const f = v as { text: string; bg?: string; border?: string }
        return [
          k,
          {
            text: f.text,
            ...(f.bg ? { bg: f.bg } : {}),
            ...(f.border ? { border: f.border } : {}),
          },
        ]
      }),
    ),
    scale: {
      mastery: strip(scale.mastery as Record<string, unknown>) as Record<string, string>,
      ladder: strip(scale.ladder as Record<string, unknown>) as Record<string, string>,
      confidence: strip(scale.confidence as Record<string, unknown>) as Record<string, string>,
      warming: strip(scale.warming as Record<string, unknown>) as Tokens['scale']['warming'],
    },
    onDark: strip(color.onDark as Record<string, unknown>) as Record<string, string>,
    gradient: strip(color.gradient as Record<string, unknown>) as Record<string, string>,
    accents: Object.fromEntries(
      Object.entries(themes).map(([k, v]) => {
        const t = v as Record<string, unknown>
        const base = value(t.accent)
        const wash = washes[k]
        if (wash === undefined) {
          throw new Error(`accent '${k}' has no tints.wash — every theme needs its own`)
        }
        return [
          k,
          {
            label: String(t.label),
            accent: base,
            accentInk: value(t.accentInk),
            accentOnDark: value(t.accentOnDark),
            wash,
            tint: rgba(base, tintA),
            tint2: rgba(base, tint2A),
            tintBorder: rgba(base, borderA),
          },
        ]
      }),
    ),
    defaultAccent: String(accent.default),
    space: validateNumberMap(layout.space, 'layout.space'),
    gutter: validateNumberMap(layout.gutter, 'layout.gutter'),
    radius: Object.fromEntries(
      Object.entries(strip(layout.radius as Record<string, unknown>)).map(([k, v]) => [
        k,
        typeof v === 'object' && v !== null && 'value' in v
          ? (v as { value: string | number }).value
          : (v as string | number),
      ]),
    ),
    shadow: mapValues(layout.shadow as Record<string, unknown>),
    size: validateSize(layout.size),
    typography: validateTypography(strip(typeJson)),
    motion: validateMotion(strip(motionJson)),
  }
}
