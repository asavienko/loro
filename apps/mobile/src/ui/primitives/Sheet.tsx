/**
 * `Sheet` — the bottom sheet. Scrim, dismiss backdrop, grabber, rounded top.
 *
 * ── The backdrop is a real button ──
 * Tapping outside a sheet dismisses it, and that has to be reachable by assistive tech, so
 * the scrim's upper half is a labelled `Pressable` rather than a bare `onTouchEnd`. Its name
 * is a prop because it is learner-facing copy, and `e2e/add.spec.ts` finds it by that name.
 *
 * ── What it does not do ──
 * The grabber is drawn and inert. The drag-to-dismiss gesture belongs to
 * plans/48-app-shell-failure-states-and-input.md; this component changes no behaviour.
 */

import type { ReactNode } from 'react'
import { Modal, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { line, radius, sheet, surface } from '../theme'
import { Pressable } from './Pressable'

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
          <View style={s.handle} />
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
    backgroundColor: surface.app,
    borderTopLeftRadius: radius['3xl'],
    borderTopRightRadius: radius['3xl'],
    padding: sheet.padding,
    gap: sheet.gap,
  },
  handle: {
    width: sheet.handle.width,
    height: sheet.handle.height,
    borderRadius: sheet.handle.borderRadius,
    backgroundColor: line.stronger,
    alignSelf: 'center',
  },
})
