/**
 * The design system, resolved for React Native.
 *
 * Colours come from the generated tokens — never a literal. The token NAMES encode
 * the accessibility rules: `accentInk` is the text colour, `accent` is for fills.
 * See ADR-0013 and docs/design/design-system.md
 */

import {
  accents,
  defaultAccent,
  gradient,
  gutter,
  ink,
  line,
  motion,
  onDark,
  radius,
  scale,
  semantic,
  shadow,
  size,
  space,
  surface,
  typography,
  type AccentName,
} from '@loro/design-tokens'
import type { MasteryBucket } from '@loro/core'
import type { TextStyle } from 'react-native'

export {
  surface,
  ink,
  line,
  semantic,
  scale,
  onDark,
  gradient,
  space,
  gutter,
  radius,
  shadow,
  size,
  typography,
  motion,
}

/**
 * The component-level tokens — sizing, borders, and each control's metrics.
 *
 * Re-exported here so this file stays the single front door to the design system: a screen
 * or a component imports `space` and `chip` from the same place. They live in
 * `src/ui/tokens/` because that directory is lint-exempt from the colour-literal rule and
 * because the generated set has no name for a 1.5-px border or an 11-px chip.
 */
export {
  HIT_SLOP,
  MIN_TAP,
  actionBar,
  barRadius,
  border,
  cardHeader,
  chip,
  difficultyCard,
  emptyState,
  field,
  grid,
  listRow,
  phraseRow,
  pillSize,
  sectionHeader,
  segmented,
  sheet,
  statRow,
  webLayout,
} from './tokens'

export type { AccentName }

/**
 * Generated default accent for pure style resolvers and routes not yet migrated to runtime themes.
 * Runtime-aware production components read `useTheme().accent` instead.
 */
export const accent = accents[defaultAccent as AccentName]

/** Type scale, as RN style objects. */
const weight = (value: number): TextStyle['fontWeight'] => String(value) as TextStyle['fontWeight']
const emToPixels = (value: string, fontSize: number, precision = 1): number =>
  Number((Number.parseFloat(value) * fontSize).toFixed(precision))
const trackingOf = (
  spec: { readonly tracking?: string; readonly size: number },
  precision = 1,
): number | undefined =>
  spec.tracking === undefined ? undefined : emToPixels(spec.tracking, spec.size, precision)
const fontFor = (family?: string): string =>
  family === 'serif' ? typography.family.serif.value : typography.family.sans.value

const lineBox = (size: number, ratio: number): number => Math.round(size * ratio)

