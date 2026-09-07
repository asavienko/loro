/**
 * The store instance.
 *
 * ONE shared phrase store, exactly as the blueprint does it (`Loro.dc.html:3575-3626`).
 * Rating a phrase in the stream updates the Progress histogram because both read the
 * same rows — no wiring between the screens.
 *
 * Native bootstrap installs a repository projection and transactional write boundary.
 * Tests and the explicit web development adapter may keep ephemeral memory storage.
 *
 * This file only composes: the data comes from `state.ts` and each action from the slice
 * that owns its concern. `createAppStore` will not compile until every action in
 * `AppActions` is supplied by exactly one slice, so the composition is checked rather than
 * remembered.
 */

import type { ProgressDelta } from '@loro/core'
import { create, type StoreApi, type UseBoundStore } from 'zustand'
import { deviceClock } from '../lib/clock'
import { setCopyLanguages } from '../lib/i18n'
import { newId } from '../lib/ids'
import { structuralEqual } from '../lib/structuralEqual'
import { dataOf, INITIAL_STATE } from './state'
import { canonicalCoreFacade } from './coreFacade'
import { createPhrasesSlice } from './slices/phrases'
import { createPracticeSlice } from './slices/practice'
import { createRefrainSlice } from './slices/refrain'
import { createSessionSlice } from './slices/session'
import { createUiSlice } from './slices/ui'
import type {
  AppState,
  PracticeCommitContext,
  SliceContext,
  StoreDeps,
  StorePersistence,
} from './types'

function practiceContext(args: unknown[]): PracticeCommitContext | undefined {
  const context = args[1] as PracticeCommitContext | undefined
  if (!context) return undefined
  const delta = args[0] as ProgressDelta
  return { ...context, phraseId: delta.phraseId, ...(delta.review ? { review: delta.review } : {}) }
}

/** Attach storage only after the platform has opened/migrated it successfully. */
const persistenceWriteErrors = new WeakSet()
export function isPersistenceWriteError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && persistenceWriteErrors.has(error)
}
const writeErrorListeners = new Set<() => void>()
export function subscribeWriteErrors(listener: () => void): () => void {
  writeErrorListeners.add(listener)
  return () => {
    writeErrorListeners.delete(listener)
  }
}
const initializers = new WeakMap<
  StoreApi<AppState>,
  (persistence: StorePersistence, core?: StoreDeps['core']) => void
>()
export function initializeStorePersistence(
  store: StoreApi<AppState>,
  persistence: StorePersistence,
  core?: StoreDeps['core'],
): void {
  const initialize = initializers.get(store)
  if (!initialize) throw new Error('Unknown application store')
  initialize(persistence, core)
}

export function createAppStore(deps: StoreDeps): UseBoundStore<StoreApi<AppState>> {
  deps = { ...deps, core: deps.core ?? canonicalCoreFacade }
  let persistence = deps.persistence
  const wrappedUndos = new WeakSet<() => void>()
  let staged: AppState | null = null
  let rawSet: StoreApi<AppState>['setState']
  let rawGet: StoreApi<AppState>['getState']
  const transact = <T>(operation: () => T, reset = false, attempt?: PracticeCommitContext): T => {
    if (staged !== null) return operation()
    if (attempt && persistence?.hasAttempt?.(attempt)) return undefined as T
    const before = rawGet()
    staged = before
    let writing = false
    try {
      const result = operation()
      const after = staged
      writing =
        persistence !== undefined &&
        (reset ||
          attempt !== undefined ||
          !structuralEqual({ ...dataOf(before), toast: null }, { ...dataOf(after), toast: null }))
      const committed =
        persistence && writing
          ? reset
            ? persistence.reset()
            : persistence.commit(dataOf(before), dataOf(after), attempt)
          : dataOf(after)
      writing = false
      // Functions (including ephemeral undo) stay in memory; durable fields are read back.
      let toast = after.toast
      const undo = toast?.undo
      if (toast && undo && !wrappedUndos.has(undo)) {
        const wrappedUndo = () => {
          transact(undo)
        }
        wrappedUndos.add(wrappedUndo)
        toast = { message: toast.message, undo: wrappedUndo }
      }
      rawSet({ ...after, ...committed, toast }, true)
      return result
    } catch (error) {
      if (writing) {
        if (typeof error === 'object' && error !== null) persistenceWriteErrors.add(error)
        for (const listener of writeErrorListeners) listener()
      }
      throw error
    } finally {
      staged = null
    }
  }
  const stageSet: StoreApi<AppState>['setState'] = (partial, replace?) => {
    transact(() => {
      const current = staged ?? rawGet()
      const next = typeof partial === 'function' ? partial(current) : partial
      staged = (replace ? next : { ...current, ...next }) as AppState
    })
  }
  const store = create<AppState>((set, get) => {
    rawSet = set
    rawGet = get
    const ctx: SliceContext = { set: stageSet, get: () => staged ?? get(), deps }
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
        (...args: unknown[]) =>
          transact(
            () => Reflect.apply(action, undefined, args) as unknown,
            name === 'reset',
            name === 'applyDelta' ? practiceContext(args) : undefined,
          ),
      ]),
    ) as typeof actions
    return { ...INITIAL_STATE, ...wrapped }
  })
  // Existing route checkpoints use setState. They pass through the same write boundary.
  store.setState = stageSet
  initializers.set(store, (next, core) => {
    if (core) deps.core = core
    const loaded = next.load()
    persistence = next
    deps.persistence = next
    if (loaded) rawSet({ ...loaded, toast: null })
    store.getState().ensureRefrainSet()
  })
  if (persistence) initializeStorePersistence(store, persistence)
  return store
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
