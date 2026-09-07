/** P2-04 / LB-25. No learner route mounts before core and local hydration succeed. */
import { useSyncExternalStore } from 'react'
import { loadCore } from '../core/loader'
import { openRuntimePersistence } from '../data/openRuntimePersistence'
import { createRuntimePersistence } from '../data/runtimePersistence'
import { deviceClock } from '../lib/clock'
import type { StorePersistence } from './types'
import { canonicalCoreFacade } from './coreFacade'
import { initializeStorePersistence, useApp } from './store'

type BootstrapStatus = 'loading' | 'ready' | 'error'
let status: BootstrapStatus = 'loading'
let pending: Promise<void> | undefined
const listeners = new Set<() => void>()
function publish(next: BootstrapStatus): void {
  status = next
  for (const listener of listeners) listener()
}
export function useBootstrapStatus(): BootstrapStatus {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    () => status,
    () => 'loading',
  )
}

/** Development-only, one-shot transport seam; release builds have no runtime override. */
async function bootTestSeam(): Promise<void> {
  if (!__DEV__ || typeof sessionStorage === 'undefined') return
  const scenario = sessionStorage.getItem('loro:bootstrap-test')
  sessionStorage.removeItem('loro:bootstrap-test')
  if (scenario === 'error') throw new Error('Injected startup failure')
  if (scenario === 'loading')
    await new Promise<void>(() => {
      /* Deliberately pending for startup-state coverage. */
    })
}

/** Injects one failed local commit in development, before any durable write. */
function withWriteTestSeam(persistence: StorePersistence): StorePersistence {
  if (!__DEV__) return persistence
  let failNext = false
  ;(globalThis as typeof globalThis & { __loroFailNextWrite?: () => void }).__loroFailNextWrite =
    () => {
      failNext = true
    }
  return {
    ...persistence,
    commit(...args) {
      if (failNext) {
        failNext = false
        throw new Error('Injected local commit failure')
      }
      return persistence.commit(...args)
    },
  }
}

export function startLearningRuntime(): Promise<void> {
  if (status === 'ready') return Promise.resolve()
  if (pending) return pending
  publish('loading')
  pending = (async () => {
    try {
      await bootTestSeam()
      await loadCore()
      const persistence = await openRuntimePersistence()
      initializeStorePersistence(
        useApp,
        withWriteTestSeam(createRuntimePersistence(persistence, { clock: deviceClock })),
        canonicalCoreFacade,
      )
      publish('ready')
    } catch {
      // Never clear the database or replace failed native storage with volatile memory.
      publish('error')
    } finally {
      pending = undefined
    }
  })()
  return pending
}
