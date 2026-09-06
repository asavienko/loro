/**
 * The store instance.
 *
 * ONE shared phrase store, exactly as the blueprint does it (`Loro.dc.html:3575-3626`).
 * Rating a phrase in the stream updates the Progress histogram because both read the
 * same rows — no wiring between the screens.
 *
 * v1 keeps this in memory. SQLite + the outbox land with sync (ADR-0003/0012); the
 * repository shape in `engines.ts` is the seam they slot into.
 *
 * This file only composes: the data comes from `state.ts` and each action from the slice
 * that owns its concern. `createAppStore` will not compile until every action in
 * `AppActions` is supplied by exactly one slice, so the composition is checked rather than
 * remembered.
 */

import { create, type StoreApi, type UseBoundStore } from 'zustand'
import { deviceClock } from '../lib/clock'
import { setCopyLanguages } from '../lib/i18n'
import { newId } from '../lib/ids'
import { INITIAL_STATE } from './state'
import { createPhrasesSlice } from './slices/phrases'
import { createPracticeSlice } from './slices/practice'
import { createRefrainSlice } from './slices/refrain'
import { createSessionSlice } from './slices/session'
import { createUiSlice } from './slices/ui'
import type { AppState, SliceContext, StoreDeps } from './types'

export function createAppStore(deps: StoreDeps): UseBoundStore<StoreApi<AppState>> {
  return create<AppState>((set, get) => {
    const ctx: SliceContext = { set, get, deps }
    return {
      ...INITIAL_STATE,
      ...createSessionSlice(ctx),
      ...createPhrasesSlice(ctx),
      ...createPracticeSlice(ctx),
      ...createRefrainSlice(ctx),
      ...createUiSlice(ctx),
    }
  })
}

/** The app's store. A test builds its own with `createAppStore` and a fake clock. */
export const useApp = createAppStore({ clock: deviceClock, newId })

// Only the production instance drives the UI locale. Test stores stay independent.
useApp.subscribe((state, previous) => {
  if (
    state.nativeLanguage !== previous.nativeLanguage ||
    state.targetLocale !== previous.targetLocale
  ) {
    setCopyLanguages(state.nativeLanguage, state.targetLocale)
  }
})
