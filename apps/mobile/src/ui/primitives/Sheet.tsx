/**
 * `Sheet` — the bottom sheet. Scrim, dismiss backdrop, grabber, rounded top.
 *
 * ── The backdrop is a real button ──
 * Tapping outside a sheet dismisses it, and that has to be reachable by assistive tech, so
 * the scrim's upper half is a labelled `Pressable` rather than a bare `onTouchEnd`. Its name
 * is a prop because it is learner-facing copy, and `e2e/add.spec.ts` finds it by that name.
 *
 * Pull down on the dedicated handle to dismiss; content keeps its scroll gestures.
 */

import type { ReactNode } from 'react'
import { Modal, Platform, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { line, MIN_TAP, radius, sheet, surface, webLayout } from '../theme'
import { Pressable } from './Pressable'
import { usePullDown } from './usePullDown'

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
  const pullHandlers = usePullDown(onDismiss)

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={s.scrim}>
        <Pressable
          feedback="row"
          accessibilityLabel={dismissLabel}
          onPress={onDismiss}
          style={s.backdrop}
        >
          <View />
        </Pressable>

        <View style={[s.panel, { paddingBottom: insets.bottom + sheet.padding }]}>
          <View testID="sheet-pull-handle" style={s.pullHandle} {...pullHandlers}>
            <View style={s.handle} />
          </View>
          {children}
        </View>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: surface.scrim, justifyContent: 'flex-end' },
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
