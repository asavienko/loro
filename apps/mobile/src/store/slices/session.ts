/**
 * The app's own lifecycle: finishing onboarding, and wiping the app back to new.
 *
 * Onboarding seeds a REAL stream from the chosen packs, so the learner never lands in an
 * empty app, and then hands off to `ensureRefrainSet` rather than choosing a set itself —
 * one place decides what today is.
 */

import { catalogPhraseId } from '@loro/core'
import { packPhrases } from '../catalog'
import { blankPhraseState } from '../phraseFactory'
import { INITIAL_STATE } from '../state'
import type { Slice } from '../types'

export const createSessionSlice: Slice<'completeOnboarding' | 'reset'> = ({ set, get, deps }) => ({
  completeOnboarding: ({ goal, dailyMinutes, packIds }) => {
    const now = deps.clock.now()
    const seeded = packPhrases(packIds).map((c) =>
      blankPhraseState(deps.newId(), catalogPhraseId(c.id), 'starter', now),
    )

    set({
      onboarded: true,
      goal,
      dailyMinutes,
      phrases: seeded,
      refrainSet: [],
      refrainDay: null,
      refrainSubstituted: [],
    })
    get().ensureRefrainSet()
  },

  // Spreads the one declaration of a fresh app, so a field added to AppData is
  // cleared here for free. The enumerated version left `dailyMinutes` and
  // `streakDays` behind — the previous learner's settings, on a shared device.
  reset: () => {
    set({ ...INITIAL_STATE })
  },
})
