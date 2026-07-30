/**
 * `Pill` — a small uppercase label on a tinted background. Static: a pill you can tap is a
 * `Chip`.
 *
 * ── Why it has variants ──
 * `practice/stream.tsx` used to define a SECOND, incompatible `Pill` beside this one
 * (diagnosed in plans/48 §3a, executed in plans/52). The two differed in exactly two ways:
 * one pixel of horizontal padding, and `alignSelf`. That second one is the load-bearing one
 * — `alignSelf: 'flex-start'` makes a pill hug its own text in a column, and breaks the
 * vertical centring of a pill that sits INSIDE a row. So the variants are named for where
 * the pill sits, and both call sites are served by this component.
 */

import { StyleSheet, View } from 'react-native'
import { ink, pill, radius, surface } from '../theme'
import { Text } from './Text'

export function Pill({
  label,
  color = ink.muted,
  background = surface.sunken,
  variant = 'standalone',
}: {
  label: string
  color?: string | undefined
  background?: string | undefined
  /**
   * `standalone` sits on its own and hugs its text. `inline` rides the vertical centring of
   * the row it is in. `compact` is the tightest — Today's `Locked` badge.
   */
  variant?: keyof typeof pill | undefined
}) {
  return (
    <View style={[s.base, s[variant], { backgroundColor: background }]}>
      <Text variant="labelSm" color={color}>
        {label}
      </Text>
    </View>
  )
}

const s = StyleSheet.create({
  base: { borderRadius: radius.sm },
  standalone: pill.standalone,
  inline: pill.inline,
  compact: pill.compact,
})
