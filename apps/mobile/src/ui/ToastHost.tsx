/**
 * Toasts. Dark pill, bottom-centred, one at a time.
 *
 * The copy matters: the blueprint's toasts explain the CONSEQUENCE of an action
 * ("Difficult — repeats more, comes back sooner") rather than confirming it ("Saved").
 * That is what teaches the learner the model.
 */

import { useEffect } from 'react'
import { View, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { copy } from '../lib/copy'
import { TOAST_MS, UNDO_TOAST_MS } from '../lib/toastTiming'
import { useApp } from '../store'
import { Pressable, Text } from './primitives'
import { HIT_SLOP, MIN_TAP, onDark, radius, space, surface } from './theme'
import { useTheme } from './ThemeProvider'
import { useBottomBar } from './BottomBarContext'

export function ToastHost() {
  const { accent } = useTheme()
  const { height: bottomBarHeight } = useBottomBar()
  const insets = useSafeAreaInsets()
  const toast = useApp((s) => s.toast)
  const clear = useApp((s) => s.clearToast)

  useEffect(() => {
    if (toast === null) return
    // 2.6s with Undo, 1.7s without — the blueprint's timings.
    const ms = toast.undo === undefined ? TOAST_MS : UNDO_TOAST_MS
    const t = setTimeout(clear, ms)
    return () => {
      clearTimeout(t)
    }
  }, [toast, clear])

  if (toast === null) return null

  return (
    <View
      style={[s.wrap, { bottom: Math.max(bottomBarHeight, insets.bottom) + space['3'] }]}
      pointerEvents="box-none"
    >
      <View style={s.toast} accessibilityLiveRegion="polite" accessibilityRole="alert">
        <Text variant="captionSm" color={onDark.primary}>
          {toast.message}
        </Text>
        {toast.undo !== undefined && (
          <Pressable
            feedback="smallButton"
            accessibilityLabel={copy.a11y.common.undo}
            onPress={() => {
              toast.undo?.()
              clear()
            }}
            style={s.undo}
          >
            <Text variant="captionSm" color={accent.accentOnDark}>
              {copy.toast.undo}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  /**
   * The one control that ever appears in a toast, and it was 47×33 with `hitSlop` counted —
   * under the 44 px floor, on the app's only undo. Nothing caught it because no declared state
   * had an undo toast on screen when the touch-target sweep ran; `today · remove undo offered`
   * does, and it failed on the first run.
   *
   * `minHeight` rather than padding: the pill's own `paddingVertical` already sets the toast's
   * height, and padding here would make the pill taller around a two-line message. `MIN_TAP`
   * minus the 8 px `hitSlop` on each edge is the box that has to be drawn for the target to be
   * 44 — the same arithmetic Today's rail does.
   */
  undo: { minHeight: MIN_TAP - HIT_SLOP * 2, justifyContent: 'center' },
  toast: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space['3'],
    backgroundColor: surface.dark,
    paddingHorizontal: 15,
    paddingVertical: 11,
    borderRadius: radius.xl,
    maxWidth: '92%',
  },
})
