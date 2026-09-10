/**
 * Listening-only mic ring. Never shown for a failed take.
 */

import { useEffect, type ReactNode } from 'react'
import { View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, {
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import { pulseRing } from '../motion'
import { reanimatedEasing } from '../motionRuntime'
import { useTheme } from '../ThemeProvider'

const RING_INSET = 6
const RING_GROWTH = 1.18

export function PulseRing({
  active,
  children,
  style,
}: {
  active: boolean
  children: ReactNode
  style?: StyleProp<ViewStyle> | undefined
}) {
  const { accent, reducedMotion } = useTheme()
  const phase = useSharedValue(0)

  useEffect(() => {
    if (!active || reducedMotion) {
      cancelAnimation(phase)
      phase.value = 0
      return
    }
    phase.value = 0
    phase.value = withRepeat(
      withTiming(1, { duration: pulseRing.durationMs, easing: reanimatedEasing.inOut }),
      -1,
      false,
    )
  }, [active, phase, reducedMotion])

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(phase.value, [0, 1], [1, RING_GROWTH]) }],
    opacity: interpolate(phase.value, [0, 1], [0.45, 0]),
  }))

  return (
    <View testID="pulse-ring" style={[{ alignSelf: 'stretch' }, style]}>
      {active ? (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              top: -RING_INSET,
              right: -RING_INSET,
              bottom: -RING_INSET,
              left: -RING_INSET,
              borderWidth: 2,
              borderColor: accent.accent,
              borderRadius: 999,
            },
            reducedMotion ? { opacity: 0.45 } : ringStyle,
          ]}
        />
      ) : null}
      {children}
    </View>
  )
}