export const type = {
  display: {
    fontFamily: fontFor(typography.scale.display.family),
    fontSize: typography.scale.display.size,
    fontWeight: weight(typography.scale.display.weight),
    letterSpacing: trackingOf(typography.scale.display, 0),
    lineHeight: lineBox(typography.scale.display.size, typography.scale.display.lineHeight),
  },
  hero: {
    fontFamily: fontFor(typography.scale.hero.family),
    fontSize: typography.scale.hero.size,
    fontWeight: weight(typography.scale.hero.weight),
    letterSpacing: trackingOf(typography.scale.hero),
    lineHeight: lineBox(typography.scale.hero.size, typography.scale.hero.lineHeight),
  },
  title1: {
    fontFamily: fontFor(typography.scale.title1.family),
    fontSize: typography.scale.title1.size,
    fontWeight: weight(typography.scale.title1.weight),
    letterSpacing: trackingOf(typography.scale.title1),
    lineHeight: Math.round(typography.scale.title1.size * typography.scale.title1.lineHeight),
  },
  title2: {
    fontFamily: fontFor(typography.scale.title2.family),
    fontSize: typography.scale.title2.size,
    fontWeight: weight(typography.scale.title2.weight),
    letterSpacing: trackingOf(typography.scale.title2),
    lineHeight: Math.round(typography.scale.title2.size * typography.scale.title2.lineHeight),
  },
  title3: {
    fontFamily: fontFor(typography.scale.title3.family),
    fontSize: typography.scale.title3.size,
    fontWeight: weight(typography.scale.title3.weight),
    letterSpacing: trackingOf(typography.scale.title3),
    lineHeight: Math.round(typography.scale.title3.size * typography.scale.title3.lineHeight),
  },
  headline: {
    fontFamily: fontFor(typography.scale.headline.family),
    fontSize: typography.scale.headline.size,
    fontWeight: weight(typography.scale.headline.weight),
    letterSpacing: trackingOf(typography.scale.headline),
    lineHeight: Math.round(typography.scale.headline.size * typography.scale.headline.lineHeight),
  },
  body: {
    fontFamily: fontFor(typography.scale.body.family),
    fontSize: typography.scale.body.size,
    fontWeight: weight(typography.scale.body.weight),
    letterSpacing: trackingOf(typography.scale.body),
    lineHeight: Math.round(typography.scale.body.size * typography.scale.body.lineHeight),
  },
  bodyMd: {
    fontFamily: fontFor(typography.scale.bodyMd.family),
    fontSize: typography.scale.bodyMd.size,
    fontWeight: weight(typography.scale.bodyMd.weight),
    lineHeight: Math.round(typography.scale.bodyMd.size * typography.scale.bodyMd.lineHeight),
  },
  bodySm: {
    fontFamily: fontFor(typography.scale.bodySm.family),
    fontSize: typography.scale.bodySm.size,
    fontWeight: weight(typography.scale.bodySm.weight),
    lineHeight: Math.round(typography.scale.bodySm.size * typography.scale.bodySm.lineHeight),
  },
  caption: {
    fontFamily: fontFor(typography.scale.caption.family),
    fontSize: typography.scale.caption.size,
    fontWeight: weight(typography.scale.caption.weight),
    lineHeight: Math.round(typography.scale.caption.size * typography.scale.caption.lineHeight),
  },
  captionSm: {
    fontFamily: fontFor(typography.scale.captionSm.family),
    fontSize: typography.scale.captionSm.size,
    fontWeight: weight(typography.scale.captionSm.weight),
    letterSpacing: trackingOf(typography.scale.captionSm),
    lineHeight: Math.round(typography.scale.captionSm.size * typography.scale.captionSm.lineHeight),
  },
  prose: {
    fontFamily: fontFor(typography.scale.prose.family),
    fontSize: typography.scale.prose.size,
    fontWeight: weight(typography.scale.prose.weight),
    lineHeight: Math.round(typography.scale.prose.size * typography.scale.prose.lineHeight),
  },
  label: {
    fontFamily: fontFor(typography.scale.label.family),
    fontSize: typography.scale.label.size,
    fontWeight: weight(typography.scale.label.weight),
    letterSpacing: emToPixels(typography.scale.label.tracking, typography.scale.label.size, 2),
    textTransform: typography.scale.label.transform,
  },
  labelSm: {
    fontFamily: fontFor(typography.scale.labelSm.family),
    fontSize: typography.scale.labelSm.size,
    fontWeight: weight(typography.scale.labelSm.weight),
    letterSpacing: emToPixels(typography.scale.labelSm.tracking, typography.scale.labelSm.size, 2),
    textTransform: typography.scale.labelSm.transform,
  },
} as const

/** A step on the type scale. `Text`'s `variant`. */
export type TypeVariant = keyof typeof type

/**
 * Difficulty palette, from the blueprint (`Loro.dc.html:2327-2331`).
 * Note the labels: "Learning" is a status; "Difficult" describes the phrase.
 */
export const difficultyMeta = {
  easy: {
    dot: semantic.success.text,
    bg: semantic.success.bg,
    border: semantic.success.border,
    color: semantic.success.text,
  },
  med: {
    dot: semantic.warn.text,
    bg: semantic.warn.bg,
    border: semantic.warn.border,
    color: semantic.warn.text,
  },
  hard: {
    dot: semantic.danger.text,
    bg: semantic.danger.bg,
    border: semantic.danger.border,
    color: semantic.danger.text,
  },
} as const

/** "What's tricky about it?" — the four tags. */
export const tagMeta = {
  pron: { color: semantic.info.text, bg: semantic.info.bg },
  remember: { color: semantic.violet.text, bg: semantic.violet.bg },
  useful: { color: semantic.warn.text, bg: semantic.warn.bg, emoji: '⭐' },
  words: {
    color: semantic.dangerAlt.text,
    bg: semantic.danger.bg,
    emoji: '🔤',
  },
} as const

/** The warming scale — the Refrain card's four bands. THE core feedback signal. */
export const warming = scale.warming

/** Mastery buckets, for the Progress screen. */
export const masteryMeta = {
  new: { color: scale.mastery.new },
  learning: { color: scale.mastery.learning },
  strong: { color: scale.mastery.strong },
  mastered: { color: scale.mastery.mastered },
} as const satisfies Record<MasteryBucket, { readonly color: string }>

/**
 * Press feedback. Every interactive element scales — nothing in this app is
 * tappable without physical feedback. See docs/design/motion.md
 */
export const press = {
  row: motion.press.row.scale,
  button: motion.press.button.scale,
  smallButton: motion.press.smallButton.scale,
  icon: motion.press.icon.scale,
} as const
