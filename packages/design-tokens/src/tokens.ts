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
  radius: Record<string, string | number>
  shadow: Record<string, string>
  type: Record<string, unknown>
  motion: Record<string, unknown>
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

export function loadTokens(): Tokens {
  const color = read('color.json')
  const accent = read('accent.json')
  const layout = read('layout.json')
  const typeJson = read('type.json')
  const motion = read('motion.json')

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
    space: strip(layout.space as Record<string, unknown>) as Record<string, number>,
    radius: Object.fromEntries(
      Object.entries(strip(layout.radius as Record<string, unknown>)).map(([k, v]) => [
        k,
        typeof v === 'object' && v !== null && 'value' in v
          ? (v as { value: string | number }).value
          : (v as string | number),
      ]),
    ),
    shadow: mapValues(layout.shadow as Record<string, unknown>),
    type: strip(typeJson),
    motion: strip(motion),
  }
}
