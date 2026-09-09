import { accents } from '@loro/design-tokens'
import type { Slice } from '../types'

/** F-05/F-06: preference writes use the same transactional learner path as onboarding. */
export const createSettingsSlice: Slice<'setAnalyticsConsent' | 'setVisualPreferences'> = ({
  set,
}) => ({
  setAnalyticsConsent: (consent) => {
    if (typeof consent !== 'boolean') throw new Error('Analytics consent must be boolean')
    set((state) => ({
      devicePreferences: { ...state.devicePreferences, analyticsConsent: consent },
    }))
  },
  setVisualPreferences: (accent, motion) => {
    if (!(accent in accents)) throw new Error('Unknown accent')
    if (!['system', 'reduced'].includes(motion)) throw new Error('Unknown motion preference')
    set((state) => ({
      devicePreferences: { ...state.devicePreferences, accent, motion },
    }))
  },
})
