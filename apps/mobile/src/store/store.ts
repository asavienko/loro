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
import { dataOf, INITIAL_STATE } from './state'
import { structuralEqual } from '../lib/structuralEqual'
import type { ProgressDelta } from '@loro/core'
import { createPhrasesSlice } from './slices/phrases'
import { createPracticeSlice } from './slices/practice'
import { createRefrainSlice } from './slices/refrain'
import { createSessionSlice } from './slices/session'
import { createUiSlice } from './slices/ui'
import type { AppState, PracticeCommitContext, SliceContext, StoreDeps } from './types'
import type { LearnerStorage } from '../data/learner'

const storageControls = new WeakMap<
  StoreApi<AppState>,
  { attach(storage: LearnerStorage): void; reload(): void }
>()

export function createAppStore(deps: StoreDeps): UseBoundStore<StoreApi<AppState>> {
  let storage = deps.storage
  let publish: StoreApi<AppState>['setState']
  let read: StoreApi<AppState>['getState']
  let staged: AppState | null = null
  const wrappedUndos = new WeakSet<() => void>()
  const transact = <T>(operation: () => T, reset = false, attempt?: PracticeCommitContext): T => {
    if (staged !== null) return operation()
    if (attempt?.attemptId && storage?.hasAttempt(attempt)) return undefined as T
    const previous = read()
    staged = previous
    let writing = false
    try {
      const result = operation()
      const next = staged
      writing =
        storage !== undefined &&
        (reset ||
          attempt?.attemptId !== undefined ||
          !structuralEqual({ ...dataOf(previous), toast: null }, { ...dataOf(next), toast: null }))
      const committed =
        storage && writing
          ? reset
            ? storage.erase()
            : storage.commit(previous, next, attempt)
          : next
      writing = false
      let toast = next.toast
      const undo = toast?.undo
      if (toast && undo && !wrappedUndos.has(undo)) {
        const wrappedUndo = () => {
          transact(undo)
        }
        wrappedUndos.add(wrappedUndo)
        toast = { ...toast, undo: wrappedUndo }
      }
      publish({ ...next, ...committed, toast }, true)
      return result
    } catch (error) {
      if (writing) deps.onPersistenceError?.(error)
      throw error
    } finally {
      staged = null
    }
  }
  const durableSet: StoreApi<AppState>['setState'] = (partial, replace?: boolean) => {
    transact(() => {
      const current = staged ?? read()
      const patch = typeof partial === 'function' ? partial(current) : partial
      if (Object.is(patch, current)) return
      staged = (replace ? patch : { ...current, ...patch }) as AppState
    }, partial === INITIAL_STATE)
  }
  const store = create<AppState>((set, get, api) => {
    publish = set
    read = get
    api.setState = durableSet
    const ctx: SliceContext = {
      set: durableSet,
      get: () => staged ?? get(),
      deps,
      loadRefrainDay: (day, target) => storage?.refrainDay(day, target) ?? null,
      hasCatalog: (id, target) => storage?.hasCatalog(id, target) ?? false,
    }
    const actions = {
      ...createSessionSlice(ctx),
      ...createPhrasesSlice(ctx),
      ...createPracticeSlice(ctx),
      ...createRefrainSlice(ctx),
      ...createUiSlice(ctx),
    }
    const wrapped = Object.fromEntries(
      Object.entries(actions).map(([name, action]) => [
        name,
        (...args: unknown[]) => {
          const context =
            name === 'applyDelta' ? (args[1] as PracticeCommitContext | undefined) : undefined
          const delta = name === 'applyDelta' ? (args[0] as ProgressDelta) : undefined
          const attempt = context
            ? {
                ...context,
                ...(delta ? { phraseId: delta.phraseId } : {}),
                ...(delta?.review ? { review: delta.review } : {}),
              }
            : undefined
          return transact(
            () => Reflect.apply(action, undefined, args) as unknown,
            name === 'reset',
            attempt,
          )
        },
      ]),
    ) as typeof actions
    return { ...(storage?.load() ?? INITIAL_STATE), ...wrapped }
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
