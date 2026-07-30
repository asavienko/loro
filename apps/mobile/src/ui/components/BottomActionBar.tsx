/**
 * `BottomActionBar` — the fixed bar that holds a screen's primary action.
 *
 * It reads the safe-area inset itself, because forgetting to add it is how a button ends up
 * under the home indicator, and three screens were each adding it by hand.
 *
 * The bar is absolutely positioned, so it does NOT reserve space in the scroll view above it.
 * A screen that uses it still has to pad its own `contentContainerStyle` by roughly the bar's
 * height — that clearance differs per screen (Today 96, the Refrain 120, phrase detail 110)
 * and stays with the screen that measured it.
 */

import type { ReactNode } from 'react'
import { View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { bottomBar, line, surface } from '../theme'

export function BottomActionBar({
  children,
  direction = 'column',
  gap,
}: {
  children: ReactNode
  /** `row` lays the actions side by side — phrase detail's Remove + Practice pair. */
  direction?: 'row' | 'column' | undefined
  gap?: number | undefined
}) {
  const insets = useSafeAreaInsets()

  return (
    <View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        flexDirection: direction,
        gap,
        padding: bottomBar.padding,
        paddingBottom: insets.bottom + bottomBar.paddingBottom,
        backgroundColor: surface.app,
        borderTopWidth: 1,
        borderTopColor: line.default,
      }}
    >
      {children}
    </View>
  )
}
