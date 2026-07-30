/**
 * The bars and pips: `ProgressBar` (announced), `ValueBar` (drawn only), `Dots`.
 */

import { View } from 'react-native'
import { accent, barRadius, line, radius, surface } from '../theme'
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
  height = 6,
  track = line.default,
  label,
}: {
  /** 0..1 */
  value: number
  color?: string | undefined
  height?: number | undefined
  track?: string | undefined
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
      style={{ height, borderRadius: barRadius, backgroundColor: track, overflow: 'hidden' }}
    >
      <View
        style={{ width: `${pct}%`, height: '100%', borderRadius: barRadius, backgroundColor: color }}
      />
    </View>
  )
}

export interface ValueBarSegment {
  key: string
  /** A share of the whole. The segments of one bar are expected to SUM TO 1. */
  portion: number
  color: string
}

/**
 * A thin bar that is DRAWN, not announced — a rounder, chunkier shape than `ProgressBar`,
 * and with no accessibility semantics of its own.
 *
 * That is the point of it being separate: both of its call sites already carry their number
 * in words. Progress's tricky rows put the count in the row's label ("Pronunciation, 12
 * phrases"), and the mastery bar has a `ChartSummary` beside it, which accessibility.md
 * requires and CI checks. A second, unnamed `progressbar` node in either place would
 * announce a bare number twice.
 *
 * ── Why two sizing modes and not one ──
 * `value` renders ONE fill as a percentage width; `segments` renders several as flex ratios.
 * They are not interchangeable: Yoga normalises `flex` by the SUM of its siblings' grow
 * factors, so a single child with `flex: 0.4` fills the whole track rather than 40% of it.
 * A percentage cannot express a stack that must add up, and a flex ratio cannot express a
 * single fill. Pass one or the other.
 */
export function ValueBar({
  value,
  color,
  segments,
  height,
  radius: corner = radius.sm,
  track = surface.sunken,
}: {
  /** 0..1 — a single fill. Mutually exclusive with `segments`. */
  value?: number | undefined
  color?: string | undefined
  /** A stack that sums to 1. Mutually exclusive with `value`. */
  segments?: readonly ValueBarSegment[] | undefined
  height: number
  radius?: number | undefined
  track?: string | undefined
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        height,
        borderRadius: corner,
        backgroundColor: track,
        overflow: 'hidden',
      }}
    >
      {segments?.map((seg) => (
        <View key={seg.key} style={{ flex: seg.portion, backgroundColor: seg.color }} />
      ))}
      {value !== undefined && color !== undefined && (
        <View
          style={{
            width: `${Math.max(0, Math.min(1, value)) * 100}%`,
            height: '100%',
            backgroundColor: color,
          }}
        />
      )}
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
