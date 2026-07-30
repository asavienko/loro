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
  MIN_TAP,
  actionBar,
  barRadius,
  border,
  cardHeader,
  chip,
  difficultyCard,
  emptyState,
  grid,
  phraseRow,
  pillSize,
  sectionHeader,
  segmented,
  sheet,
  statRow,
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
/**
 * Established React Native line boxes for the two oversized styles. Applying the authored web
 * ratios here would change display from 62 to 56 and hero from 48 to 46 pixels, so they remain
 * explicit platform tokens until a visual-change plan can migrate them with screenshot evidence.
 */
const rnOversizedLineHeight = {
  display: typography.scale.display.size,
  hero: 48,
} as const

export const type = {
  display: {
    fontSize: typography.scale.display.size,
    fontWeight: weight(typography.scale.display.weight),
    letterSpacing: emToPixels(typography.scale.display.tracking, typography.scale.display.size, 0),
    lineHeight: rnOversizedLineHeight.display,
  },
  hero: {
    fontSize: typography.scale.hero.size,
    fontWeight: weight(typography.scale.hero.weight),
    letterSpacing: emToPixels(typography.scale.hero.tracking, typography.scale.hero.size),
    lineHeight: rnOversizedLineHeight.hero,
  },
  title1: {
    fontSize: typography.scale.title1.size,
    fontWeight: weight(typography.scale.title1.weight),
    letterSpacing: emToPixels(typography.scale.title1.tracking, typography.scale.title1.size),
    lineHeight: Math.round(typography.scale.title1.size * typography.scale.title1.lineHeight),
  },
  title2: {
    fontSize: typography.scale.title2.size,
    fontWeight: weight(typography.scale.title2.weight),
    letterSpacing: emToPixels(typography.scale.title2.tracking, typography.scale.title2.size),
    lineHeight: Math.round(typography.scale.title2.size * typography.scale.title2.lineHeight),
  },
  title3: {
    fontSize: typography.scale.title3.size,
    fontWeight: weight(typography.scale.title3.weight),
    letterSpacing: emToPixels(typography.scale.title3.tracking, typography.scale.title3.size),
    lineHeight: Math.round(typography.scale.title3.size * typography.scale.title3.lineHeight),
  },
  headline: {
    fontSize: typography.scale.headline.size,
    fontWeight: weight(typography.scale.headline.weight),
    letterSpacing: emToPixels(typography.scale.headline.tracking, typography.scale.headline.size),
    lineHeight: Math.round(typography.scale.headline.size * typography.scale.headline.lineHeight),
  },
  body: {
    fontSize: typography.scale.body.size,
    fontWeight: weight(typography.scale.body.weight),
    lineHeight: Math.round(typography.scale.body.size * typography.scale.body.lineHeight),
  },
  bodySm: {
    fontSize: typography.scale.bodySm.size,
    fontWeight: weight(typography.scale.bodySm.weight),
    lineHeight: Math.round(typography.scale.bodySm.size * typography.scale.bodySm.lineHeight),
  },
  caption: {
    fontSize: typography.scale.caption.size,
    fontWeight: weight(typography.scale.caption.weight),
    lineHeight: Math.round(typography.scale.caption.size * typography.scale.caption.lineHeight),
  },
  captionSm: {
    fontSize: typography.scale.captionSm.size,
    fontWeight: weight(typography.scale.captionSm.weight),
    lineHeight: Math.round(typography.scale.captionSm.size * typography.scale.captionSm.lineHeight),
  },
  prose: {
    fontSize: typography.scale.prose.size,
    fontWeight: weight(typography.scale.prose.weight),
    lineHeight: Math.round(typography.scale.prose.size * typography.scale.prose.lineHeight),
  },
  label: {
    fontSize: typography.scale.label.size,
    fontWeight: weight(typography.scale.label.weight),
    letterSpacing: emToPixels(typography.scale.label.tracking, typography.scale.label.size, 2),
    textTransform: typography.scale.label.transform,
  },
  labelSm: {
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
