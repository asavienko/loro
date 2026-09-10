import type { OutboxOp } from '@loro/core'
import type { PullRequest, PullResponse, PushRequest, PushResponse } from '@loro/core/api/sync'

export interface SyncSession {
  accountId: string
  deviceId: string
}
export interface SyncTransport {
  push(request: PushRequest, session: SyncSession): Promise<PushResponse>
  pull(request: PullRequest, session: SyncSession): Promise<PullResponse>
}
export interface SyncState {
  cursor: string | null
  failures: number
  nextAttemptAt: number
  quarantined: number
}
export interface SyncLocalStore {
  bindAccount(accountId: string): void
  state(): SyncState
  pending(limit: number): OutboxOp[]
  hlc(): string
  beginPush(seqs: readonly number[]): void
  commitPush(ops: readonly OutboxOp[], response: PushResponse): void
  applyPage(page: PullResponse): void
  quarantine(op: OutboxOp, code: string): void
  fail(seqs: readonly number[], code: string, nextAttemptAt: number): void
  resetCursor(): void
  succeeded(): void
}
export class SyncError extends Error {
  constructor(
    readonly code: string,
    readonly retryAfterMs = 0,
  ) {
    super(code)
    this.name = 'SyncError'
  }
}
export type SyncResult =
  | { status: 'signed-out' | 'account-changed' | 'backoff' }
  | { status: 'synced' | 'pending'; pushed: number; pulled: number; quarantined: number }
  | { status: 'error'; code: string; retryAt: number }
