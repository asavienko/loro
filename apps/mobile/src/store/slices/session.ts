/**
 * The app's own lifecycle: finishing onboarding, and wiping the app back to new.
 *
 * Onboarding seeds a REAL stream from the chosen packs, so the learner never lands in an
 * empty app, and then hands off to `ensureRefrainSet` rather than choosing a set itself —
 * one place decides what today is.
 */

import { assertLanguagePair, catalogPhraseId } from '@loro/core'
import { loadLearningCatalog } from '../catalog'
import type { CourseState } from '../state'
import { blankPhraseState } from '../phraseFactory'
import { EMPTY_REFRAIN_RESUME, INITIAL_STATE } from '../state'
import type { Slice } from '../types'
import { importDraftKey } from '../../lib/importDraft'

export const createSessionSlice: Slice<
  'completeOnboarding' | 'reset' | 'setLanguages' | 'previewNativeLanguage'
> = ({ set, get, deps, hasCatalog }) => ({
  previewNativeLanguage: (nativeLanguage) => {
    const current = get()
    if (current.languageChosen || current.onboarded) return
    set({ nativeLanguage })
  },
  setLanguages: (nativeLanguage, targetLocale) => {
    assertLanguagePair(nativeLanguage, targetLocale)
    const current = get()
    if (targetLocale === current.targetLocale) {
      set({
        nativeLanguage,
        importDraft: current.importDrafts[importDraftKey({ nativeLanguage, targetLocale })] ?? null,
        languageChosen: true,
        toast: null,
      })
      return
    }
    const snapshot: CourseState = {
      streamCursor: current.streamCursor,
      refrainResume: current.refrainResume,
      onboarded: current.onboarded,
      phrases: current.phrases,
      selectedId: current.selectedId,
      refrainSet: current.refrainSet,
      refrainDay: current.refrainDay,
      refrainWaves: current.refrainWaves,
      waveListens: current.waveListens,
      refrainSubstituted: current.refrainSubstituted,
      reviewCheckpoint: current.reviewCheckpoint,
      listenQueue: current.listenQueue,
    }
    const destination = current.courses[targetLocale] ?? {
      streamCursor: 0,
      refrainResume: EMPTY_REFRAIN_RESUME,
      onboarded: false,
      phrases: [],
      selectedId: null,
      refrainSet: [],
      refrainDay: null,
      refrainWaves: [],
      waveListens: {},
      refrainSubstituted: [],
      reviewCheckpoint: null,
      listenQueue: null,
    }
    set({
      ...destination,
      nativeLanguage,
      targetLocale,
      importDraft: current.importDrafts[importDraftKey({ nativeLanguage, targetLocale })] ?? null,
      languageChosen: true,
      courses: { ...current.courses, [current.targetLocale]: snapshot },
      toast: null,
    })
    get().ensureRefrainSet()
  },
  completeOnboarding: ({ goal, level, dailyMinutes, packIds }) => {
    const now = deps.clock.now()
    if (get().onboarded) return
    const catalog = loadLearningCatalog(get().targetLocale, get().nativeLanguage)
    const ids = new Set(
      packIds.flatMap((id) => catalog.packs.find((pack) => pack.id === id)?.phrases ?? []),
    )
    const existing = get().phrases
    const seeded = [...ids]
      .filter(
        (id) =>
          !existing.some((phrase) => phrase.phraseId === id) && !hasCatalog(id, get().targetLocale),
      )
      .map((id) => blankPhraseState(deps.newId(), catalogPhraseId(id), 'starter', now))

    set({
      onboarded: true,
      languageChosen: true,
      goal,
      // Stored, not yet acted on — see `level` on `AppData`. Dropping it here is the defect
      // this field exists to close.
      level,
      dailyMinutes,
      phrases: [...existing, ...seeded],
      refrainSet: [],
      refrainDay: null,
      refrainWaves: [],
      waveListens: {},
      refrainSubstituted: [],
    })
    get().ensureRefrainSet()
  },

  // Spreads the one declaration of a fresh app, so a field added to AppData is
  // cleared here for free. The enumerated version left `dailyMinutes` and
  // `streakDays` behind — the previous learner's settings, on a shared device.
  reset: () => {
    set(INITIAL_STATE)
  },
})
