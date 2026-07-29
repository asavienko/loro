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
