/**
 * The flex helpers: `Row`, `Stack`, `Grid`.
 *
 * `Row` defaults to `alignItems: 'center'`, which is right for a row of text and controls and
 * WRONG for a row of bars: a child with no height of its own centres at zero height instead of
 * stretching. That is also why `Grid` is not `Row wrap` — see its note.
 */

import type { ReactNode } from 'react'
import { View, type StyleProp, type ViewStyle } from 'react-native'
import { grid, space } from '../theme'

export function Row({
  gap = space['2'],
  align = 'center',
  justify,
  wrap = false,
  children,
  style,
}: {
  gap?: number | undefined
  align?: ViewStyle['alignItems']
  justify?: ViewStyle['justifyContent']
  /**
   * Let the row grow DOWNWARD instead of pushing its last child off the right edge.
   *
   * Load-bearing, not cosmetic. The stream's re-rating row and phrase detail's status row both
   * carry it because at a large font scale the trailing button must drop to the next line rather
   * than off the screen, where it is neither readable nor tappable
   * (`docs/architecture/accessibility.md#text-and-layout`: rows grow vertically). Two of the
   * `e2e/text-scale.spec.ts` cases exist for exactly this.
   */
  wrap?: boolean | undefined
  children: ReactNode
  style?: StyleProp<ViewStyle>
}) {
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          gap,
          alignItems: align,
          justifyContent: justify,
          ...(wrap ? { flexWrap: 'wrap' as const } : null),
        },
        style,
      ]}
    >
      {children}
    </View>
  )
}

export function Stack({
  gap = space['3'],
  children,
  style,
}: {
  gap?: number | undefined
  children: ReactNode
  style?: StyleProp<ViewStyle>
}) {
  return <View style={[{ gap }, style]}>{children}</View>
}

/**
 * A wrapping grid of same-shaped things: the tag chips, phrase detail's word cards, Add's theme
 * tiles, Progress's mastery legend.
 *
 * NOT `Row wrap`, on purpose. `Row` sets `alignItems: 'center'`, so a wrapped line's items would
 * centre against each other; a grid leaves the default `stretch`, which makes every tile on a line
 * the same height when one of them wraps to two lines. That difference only shows up at a large
 * text scale, which is exactly where it matters.
 */
export function Grid({
  gap = grid.gap,
  children,
  style,
}: {
  gap?: number | undefined
  children: ReactNode
  style?: StyleProp<ViewStyle>
}) {
  return <View style={[{ flexDirection: 'row', flexWrap: 'wrap', gap }, style]}>{children}</View>
}
