/**
 * Reward and step arrivals. `popIn` is for rewards only — lock-in, toast, done tile.
 * Routine chrome must use `fadeIn` or no wrapper.
 */

import { useEffect, type ReactNode } from 'react'
import { type StyleProp, type ViewStyle } from 'react-native'
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { fadeIn, popIn, reducedMotionPlan, stepIn } from '../motion'
import { reanimatedEasing } from '../motionRuntime'
import { useTheme } from '../ThemeProvider'

export type ArrivalKind = 'popIn' | 'stepIn' | 'fadeIn'

const STEP_IN_DISTANCE_PX = 18
const POP_OVERSHOOT = 1.08
const POP_START_SCALE = 0.6

export function Arrival({
  kind = 'fadeIn',
  children,
  style,
}: {
  kind?: ArrivalKind | undefined
  children: ReactNode
  style?: StyleProp<ViewStyle> | undefined
}) {
  const { reducedMotion } = useTheme()
  const progress = useSharedValue(0)

  useEffect(() => {
    const token = kind === 'popIn' ? popIn : kind === 'stepIn' ? stepIn : fadeIn
    const plan = reducedMotionPlan(token.reducedMotion)
    const keepMotion = !reducedMotion || token.reducedMotion === 'keep'
    progress.value = 0
    // Same-tick 0 → withTiming can no-op on a remount (sign-out hub swap). Kick next frame.
    const frame = requestAnimationFrame(() => {
      progress.value = withTiming(1, {
        duration: keepMotion ? token.durationMs : plan.durationMs,
        easing: keepMotion
          ? kind === 'popIn'
            ? reanimatedEasing.pop
            : reanimatedEasing.out
          : reanimatedEasing.linear,
      })
    })
    return () => cancelAnimationFrame(frame)
  }, [kind, progress, reducedMotion])

  const animatedStyle = useAnimatedStyle(() => {
    if (kind === 'popIn' && !reducedMotion) {
      return {
        opacity: interpolate(progress.value, [0, 0.4, 1], [0, 1, 1]),
        transform: [
          {
            scale: interpolate(progress.value, [0, 0.55, 1], [POP_START_SCALE, POP_OVERSHOOT, 1]),
          },
        ],
      }
    }
    if (kind === 'stepIn' && !reducedMotion) {
      return {
        opacity: progress.value,
        transform: [{ translateX: interpolate(progress.value, [0, 1], [STEP_IN_DISTANCE_PX, 0]) }],
      }
    }
    return { opacity: progress.value }
  })

  return (
    <Animated.View testID="arrival" style={[style, animatedStyle]}>
      {children}
    </Animated.View>
  )
}
