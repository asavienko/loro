/**
 * The Refrain beat. Tempo is authored (720 ms, or 340 ms in Speed). Not a spinner.
 */

import { useEffect } from 'react'
import { View } from 'react-native'
import Animated, {
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import type { SharedValue } from 'react-native-reanimated'
import { barJump } from '../motion'
import { reanimatedEasing } from '../motionRuntime'
import { useTheme } from '../ThemeProvider'

const BAR_COUNT = 3
const BAR_WIDTH = 5
const BAR_HEIGHT = 28
const BAR_GAP = 5
const BAR_MIN_SCALE = 0.35

export function BeatBars({
  tempoMs,
  active = true,
}: {
  tempoMs: number
  active?: boolean | undefined
}) {
  const { accent, reducedMotion } = useTheme()
  const spec = barJump(tempoMs)
  const phase = useSharedValue(0)

  useEffect(() => {
    if (!active || reducedMotion) {
      cancelAnimation(phase)
      phase.value = 0
      return
    }
    phase.value = 0
    phase.value = withRepeat(
      withTiming(1, { duration: spec.durationMs, easing: reanimatedEasing.inOut }),
      -1,
      false,
    )
  }, [active, phase, reducedMotion, spec.durationMs])

  return (
    <View
      testID="beat-bars"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'center',
        gap: BAR_GAP,
        height: BAR_HEIGHT,
      }}
    >
      {Array.from({ length: BAR_COUNT }, (_, index) => (
        <BeatBar
          key={index}
          index={index}
          phase={phase}
          tempoMs={spec.durationMs}
          staggerMs={spec.staggerMs}
          color={accent.accent}
          staticBar={reducedMotion || !active}
        />
      ))}
    </View>
  )
}

function BeatBar({
  index,
  phase,
  tempoMs,
  staggerMs,
  color,
  staticBar,
}: {
  index: number
  phase: SharedValue<number>
  tempoMs: number
  staggerMs: number
  color: string
  staticBar: boolean
}) {
  const style = useAnimatedStyle(() => {
    if (staticBar) {
      return {
        transform: [{ scaleY: index === 1 ? 1 : BAR_MIN_SCALE }],
      }
    }
    const offset = tempoMs === 0 ? 0 : (index * staggerMs) / tempoMs
    const local = (phase.value + offset) % 1
    const scaleY = interpolate(local, [0, 0.5, 1], [BAR_MIN_SCALE, 1, BAR_MIN_SCALE])
    return {
      transform: [{ translateY: ((1 - scaleY) * BAR_HEIGHT) / 2 }, { scaleY }],
    }
  })

  return (
    <Animated.View
      style={[
        {
          width: BAR_WIDTH,
          height: BAR_HEIGHT,
          borderRadius: 2,
          backgroundColor: color,
        },
        style,
      ]}
    />
  )
}
