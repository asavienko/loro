/**
 * Warming interpolator. Colour is real automaticity (0–100). Glow is decoration and
 * drops under Reduce Motion; the colour change stays (`keepColour`).
 */

import { useEffect, type ReactNode } from 'react'
import { type StyleProp, type ViewStyle } from 'react-native'
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { clampAutomaticity, warmingBand, warmingStops } from '../motion'
import { reanimatedEasing } from '../motionRuntime'
import { ink } from '../theme'
import { useTheme } from '../ThemeProvider'

export function WarmingSurface({
  automaticity,
  accessibilityLabel,
  children,
  style,
}: {
  /** Measured automaticity. Never a simulated demo value. */
  automaticity: number
  accessibilityLabel?: string | undefined
  children: ReactNode
  style?: StyleProp<ViewStyle> | undefined
}) {
  const { reducedMotion } = useTheme()
  const stops = warmingStops()
  const value = useSharedValue(clampAutomaticity(automaticity))

  useEffect(() => {
    value.value = withTiming(clampAutomaticity(automaticity), {
      duration: warmingBand.durationMs,
      easing: reanimatedEasing.ease,
    })
  }, [automaticity, value])

  const animatedStyle = useAnimatedStyle(() => {
    const at = stops.map((stop) => stop.at)
    const backgrounds = stops.map((stop) => stop.background)
    const backgroundColor = interpolateColor(value.value, at, backgrounds)
    if (reducedMotion) return { backgroundColor }
    return {
      backgroundColor,
      shadowColor: ink.ink,
      shadowOffset: { width: 0, height: 4 },
      shadowRadius: interpolate(
        value.value,
        at,
        stops.map((stop) => stop.glowRadius),
      ),
      shadowOpacity: interpolate(
        value.value,
        at,
        stops.map((stop) => stop.glowOpacity),
      ),
      elevation: interpolate(value.value, [0, 100], [1, 8]),
    }
  })

  return (
    <Animated.View
      testID="warming-surface"
      accessibilityLabel={accessibilityLabel}
      style={[style, animatedStyle]}
    >
      {children}
    </Animated.View>
  )
}
