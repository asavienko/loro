import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import type { ReviewGrade } from '@loro/core'
import { reanimatedEasing } from '../../../src/ui/motionRuntime'
import { useTheme } from '../../../src/ui/ThemeProvider'
import { onDark, semantic } from '../../../src/ui/theme'
import { BURST_MARKS, BURST_MS, BURST_OFFSETS, MARK_SIZE, RING_MS, RING_SIZE } from './geometry'

export function Burst({ grade }: { grade: ReviewGrade | null }) {
  if (grade === 'easy' || grade === 'good') return <SparkleBurst />
  if (grade === 'hard') return <EnergyRing />
  return null
}

function SparkleBurst() {
  const { accent, reducedMotion } = useTheme()
  const colors = [accent.accentOnDark, semantic.success.bg, semantic.success.border, onDark.secondary]
  return (
    <View pointerEvents="none" style={styles.layer}>
      {BURST_OFFSETS.map((offset, index) => (
        <Sparkle
          key={`${offset.x}:${offset.y}`}
          mark={BURST_MARKS[index % BURST_MARKS.length] ?? '•'}
          color={colors[index % colors.length] ?? accent.accentOnDark}
          x={offset.x}
          y={offset.y}
          reducedMotion={reducedMotion}
        />
      ))}
    </View>
  )
}

function Sparkle({
  mark,
  color,
  x,
  y,
  reducedMotion,
}: {
  mark: string
  color: string
  x: number
  y: number
  reducedMotion: boolean
}) {
  const progress = useSharedValue(0)
  useEffect(() => {
    progress.value = withTiming(1, {
      duration: reducedMotion ? 1 : BURST_MS,
      easing: reanimatedEasing.out,
    })
  }, [progress, reducedMotion])
  const style = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [
      { translateX: x * progress.value },
      { translateY: y * progress.value },
      { scale: 1 - progress.value * 0.6 },
    ],
  }))
  return (
    <Animated.Text style={[styles.mark, { color }, style]}>{mark}</Animated.Text>
  )
}

function EnergyRing() {
  const { accent, reducedMotion } = useTheme()
  const progress = useSharedValue(0)
  useEffect(() => {
    progress.value = withTiming(1, {
      duration: reducedMotion ? 1 : RING_MS,
      easing: reanimatedEasing.out,
    })
  }, [progress, reducedMotion])
  const style = useAnimatedStyle(() => ({
    opacity: 0.85 * (1 - progress.value),
    transform: [{ scale: 0.6 + progress.value * 1.8 }],
  }))
  return (
    <View pointerEvents="none" style={styles.layer}>
      <Animated.View style={[styles.ring, { borderColor: accent.accentOnDark }, style]} />
    </View>
  )
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mark: { position: 'absolute', fontSize: MARK_SIZE, fontWeight: '700' },
  ring: {
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE,
    borderWidth: 2,
  },
})
