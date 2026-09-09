import { useSyncExternalStore } from 'react'
import type { AccountClient, AccountState } from './client'

let client: AccountClient | null = null
const listeners = new Set<() => void>()
const initial: AccountState = { status: 'signed-out', session: null, error: null }
const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
export function configureAccount(value: AccountClient): void {
  if (client) return
  client = value
  value.subscribe(() => {
    for (const listener of listeners) listener()
  })
  for (const listener of listeners) listener()
}
export function accountClient(): AccountClient | null {
  return client
}
export function useAccount(): AccountState {
  return useSyncExternalStore(
    subscribe,
    () => client?.getSnapshot() ?? initial,
    () => initial,
  )
}
export type SyncDisplayStatus = 'pending' | 'syncing' | 'synced' | 'error'
export interface SyncDisplayState {
  status: SyncDisplayStatus
  /** Permanent wire rejections await a policy-backed correction flow. */
  quarantined: number
}
const initialSyncState: SyncDisplayState = { status: 'pending', quarantined: 0 }
let syncState = initialSyncState
let runSync: (() => Promise<void>) | null = null
export function configureAccountSync(run: () => Promise<void>): void {
  runSync = run
}
export function publishSyncStatus(
  value: SyncDisplayStatus,
  quarantined = syncState.quarantined,
): void {
  const next = { status: value, quarantined: Math.max(0, quarantined) }
  if (next.status === syncState.status && next.quarantined === syncState.quarantined) return
  syncState = next
  for (const listener of listeners) listener()
}
export function useSyncStatus(): SyncDisplayStatus {
  return useSyncExternalStore(
    subscribe,
    () => syncState.status,
    () => 'pending',
  )
}
/** Retrying sync never alters quarantined payloads. */
export function useSyncRepair(): Pick<SyncDisplayState, 'quarantined'> {
  return useSyncExternalStore(
    subscribe,
    () => syncState,
    () => initialSyncState,
  )
}
export async function syncNow(): Promise<void> {
  await runSync?.()
}
