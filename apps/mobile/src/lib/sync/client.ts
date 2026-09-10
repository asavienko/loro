import { MAX_SYNC_BYTES, type PushOp } from '@loro/core/api/sync'
import type { OutboxOp } from '@loro/core'
import { outboxToWire, utf8ByteLength } from './codec'
import {
  SyncError,
  type SyncLocalStore,
  type SyncResult,
  type SyncSession,
  type SyncTransport,
} from './types'

const BATCH_SIZE = 100
const MAX_PAGES_PER_RUN = 100
const MAX_RETRY_MS = 5 * 60 * 1000

/** Single-flight, bounded, network-independent of every learner mutation. */
export function createSyncClient(options: {
  local: SyncLocalStore
  transport: SyncTransport
  getSession: () => SyncSession | null
  now: () => number
  random: () => number
  onApplied?: () => void
}) {
  let active: Promise<SyncResult> | null = null
  const same = (session: SyncSession): boolean => {
    const current = options.getSession()
    return current?.accountId === session.accountId && current.deviceId === session.deviceId
  }
  async function cycle(): Promise<SyncResult> {
    const session = options.getSession()
    if (!session) return { status: 'signed-out' }
    const { local } = options
    let currentSeqs: number[] = []
    let pushed = 0,
      pulled = 0,
      quarantined = 0
    try {
      local.bindAccount(session.accountId)
      if (local.state().nextAttemptAt > options.now()) return { status: 'backoff' }
      for (let batch = 0; batch < MAX_PAGES_PER_RUN; batch++) {
        const pending = local.pending(BATCH_SIZE)
        if (pending.length === 0) break
        const ops: PushOp[] = [],
          originals: OutboxOp[] = []
        const clientHlc = local.hlc()
        for (const op of pending) {
          try {
            const wire = outboxToWire(op)
            if (
              utf8ByteLength(JSON.stringify({ client_hlc: clientHlc, ops: [...ops, wire] })) >
              MAX_SYNC_BYTES
            ) {
              if (ops.length > 0) break
              throw new SyncError('PAYLOAD_TOO_LARGE')
            }
            ops.push(wire)
            originals.push(op)
          } catch {
            local.quarantine(op, 'LOCAL_VALIDATION_FAILED')
            quarantined++
          }
        }
        if (ops.length === 0) continue
        currentSeqs = originals.map((op) => op.seq)
        local.beginPush(currentSeqs)
        const response = await options.transport.push({ client_hlc: clientHlc, ops }, session)
        if (!same(session)) return { status: 'account-changed' }
        local.commitPush(originals, response)
        pushed += response.accepted.length
        quarantined += response.rejected.length
        options.onApplied?.()
        // A server omission cannot silently acknowledge or make this loop spin forever.
        if (response.accepted.length + response.rejected.length < ops.length)
          throw new SyncError('INCOMPLETE_ACK')
      }
      currentSeqs = []
      if (local.pending(1).length > 0) throw new SyncError('PAGE_BUDGET')
      let restarted = false
      for (let page = 0; page < MAX_PAGES_PER_RUN; page++) {
        const cursor = local.state().cursor
        let response
        try {
          response = await options.transport.pull({ since: cursor, limit: BATCH_SIZE }, session)
        } catch (error) {
          if (
            same(session) &&
            error instanceof SyncError &&
            error.code === 'CURSOR_EXPIRED' &&
            !restarted
          ) {
            local.resetCursor()
            restarted = true
            // Resetting an expired cursor is not a completed snapshot. Preserve
            // the reset for the next run when this attempt exhausted the budget.
            if (page === MAX_PAGES_PER_RUN - 1) throw new SyncError('PAGE_BUDGET')
            continue
          }
          throw error
        }
        if (!same(session)) return { status: 'account-changed' }
        if (response.has_more && response.next === cursor) throw new SyncError('CURSOR_STALLED')
        local.applyPage(response)
        pulled += response.changes.length
        options.onApplied?.()
        if (!response.has_more) break
        if (page === MAX_PAGES_PER_RUN - 1) throw new SyncError('PAGE_BUDGET')
      }
      local.succeeded()
      return {
        status: local.pending(1).length === 0 ? 'synced' : 'pending',
        pushed,
        pulled,
        quarantined: Math.max(quarantined, local.state().quarantined),
      }
    } catch (error) {
      if (!same(session)) return { status: 'account-changed' }
      const code = error instanceof SyncError ? error.code : 'SYNC_UNAVAILABLE'
      if (code === 'ACCOUNT_MISMATCH') return { status: 'error', code, retryAt: 0 }
      const delay = Math.min(MAX_RETRY_MS, 1000 * 2 ** Math.min(local.state().failures, 8))
      const jitter = 0.5 + Math.max(0, Math.min(1, options.random())) / 2
      const retryAt =
        options.now() +
        Math.max(Math.ceil(delay * jitter), error instanceof SyncError ? error.retryAfterMs : 0)
      local.fail(currentSeqs, code, retryAt)
      return { status: 'error', code, retryAt }
    }
  }
  return {
    run(): Promise<SyncResult> {
      active ??= cycle().finally(() => {
        active = null
      })
      return active
    },
  }
}
