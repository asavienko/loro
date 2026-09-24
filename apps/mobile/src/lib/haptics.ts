/**
 * Named haptic events. Plan 57 owns the port; routes must not call platform APIs directly.
 * Web is silent. Failure and shame never get a pulse.
 */
import { Platform, Vibration } from 'react-native'

const SELECT_MS = 10
const CONFIRM_MS = 16
const REORDER_MS = 12

function pulse(durationMs: number): void {
  if (Platform.OS === 'web') return
  Vibration.vibrate(durationMs)
}

export const haptics = {
  /** A choice was taken — method tile, stay signed in, confirm. */
  select(): void {
    pulse(SELECT_MS)
  },
  /** A constructive commit — stay signed in, sign-in started. */
  confirm(): void {
    pulse(CONFIRM_MS)
  },
  /** A listen-queue drop committed to local order. */
  reorder(): void {
    pulse(REORDER_MS)
  },
}
