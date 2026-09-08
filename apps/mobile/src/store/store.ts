/**
 * The store instance.
 *
 * ONE shared phrase store, exactly as the blueprint does it (`Loro.dc.html:3575-3626`).
 * Rating a phrase in the stream updates the Progress histogram because both read the
 * same rows — no wiring between the screens.
 *
 * The production instance is hydrated from SQLite before routes mount. Zustand is the
 * rendering projection: writes commit rows and outbox together before publication.
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
import type { LearnerStorage } from '../data/learner'

const storageControls = new WeakMap<
  StoreApi<AppState>,
  { attach(storage: LearnerStorage): void; reload(): void }
>()

export function createAppStore(deps: StoreDeps): UseBoundStore<StoreApi<AppState>> {
  let storage = deps.storage
  let publish: StoreApi<AppState>['setState']
  const store = create<AppState>((set, get, api) => {
    publish = set
    const durableSet: StoreApi<AppState>['setState'] = (partial, replace?: boolean) => {
      const previous = get()
      const patch = typeof partial === 'function' ? partial(previous) : partial
      if (Object.is(patch, previous)) return
      const next = (replace ? patch : { ...previous, ...patch }) as AppState
      if (storage === undefined) {
        set(next, true)
        return
      }
      try {
        // The database is authoritative. React only receives the committed repository
        // projection; a disk-full error leaves both the UI and the outbox unchanged.
        const committed =
          partial === INITIAL_STATE ? storage.erase() : storage.commit(previous, next)
        set({ ...next, ...committed }, true)
      } catch (error) {
        deps.onPersistenceError?.(error)
        throw error
      }
    }
    // Route session cursors currently use public setState: they must share the same transaction seam.
    api.setState = durableSet
    const ctx: SliceContext = {
      set: durableSet,
      get,
      deps,
      loadRefrainDay: (day, target) => storage?.refrainDay(day, target) ?? null,
    }
    return {
      ...(storage?.load() ?? INITIAL_STATE),
      ...createSessionSlice(ctx),
      ...createPhrasesSlice(ctx),
      ...createPracticeSlice(ctx),
      ...createRefrainSlice(ctx),
      ...createUiSlice(ctx),
    }
  })
  storageControls.set(store, {
    attach(adapter) {
      const hydrated = adapter.load()
      storage = adapter
      publish(hydrated)
    },
    reload() {
      if (storage !== undefined) publish({ ...storage.load(), toast: store.getState().toast })
    },
  })
  return store
}

/** Composition-root hydration; never called from a learner action or a screen refresh. */
export function attachStorePersistence(store: StoreApi<AppState>, storage: LearnerStorage): void {
  storageControls.get(store)?.attach(storage)
}

/** Remote merges publish their committed local projection through the same subscription path. */
export function reloadStorePersistence(store: StoreApi<AppState>): void {
  storageControls.get(store)?.reload()
}

/** The app's store. A test builds its own with `createAppStore` and a fake clock. */
export const useApp = createAppStore({
  clock: deviceClock,
  newId,
  onPersistenceError: (error) => persistenceFailure?.(error),
})

let persistenceFailure: ((error: unknown) => void) | undefined
export function setPersistenceFailureHandler(handler: (error: unknown) => void): void {
  persistenceFailure = handler
}

// Only the production instance drives the UI locale. Test stores stay independent.
useApp.subscribe((state, previous) => {
  if (
    state.nativeLanguage !== previous.nativeLanguage ||
    state.targetLocale !== previous.targetLocale
  ) {
    setCopyLanguages(state.nativeLanguage, state.targetLocale)
  }
})
