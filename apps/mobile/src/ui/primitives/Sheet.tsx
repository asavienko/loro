/**
 * `Sheet` — the bottom sheet. Scrim, dismiss backdrop, grabber, rounded top.
 *
 * Present/dismiss uses token `sheetUp` on the UI thread. Pull-down laws stay in
 * `usePullDown` (4 px / 48 px / 2× vertical, dedicated handle). The scrim remains a
 * labelled button. Web travel is short so the handle stays hittable the moment the
 * dialog is visible to Playwright.
 *
 * ── The backdrop is a real button ──
 * Tapping outside a sheet dismisses it, and that has to be reachable by assistive tech, so
 * the scrim's upper half is a labelled `Pressable` rather than a bare `onTouchEnd`. Its name
 * is a prop because it is learner-facing copy, and `e2e/add.spec.ts` finds it by that name.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Modal, Platform, StyleSheet, View } from 'react-native'
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { reducedMotionPlan, sheetUp } from '../motion'
import { reanimatedEasing } from '../motionRuntime'
import { line, MIN_TAP, radius, sheet, surface, webLayout } from '../theme'
import { useTheme } from '../ThemeProvider'
import { Pressable } from './Pressable'
import { usePullDown } from './usePullDown'

/** Native `sheetUp` travel when the panel height has not been measured yet. */
const SHEET_NATIVE_TRAVEL_PX = 640
/** Web travel keeps `sheet-pull-handle` on-screen from the first visible frame. */
const SHEET_WEB_TRAVEL_PX = 16

export function Sheet({
  visible,
  onDismiss,
  dismissLabel,
  children,
}: {
  visible: boolean
  onDismiss: () => void
  /** The backdrop's accessible name. Learner-facing copy — pass it in. */
  dismissLabel: string
  children: ReactNode
}) {
  const insets = useSafeAreaInsets()
  const pullHandlers = usePullDown(onDismiss, { captureOnStart: true })
  const { reducedMotion } = useTheme()
  const [presented, setPresented] = useState(visible)
  const presentedRef = useRef(visible)
  const progress = useSharedValue(visible ? 1 : 0)

  useEffect(() => {
    const plan = reducedMotionPlan(sheetUp.reducedMotion)
    const spec = reducedMotion
      ? { duration: plan.durationMs, easing: reanimatedEasing.linear }
      : { duration: sheetUp.durationMs, easing: reanimatedEasing.pop }

    if (visible) {
      presentedRef.current = true
      setPresented(true)
      progress.value = withTiming(1, spec)
      return
    }
    if (!presentedRef.current) return
    progress.value = withTiming(0, spec, (finished) => {
      if (!finished) return
      presentedRef.current = false
      scheduleOnRN(setPresented, false)
    })
  }, [visible, reducedMotion, progress])

  const sheetStyle = useAnimatedStyle(() => {
    const travel = reducedMotion
      ? 0
      : Platform.OS === 'web'
        ? SHEET_WEB_TRAVEL_PX
        : SHEET_NATIVE_TRAVEL_PX
    return {
      transform: [{ translateY: interpolate(progress.value, [0, 1], [travel, 0]) }],
      opacity: reducedMotion ? progress.value : 1,
    }
  })

  const scrimStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }))

  if (!presented) return null

  return (
    <Modal visible={presented} transparent animationType="none" onRequestClose={onDismiss}>
      <View style={s.root}>
        <Animated.View pointerEvents="none" style={[s.scrimFill, scrimStyle]} />
        <Pressable
          feedback="row"
          accessibilityLabel={dismissLabel}
          onPress={onDismiss}
          style={s.backdrop}
        >
          <View />
        </Pressable>

        <Animated.View
          style={[s.panel, { paddingBottom: insets.bottom + sheet.padding }, sheetStyle]}
        >
          <View testID="sheet-pull-handle" style={s.pullHandle} {...pullHandlers}>
            <View style={s.handle} />
          </View>
          {children}
        </Animated.View>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  scrimFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: surface.scrim,
  },
  backdrop: { flex: 1 },
  panel: {
    width: '100%',
    alignSelf: 'center',
    ...(Platform.OS === 'web' ? { maxWidth: webLayout.learnerMaxWidth } : {}),
    backgroundColor: surface.app,
    borderTopLeftRadius: radius['3xl'],
    borderTopRightRadius: radius['3xl'],
    padding: sheet.padding,
    gap: sheet.gap,
  },
  pullHandle: {
    minHeight: MIN_TAP,
    justifyContent: 'center',
    touchAction: 'none',
    userSelect: 'none',
  },
  handle: {
    width: sheet.handle.width,
    height: sheet.handle.height,
    borderRadius: sheet.handle.borderRadius,
    backgroundColor: line.stronger,
    alignSelf: 'center',
  },
})
