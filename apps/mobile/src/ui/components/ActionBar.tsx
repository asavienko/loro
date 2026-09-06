/**
 * `ActionBar` — the fixed bar that holds a screen's primary action.
 *
 * It reads the safe-area inset itself, because forgetting to add it is how a button ends up under
 * the home indicator, and three screens were each adding it by hand.
 *
 * The active bar publishes its measured height so toasts clear it, even at large text sizes.
 * The bar is absolutely positioned. Screens use its measured height plus breathing room as
 * scroll-content clearance, retaining their authored minimum padding before the first layout.
 */

import { useCallback, useState, type ReactNode } from 'react'
import { useFocusEffect } from 'expo-router'
import { View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { actionBar, border, line, surface } from '../theme'
import { useBottomBar } from '../BottomBarContext'

export function ActionBar({
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
  const [height, setMeasuredHeight] = useState(0)
  const { setHeight } = useBottomBar()
  useFocusEffect(
    useCallback(() => {
      setHeight(height)
      return () => {
        setHeight(0)
      }
    }, [height, setHeight]),
  )

  return (
    <View
      onLayout={(event) => {
        setMeasuredHeight(event.nativeEvent.layout.height)
      }}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        flexDirection: direction,
        flexWrap: direction === 'row' ? 'wrap' : 'nowrap',
        gap,
        padding: actionBar.padding,
        paddingBottom: insets.bottom + actionBar.paddingBottom,
        backgroundColor: surface.app,
        borderTopWidth: border.hairline,
        borderTopColor: line.default,
      }}
    >
      {children}
    </View>
  )
}
