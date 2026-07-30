/**
 * Toasts. Dark pill, bottom-centred, one at a time.
 *
 * The copy matters: the blueprint's toasts explain the CONSEQUENCE of an action
 * ("Difficult — repeats more, comes back sooner") rather than confirming it ("Saved").
 * That is what teaches the learner the model.
 */

import { useEffect } from 'react'
import { View, StyleSheet } from 'react-native'
import { copy } from '../lib/copy'
import { useApp } from '../store'
import { Pressable, Text } from './primitives'
import { accent, onDark, radius, space, surface } from './theme'

export function ToastHost() {
  const toast = useApp((s) => s.toast)
  const clear = useApp((s) => s.clearToast)

  useEffect(() => {
    if (toast === null) return
    // 2.6s with Undo, 1.7s without — the blueprint's timings.
    const ms = toast.undo === undefined ? 1700 : 2600
    const t = setTimeout(clear, ms)
    return () => {
      clearTimeout(t)
    }
  }, [toast, clear])

  if (toast === null) return null

  return (
    <View style={s.wrap} pointerEvents="box-none">
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
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 34, alignItems: 'center' },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['3'],
    backgroundColor: surface.dark,
    paddingHorizontal: 15,
    paddingVertical: 11,
    borderRadius: radius.xl,
    maxWidth: '92%',
  },
})
