/**
 * The bar and the pips.
 *
 * Progress's two bars are NOT here. The tricky-tag bar and the mastery stacked bar have one call
 * site each and belong to `TrickyRollup` and `MasteryBar` in the inventory
 * (`docs/design/component-inventory.md:79-80`); a shared "thin bar" primitive could not be adopted
 * by either without moving a pixel — see the report on plans/52.
 */

import { View } from 'react-native'
import { accent, barRadius, line, size } from '../theme'
import { Row } from './layout'

/**
 * A progress bar — either NAMED or invisible to assistive tech, never in between.
 *
 * `role="progressbar"` requires an accessible name, and every bar in the app was
 * announced as an unnamed one with a number. Which of the two is right depends on the
 * caller, and both cases are real here:
 *
 *   • `label` given — the bar carries the signal itself, like the Refrain's automaticity,
 *     which accessibility.md requires be "a progress bar with a percentage".
 *   • `label` omitted — the bar restates something the surrounding row already says. A
 *     Today row's own label is already "…, 0 percent automatic.", so a second unnamed
 *     announcement is noise, and the bar is hidden from the tree rather than left unnamed.
 */
export function ProgressBar({
  value,
  color = accent.accent,
  height = size.progressBar.default,
  track = line.default,
  radius = barRadius,
  label,
}: {
  /** 0..1 */
  value: number
  color?: string | undefined
  height?: number | undefined
  track?: string | undefined
  /**
   * The corner, on both track and fill. Defaults to `barRadius` (2), which is what every
   * announced bar in the app uses.
   *
   * It is a prop because Progress's "what's tricky" rows shipped with a fully-round `8` on a
   * 7px bar, and without this the only ways to reuse this primitive were to square those
   * corners or to leave the row hand-drawing a bar this component already draws. Neither is
   * acceptable: the first changes what a learner sees, the second is the duplication being
   * removed. See plans/52.
   */
  radius?: number | undefined
  label?: string | undefined
}) {
  const pct = Math.max(0, Math.min(1, value)) * 100
  const rounded = Math.round(pct)
  const semantics =
    label === undefined
      ? ({ 'aria-hidden': true, importantForAccessibility: 'no-hide-descendants' } as const)
      : ({
          accessible: true,
          accessibilityRole: 'progressbar',
          accessibilityLabel: label,
          // Both forms — see the note at the top of `./index.ts`. The nested
          // `accessibilityValue` is what a native reader reads and what
          // react-native-web silently drops, which is why every bar in the app
          // announced no value at all on web.
          accessibilityValue: { now: rounded, min: 0, max: 100, text: `${rounded}%` },
          'aria-valuenow': rounded,
          'aria-valuemin': 0,
          'aria-valuemax': 100,
          'aria-valuetext': `${rounded}%`,
        } as const)
  return (
    <View
      {...semantics}
      style={{ height, borderRadius: radius, backgroundColor: track, overflow: 'hidden' }}
    >
      <View
        style={{ width: `${pct}%`, height: '100%', borderRadius: radius, backgroundColor: color }}
      />
    </View>
  )
}

export function Dots({
  count,
  filled,
  size = 8,
}: {
  count: number
  filled: number
  size?: number | undefined
}) {
  return (
    <Row gap={DOT_GAP}>
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: i < filled ? accent.accent : line.default,
          }}
        />
      ))}
    </Row>
  )
}

const DOT_GAP = 5
