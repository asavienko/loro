import { create } from 'zustand'
import { deviceClock } from '../lib/clock'
import { createLearnerStorage } from '../data/learner'
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

let opening: Promise<void> | null = null
export function initializeAppPersistence(): Promise<void> {
  if (usePersistence.getState().status === 'ready') return Promise.resolve()
  if (opening !== null) return opening
  usePersistence.setState({ status: 'opening', error: null })
  opening = getRuntimeDatabase()
    .then((database) => {
      attachStorePersistence(useApp, createLearnerStorage(database, deviceClock))
      useApp.getState().ensureRefrainSet()
      usePersistence.setState({ status: 'ready', error: null })
    })
    .catch(fail)
    .finally(() => {
      opening = null
    })
  return opening
}

export function reloadAppPersistence(): void {
  reloadStorePersistence(useApp)
}
