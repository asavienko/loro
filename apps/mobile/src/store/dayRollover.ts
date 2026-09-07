/**
 * Day rollover.
 *
 * `ensureRefrainSet()` used to be called from exactly one place — the end of onboarding —
 * so the day never rolled while the app was open. A learner who started at 23:55 and
 * practised past midnight kept yesterday's set while `repsToday` reset underneath it, and
 * the warming card dropped to cold mid-ritual. That is the most visible thing on the v1
 * hero screen, so it is checked in three places now:
 *
 *   1. here, whenever the app returns to the foreground (this hook, mounted app-wide)
 *   2. on entry to the Refrain
 *   3. on entry to Today
 *
 * All three are the same idempotent call: it re-rolls only when the local day actually
 * changed, and otherwise tops up a set that lost a member.
 */

import { useEffect } from 'react'
import { AppState } from 'react-native'
// The store instance directly, not the barrel: this hook is one of the store's own
// modules, and importing its own public surface would be a cycle.
import { useApp } from './store'
import { attemptWrite } from './attemptWrite'

export function useDayRollover(): void {
  const ensure = useApp((s) => s.ensureRefrainSet)

  useEffect(() => {
    // Foreground is the right trigger rather than a timer: a phone that was asleep
    // across midnight fires this on wake, and a polling interval would burn battery to
    // learn the same thing later. (A scheduled notification hook is the other half of
    // this, and lands with plans/30-widgets-and-notifications.md.)
    const sub = AppState.addEventListener('change', (status) => {
      if (status === 'active') attemptWrite(ensure)
    })
    // Also on mount: the app may have been launched cold on a new day.
    attemptWrite(ensure)
    return () => {
      sub.remove()
    }
  }, [ensure])
}
