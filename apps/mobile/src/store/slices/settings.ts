/** F-05/F-06: preference writes use the same transactional learner path as onboarding. */
import type { Slice } from '../types'

export const createSettingsSlice: Slice<'setAnalyticsConsent'> = ({ set }) => ({
  setAnalyticsConsent: (consent) => {
    if (typeof consent !== 'boolean') throw new Error('Analytics consent must be boolean')
    set({ devicePreferences: { version: 1, analyticsConsent: consent } })
  },
})
