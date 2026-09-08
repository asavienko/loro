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
let syncStatus: SyncDisplayStatus = 'pending'
let runSync: (() => Promise<void>) | null = null
export function configureAccountSync(run: () => Promise<void>): void {
  runSync = run
}
export function publishSyncStatus(value: SyncDisplayStatus): void {
  if (value === syncStatus) return
  syncStatus = value
  for (const listener of listeners) listener()
}
export function useSyncStatus(): SyncDisplayStatus {
  return useSyncExternalStore(
    subscribe,
    () => syncStatus,
    () => 'pending',
  )
}
export async function syncNow(): Promise<void> {
  await runSync?.()
}
