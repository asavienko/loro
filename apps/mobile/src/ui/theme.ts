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
  ink,
  line,
  onDark,
  radius,
  scale,
  semantic,
  shadow,
  space,
  surface,
  type AccentName,
} from '@loro/design-tokens'

export { surface, ink, line, semantic, scale, onDark, gradient, space, radius, shadow }

export type { AccentName }

/** The active accent. Learner-selectable in v1.1; Coral until then. */
export const accent = accents[defaultAccent as AccentName]

/** Type scale, as RN style objects. */
export const type = {
  display: { fontSize: 62, fontWeight: '700', letterSpacing: -2, lineHeight: 62 },
  hero: { fontSize: 46, fontWeight: '700', letterSpacing: -1.4, lineHeight: 48 },
  title1: { fontSize: 26, fontWeight: '700', letterSpacing: -0.3, lineHeight: 31 },
  title2: { fontSize: 22, fontWeight: '700', letterSpacing: -0.2, lineHeight: 27 },
  title3: { fontSize: 20, fontWeight: '700', letterSpacing: -0.2, lineHeight: 24 },
  headline: { fontSize: 18, fontWeight: '700', letterSpacing: -0.2, lineHeight: 23 },
  body: { fontSize: 15, fontWeight: '700', lineHeight: 21 },
  bodySm: { fontSize: 14, fontWeight: '700', lineHeight: 20 },
  caption: { fontSize: 13, fontWeight: '600', lineHeight: 19 },
  captionSm: { fontSize: 12, fontWeight: '600', lineHeight: 17 },
  prose: { fontSize: 14, fontWeight: '400', lineHeight: 22 },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.44,
    textTransform: 'uppercase',
  },
  labelSm: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
} as const

/**
 * Difficulty palette, from the blueprint (`Loro.dc.html:2327-2331`).
 * Note the labels: "Learning" is a status; "Difficult" describes the phrase.
 */
export const difficultyMeta = {
  easy: {
    label: 'Easy',
    dot: semantic.success.text,
    bg: semantic.success.bg,
    border: semantic.success.border,
    color: semantic.success.text,
  },
  med: {
    label: 'Learning',
    dot: semantic.warn.text,
    bg: semantic.warn.bg,
    border: semantic.warn.border,
    color: semantic.warn.text,
  },
  hard: {
    label: 'Difficult',
    dot: semantic.danger.text,
    bg: semantic.danger.bg,
    border: semantic.danger.border,
    color: semantic.danger.text,
  },
} as const

/** "What's tricky about it?" — the four tags. */
export const tagMeta = {
  pron: { label: 'Pronunciation', color: semantic.info.text, bg: semantic.info.bg },
  remember: { label: 'Hard to remember', color: semantic.violet.text, bg: semantic.violet.bg },
  useful: { label: 'Very useful', color: semantic.warn.text, bg: semantic.warn.bg, emoji: '⭐' },
  words: {
    label: 'Tricky words',
    color: semantic.dangerAlt.text,
    bg: semantic.danger.bg,
    emoji: '🔤',
  },
} as const

/** The warming scale — the Refrain card's four bands. THE core feedback signal. */
export const warming = scale.warming

/** Mastery buckets, for the Progress screen. */
export const masteryMeta = [
  { key: 'new', label: 'New', color: scale.mastery.new },
  { key: 'learning', label: 'Learning', color: scale.mastery.learning },
  { key: 'strong', label: 'Strong', color: scale.mastery.strong },
  { key: 'mastered', label: 'Mastered', color: scale.mastery.mastered },
] as const

/**
 * Press feedback. Every interactive element scales — nothing in this app is
 * tappable without physical feedback. See docs/design/motion.md
 */
export const press = {
  row: 0.988,
  button: 0.98,
  smallButton: 0.9,
  icon: 0.82,
} as const

/** Minimum tap target. WCAG 2.2 AA. */
export const MIN_TAP = 44
