import { useCallback, useState } from 'react'
import { AppState } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { deviceClock, localTimeLabel } from './clock'

const LOCAL_MINUTE_MS = 60_000

function readLocalMinute(): string {
  return `${deviceClock.localDay()}T${localTimeLabel()}`
}

/**
 * Refresh a focused route at local minute boundaries and when the app returns to the foreground.
 * Wave entry and Today use the same clock signal so a route opened before a scheduled wave does
 * not remain on its stale locked state.
 */
export function useLocalMinute(): string {
  const [minute, setMinute] = useState(readLocalMinute)

  useFocusEffect(
    useCallback(() => {
      let timer: ReturnType<typeof setTimeout> | undefined
      const refresh = (): void => {
        if (timer !== undefined) clearTimeout(timer)
        setMinute(readLocalMinute())
        // Align to the next minute rather than drifting from when the route mounted.
        timer = setTimeout(refresh, LOCAL_MINUTE_MS - (deviceClock.now() % LOCAL_MINUTE_MS))
      }
      refresh()
      const subscription = AppState.addEventListener('change', (status) => {
        if (timer !== undefined) clearTimeout(timer)
        if (status === 'active') refresh()
      })
      return () => {
        if (timer !== undefined) clearTimeout(timer)
        subscription.remove()
      }
    }, []),
  )

  return minute
}
