import { isNetworkAvailable, onNetworkAvailable } from '../lib/connectivity'
import { AppState, Platform } from 'react-native'
import { getRuntimeDatabase } from '../data/runtime'
import { readLocalValue, writeLocalValue } from '../data/database'
import { createSqlSyncStore } from '../data/sync'
import { flushPendingDeletes } from '../data/pendingDeletes'
import { useApp, reloadStorePersistence } from '../store/store'
import { deviceClock } from '../lib/clock'
import { receiveHlc } from '../lib/core'
import { randomBytes } from '../lib/entropy'
import { AccountClient } from '../lib/account/client'
import { accountApiUrl } from '../lib/account/config'
import { credentialVault } from '../lib/account/vault'
import { configureAccount, configureAccountSync, publishSyncStatus } from '../lib/account/runtime'
import { createSyncClient, createHttpSyncTransport } from '../lib/sync'

const RETRY_POLL_MS = 30_000
const WRITE_DEBOUNCE_MS = 1500
let opening: Promise<void> | null = null
/** F-04: networking starts after hydration; no local write awaits it. */
export function startAccountSync(): Promise<void> {
  opening ??= start().catch(() => {
    publishSyncStatus('error')
  })
  return opening
}
async function start(): Promise<void> {
  const db = await getRuntimeDatabase()
  // Expo only inlines this exact dotted EXPO_PUBLIC access in the client bundle.
  const endpoint: unknown = process.env.EXPO_PUBLIC_API_URL
  const baseUrl = accountApiUrl(typeof endpoint === 'string' ? endpoint : undefined)
  const local = createSqlSyncStore({
    ...db,
    now: () => deviceClock.now(),
    receiveHlc: (remote) => {
      const previous = readLocalValue(db.driver, 'last_hlc') ?? db.hlc()
      writeLocalValue(
        db.driver,
        'last_hlc',
        receiveHlc(deviceClock.now(), previous, remote, db.deviceId),
      )
    },
  })
  const account = new AccountClient({
    baseUrl,
    vault: credentialVault,
    now: () => deviceClock.now(),
    anonId: db.deviceId,
    isOnline: isNetworkAvailable,
    device: {
      installation_id: db.deviceId,
      platform: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web',
      app_version: '0.0.0',
    },
    bindAccount: (id) => {
      local.bindAccount(id)
    },
  })
  configureAccount(account)
  await account.restore()
  if (!baseUrl) return
  const client = createSyncClient({
    local,
    transport: createHttpSyncTransport({
      baseUrl,
      getAccessToken: account.getAccessToken,
      getSession: () => account.getSnapshot().session,
    }),
    getSession: () => account.getSnapshot().session,
    now: () => deviceClock.now(),
    random: () => {
      const bytes = randomBytes(2)
      return ((bytes[0] ?? 0) * 256 + (bytes[1] ?? 0)) / 65535
    },
    onApplied: () => {
      reloadStorePersistence(useApp)
    },
  })
  let timer: ReturnType<typeof setTimeout> | null = null
  function schedule(delay = RETRY_POLL_MS): void {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      void run()
    }, delay)
  }
  async function run(): Promise<void> {
    if (!account.getSnapshot().session || AppState.currentState === 'background') return
    if (!(await isNetworkAvailable())) {
      publishSyncStatus('pending')
      schedule()
      return
    }
    publishSyncStatus('syncing')
    try {
      flushPendingDeletes(db, deviceClock.now())
      const result = await client.run()
      publishSyncStatus(
        result.status === 'synced'
          ? result.quarantined > 0
            ? 'error'
            : 'synced'
          : result.status === 'error' && result.code === 'ACCOUNT_MISMATCH'
            ? 'error'
            : 'pending',
      )
    } catch {
      publishSyncStatus('error')
    }
    if (account.getSnapshot().session) schedule()
  }
  configureAccountSync(run)
  account.subscribe(() => {
    if (account.getSnapshot().session) schedule(0)
    else {
      if (timer) clearTimeout(timer)
      timer = null
      publishSyncStatus('pending')
    }
  })
  useApp.subscribe(() => {
    if (account.getSnapshot().session && local.pending(1).length > 0) schedule(WRITE_DEBOUNCE_MS)
  })
  AppState.addEventListener('change', (state) => {
    if (state === 'active') schedule(0)
  })
  onNetworkAvailable(() => {
    schedule(0)
  })
  schedule(0)
}
