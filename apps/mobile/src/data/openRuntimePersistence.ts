import { randomUUID } from 'expo-crypto'
import { openMemoryPersistence, type Persistence } from '@loro/core'
import { nextRuntimeHlc } from './runtimeHlc'

/** Browser development remains explicitly volatile; this is never a native error fallback. */
export function openRuntimePersistence(): Promise<Persistence> {
  const nodeId = randomUUID()
  return Promise.resolve(openMemoryPersistence((previous) => nextRuntimeHlc(previous, nodeId)))
}
