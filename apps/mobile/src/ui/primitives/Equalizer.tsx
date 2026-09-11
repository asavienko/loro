/**
 * Listening equaliser. Means "sound is happening", never "a model is thinking".
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
import { eqBars } from '../motion'
import { reanimatedEasing } from '../motionRuntime'
import { ink } from '../theme'
import { useTheme } from '../ThemeProvider'

const BAR_COUNT = 5
const BAR_WIDTH = 4
const BAR_HEIGHT = 22
const BAR_GAP = 4
const BAR_MIN_SCALE = 7 / 22

export function Equalizer({ active, color }: { active: boolean; color?: string | undefined }) {
  const { reducedMotion } = useTheme()
  const phase = useSharedValue(0)
  const barColor = color ?? ink.ink

  useEffect(() => {
    if (!active || reducedMotion) {
      cancelAnimation(phase)
      phase.value = 0
      return
    }
    phase.value = 0
    phase.value = withRepeat(
      withTiming(1, { duration: eqBars.durationMs, easing: reanimatedEasing.inOut }),
      -1,
      false,
    )
  }, [active, phase, reducedMotion])

  return (
    <View
      testID="equalizer"
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
        <EqBar
          key={index}
          index={index}
          phase={phase}
          color={barColor}
          staticBar={reducedMotion || !active}
        />
      ))}
    </View>
  )
}

function EqBar({
  index,
  phase,
  color,
  staticBar,
}: {
  index: number
  phase: SharedValue<number>
  color: string
  staticBar: boolean
}) {
  const style = useAnimatedStyle(() => {
    if (staticBar) {
      return { transform: [{ scaleY: index % 2 === 0 ? BAR_MIN_SCALE : 0.7 }] }
    }
    const offset = eqBars.durationMs === 0 ? 0 : (index * eqBars.staggerMs) / eqBars.durationMs
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
