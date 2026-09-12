import { create } from 'zustand'
import { deviceClock } from '../lib/clock'
import { createLearnerStorage } from '../data/learner'
import { globalSlot } from '../data/globalSlot'
import { getRuntimeDatabase } from '../data/runtime'
import {
  attachStorePersistence,
  reloadStorePersistence,
  setPersistenceFailureHandler,
  useApp,
} from './store'

interface PersistenceState {
  status: 'opening' | 'ready' | 'error'
  /** Diagnostic text stays local and contains no learner row payload. */
  error: string | null
}
export const usePersistence = create<PersistenceState>(() => ({ status: 'opening', error: null }))

function fail(error: unknown): void {
  usePersistence.setState({
    status: 'error',
    error: error instanceof Error ? error.message : 'Storage failure',
  })
}
setPersistenceFailureHandler(fail)

const APP_PERSISTENCE_OPENING = Symbol.for('loro.appPersistenceOpening')

export function initializeAppPersistence(): Promise<void> {
  if (usePersistence.getState().status === 'ready') return Promise.resolve()
  const openings = globalSlot<Promise<void>>(APP_PERSISTENCE_OPENING)
  const inFlight = openings.get()
  if (inFlight) return inFlight
  usePersistence.setState({ status: 'opening', error: null })
  const opening = getRuntimeDatabase()
    .then((database) => {
      attachStorePersistence(useApp, createLearnerStorage(database, deviceClock))
      useApp.getState().ensureRefrainSet()
      usePersistence.setState({ status: 'ready', error: null })
    })
    .catch(fail)
    .finally(() => {
      if (openings.get() === opening) openings.set(undefined)
    })
  openings.set(opening)
  return opening
}

export function reloadAppPersistence(): void {
  reloadStorePersistence(useApp)
}
