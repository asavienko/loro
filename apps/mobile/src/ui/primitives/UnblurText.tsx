/**
 * Speak word un-blur. Hidden tokens stay in the layout so the line does not reflow.
 * Screen readers hear `hiddenLabel` until the word is revealed. Reduce Motion swaps instantly.
 */

import { useEffect } from 'react'
import { Platform, StyleSheet, View } from 'react-native'
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { currentNativeLanguage, currentTargetLocale, useLocale } from '../../lib/i18n'
import { wordUnblur } from '../motion'
import { reanimatedEasing } from '../motionRuntime'
import { scaleTextStyle } from '../runtimeStyles'
import { ink, type, typography, type TypeVariant } from '../theme'
import { useTheme } from '../ThemeProvider'

const HIDDEN_BLUR_PX = 6

export function UnblurText({
  text,
  revealed,
  hiddenLabel,
  variant = 'title3',
}: {
  text: string
  revealed: boolean
  hiddenLabel: string
  variant?: TypeVariant | undefined
}) {
  useLocale()
  const { accent, reducedMotion, textScale } = useTheme()
  const progress = useSharedValue(revealed ? 1 : 0)
  const language = revealed ? currentTargetLocale() : currentNativeLanguage()

  useEffect(() => {
    if (reducedMotion) {
      progress.value = revealed ? 1 : 0
      return
    }
    progress.value = withTiming(revealed ? 1 : 0, {
      duration: wordUnblur.durationMs,
      easing: reanimatedEasing.out,
    })
  }, [progress, reducedMotion, revealed])

  const animatedStyle = useAnimatedStyle(() => {
    const color = interpolateColor(
      progress.value,
      [0, 0.55, 1],
      [ink.muted, accent.accentInk, ink.ink],
    )
    const blur = interpolate(progress.value, [0, 1], [HIDDEN_BLUR_PX, 0])
    return {
      color,
      opacity: interpolate(progress.value, [0, 1], [0.35, 1]),
      ...(Platform.OS === 'web' ? { filter: `blur(${blur}px)` } : {}),
    }
  })

  const typeStyle = scaleTextStyle(
    StyleSheet.flatten([type[variant], { fontVariant: [typography.scale.serifNum.variant] }]),
    textScale,
  )

  return (
    <View
      testID="unblur-word"
      accessible
      accessibilityRole="text"
      accessibilityLabel={revealed ? text : hiddenLabel}
      accessibilityLanguage={language}
    >
      <Animated.Text
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        accessibilityLanguage={revealed ? language : undefined}
        {...(Platform.OS === 'web' && revealed ? { lang: language } : {})}
        style={[typeStyle, animatedStyle]}
      >
        {text}
      </Animated.Text>
    </View>
  )
}
