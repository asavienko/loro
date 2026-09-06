/**
 * Component-level sizing tokens — the numbers the generated scale does not carry.
 *
 * `packages/design-tokens` owns colour, `space`, and `radius`; those are extracted from the
 * blueprint and regenerated. What lives here is the handful of measurements a COMPONENT
 * needs and the scale has no name for: the tap-target floor, the two border weights, the
 * corner on a 6-px bar.
 *
 * ── Values are named, never rounded ──
 * The blueprint's screens use 5, 7, 9, 11, 13, 14, 26, 30, 38, 42 — none of which are steps
 * on the `space` scale (4 / 8 / 12 / 16 / 20 / 24 and the halves). Snapping one of them to
 * the nearest step moves pixels, and `e2e/text-scale.spec.ts` asserts that nothing clips or
 * overflows at 200% and 310% text. So a value that is not on the scale gets a NAME here and
 * keeps its number. If a value has exactly one call site it stays in that component's own
 * `StyleSheet` instead — a token used once is not a token.
 *
 * This directory is exempt from the colour-literal lint rule (`eslint.config.mjs:147`), and
 * that exemption is for tokens that must spell a colour out. Nothing here needs to: every
 * colour still comes from `@loro/design-tokens`.
 */

import { motion } from '@loro/design-tokens'

/** Minimum tap target. WCAG 2.2 AA. Authored in the generated touch tokens. */
export const MIN_TAP = motion.touch.minTapTarget

/**
 * The slop `Pressable` adds outside every tappable box, on all four edges.
 *
 * Named because two places do arithmetic with it: `Pressable` applies it, and a control whose
 * drawn box is deliberately smaller than `MIN_TAP` — Today's 28-px spine band, its text rail —
 * has to know how much of the floor the slop already covers. `e2e/accessibility.spec.ts` adds
 * the same number back when it measures, which is the check those call sites answer to.
 */
export const HIT_SLOP = 8

/**
 * The two border weights in the app.
 *
 * `selected` is 1.5 wherever a control shows it is the chosen one — the difficulty cards,
 * the tag chips, the onboarding answers, Today's ready wave, the focused search field. It
 * is deliberately heavier than `hairline`, because the selected state must not be carried
 * by colour alone (`docs/architecture/accessibility.md`).
 */
export const border = {
  hairline: 1,
  selected: 1.5,
} as const

/**
 * The corner on a thin bar: progress fills, the sheet's grabber, the onboarding step strip,
 * the Refrain's effort bars. `radius.sm` is 8 — far too round for a 5-px-tall element.
 */
export const barRadius = 2
