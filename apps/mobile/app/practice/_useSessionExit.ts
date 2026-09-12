import { useEffect, useRef } from 'react'
import { BackHandler, Platform } from 'react-native'
import { useNavigation } from 'expo-router'

/**
 * NAV-04: an active Session cannot be abandoned by stack back or Android Back.
 * Those open Pause · End it here · Keep going instead.
 *
 * Only `GO_BACK` is intercepted. Switcher `replace` / `dismissTo` and Pause/End
 * `replace` must still leave so menu hard-filter and Today escapes stay live.
 * Expo Router web history is not this listener — `page.goBack()` is not proof.
 */
export function useSessionExitGuard({
  enabled,
  exitVisible,
  onBlockedLeave,
}: {
  enabled: boolean
  exitVisible: boolean
  onBlockedLeave: () => void
}): { allowLeave: () => void } {
  const navigation = useNavigation()
  const allowRef = useRef(false)
  const onBlockedLeaveRef = useRef(onBlockedLeave)
  onBlockedLeaveRef.current = onBlockedLeave

  useEffect(() => {
    if (!enabled) return
    return navigation.addListener('beforeRemove', (event) => {
      if (allowRef.current) return
      if (event.data.action.type !== 'GO_BACK') return
      event.preventDefault()
      onBlockedLeaveRef.current()
    })
  }, [enabled, navigation])

  useEffect(() => {
    if (Platform.OS !== 'android' || !enabled) return
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (exitVisible) return false
      onBlockedLeaveRef.current()
      return true
    })
    return () => {
      subscription.remove()
    }
  }, [enabled, exitVisible])

  return {
    allowLeave: () => {
      allowRef.current = true
    },
  }
}
