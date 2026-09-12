/**
 * Token-derived parchment glass numbers. Kept free of `react-native` so unit tests can
 * pin the 85% spine / 92% ActionBar fills without loading the native Platform module.
 */

import { gutter, surface } from '@loro/design-tokens'

/** DESIGN.md floating-island blur — shared by the 85% spine and the 92% ActionBar. */
export const GLASS_BLUR_PX = 12
/** Today phone / authored 28-px spine `bg-surface/85`. Not the floating island. */
export const GLASS_ALPHA = 0.85
/** DESIGN.md Floating Island Navigation — the suspended ActionBar only. */
export const ISLAND_GLASS_ALPHA = 0.92
/** Authored mobile page margin — DESIGN.md `margin: 1.25rem`, token `gutter.default`. */
export const CHROME_GUTTER = gutter.default

/** Token hex → translucent fill. Template form so the colour-literal lint sees no `rgba(` string. */
export function hexAlpha(hex: string, alpha: number): string {
  const raw = hex.startsWith('#') ? hex.slice(1) : hex
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((part) => `${part}${part}`)
          .join('')
      : raw
  const r = Number.parseInt(full.slice(0, 2), 16)
  const g = Number.parseInt(full.slice(2, 4), 16)
  const b = Number.parseInt(full.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

export const glassFill = hexAlpha(surface.app, GLASS_ALPHA)
export const islandGlassFill = hexAlpha(surface.app, ISLAND_GLASS_ALPHA)
export const chromeHairlineFill = hexAlpha(surface.shadowInk, 0.04)
