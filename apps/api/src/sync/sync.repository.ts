import type { StoredRow } from './merge.js'

export interface Alias {
  from: string
  to: string
}
export interface Receipt {
  digest: string
  conflicts: string[]
  aliases: Alias[]
  clockCorrections: ClockCorrection[]
}
export interface ClockCorrection {
  seq: number
  field: string
  from: string
  to: string
}
export interface Replacement {
  id: string
  deleted_at: number
}
export interface Cursor {
  after: number
  watermark: number | null
}
export interface SyncTransaction {
  head(): Promise<{ revision: number; hlc: string }>
  setHlc(hlc: string): Promise<void>
  get(entity: string, id: string): Promise<StoredRow | undefined>
  put(row: StoredRow): Promise<void>
  receipt(deviceId: string, seq: number): Promise<Receipt | undefined>
  accept(deviceId: string, seq: number, receipt: Receipt): Promise<void>
  canonical(
    id: string,
    locale?: string,
    catalogId?: string,
    replaces?: Replacement,
  ): Promise<string>
  aliases(): Promise<Alias[]>
  cursor(token: string): Promise<Cursor | undefined>
  saveCursor(cursor: Cursor): Promise<string>
  changes(
    after: number,
    watermark: number,
    limit: number,
  ): Promise<{ revision: number; row: StoredRow }[]>
  count(): Promise<number>
}
export interface SyncRepository {
  /** Rate counters commit independently even when the following write is rejected. */
  consume(userId: string, now: number): Promise<boolean>
  /** Serializes one user's merge/read/receipt transaction, including new row insertion. */
  transaction<T>(userId: string, work: (transaction: SyncTransaction) => Promise<T>): Promise<T>
}
export const SYNC_REPOSITORY = Symbol('SyncRepository')
