/** Test adapter only. The application composition root always chooses Postgres. */
import { randomBytes } from 'node:crypto'
import { RATE_LIMITS } from '../../common/errors.js'
import { windowMs } from '../../common/rate-limit.js'
import { MemoryRateLimitStore } from '../../common/rate-limit.memory.js'
import type { StoredRow } from '../merge.js'
import type {
  Alias,
  Cursor,
  Receipt,
  Replacement,
  SyncRepository,
  SyncTransaction,
} from '../sync.repository.js'

interface MemoryState {
  revision: number
  hlc: string
  rows: Map<string, StoredRow>
  changes: { revision: number; row: StoredRow }[]
  receipts: Map<string, Receipt>
  cursors: Map<string, Cursor>
  identities: Map<string, string>
  generations: Map<string, string>
  aliases: Map<string, string>
}
const fresh = (): MemoryState => ({
  revision: 0,
  hlc: '0:0000:srv',
  rows: new Map(),
  changes: [],
  receipts: new Map(),
  cursors: new Map(),
  identities: new Map(),
  generations: new Map(),
  aliases: new Map(),
})

export class InMemorySyncRepository implements SyncRepository {
  private readonly users = new Map<string, MemoryState>()
  private readonly limits = new MemoryRateLimitStore()
  private queue: Promise<void> = Promise.resolve()
  async consume(userId: string, now: number): Promise<boolean> {
    const decision = await this.limits.consume({
      key: `sync:${userId}`,
      limit: RATE_LIMITS.sync.perUser,
      windowMs: windowMs(RATE_LIMITS.sync.windowMinutes),
      now,
      algorithm: 'expire-reset',
    })
    return decision.allowed
  }
  transaction<T>(userId: string, work: (tx: SyncTransaction) => Promise<T>): Promise<T> {
    const pending = this.queue.then(async () => {
      const state = structuredClone(this.users.get(userId) ?? fresh())
      const result = await work(new MemoryTransaction(state))
      this.users.set(userId, state)
      return result
    })
    this.queue = pending.then(
      () => undefined,
      () => undefined,
    )
    return pending
  }
}
class MemoryTransaction implements SyncTransaction {
  constructor(private readonly state: MemoryState) {}
  head(): Promise<{ revision: number; hlc: string }> {
    return Promise.resolve({ revision: this.state.revision, hlc: this.state.hlc })
  }
  setHlc(hlc: string): Promise<void> {
    this.state.hlc = hlc
    return Promise.resolve()
  }
  get(entity: string, id: string): Promise<StoredRow | undefined> {
    return Promise.resolve(this.state.rows.get(`${entity}:${id}`))
  }
  put(row: StoredRow): Promise<void> {
    this.state.rows.set(`${row.entity}:${row.id}`, structuredClone(row))
    this.state.changes.push({ revision: ++this.state.revision, row: structuredClone(row) })
    return Promise.resolve()
  }
  receipt(deviceId: string, seq: number): Promise<Receipt | undefined> {
    return Promise.resolve(this.state.receipts.get(`${deviceId}:${seq}`))
  }
  accept(deviceId: string, seq: number, receipt: Receipt): Promise<void> {
    this.state.receipts.set(`${deviceId}:${seq}`, receipt)
    return Promise.resolve()
  }
  canonical(
    id: string,
    locale?: string,
    catalogId?: string,
    replaces?: Replacement,
  ): Promise<string> {
    const alias = this.state.aliases.get(id)
    if (alias) return Promise.resolve(alias)
    if (locale === undefined || catalogId === undefined) return Promise.resolve(id)
    const key = `${locale}:${catalogId}`
    if (replaces) {
      const generationKey = `${key}:${replaces.id}:${replaces.deleted_at}`
      const canonical = this.state.generations.get(generationKey) ?? id
      this.state.generations.set(generationKey, canonical)
      this.state.aliases.set(id, canonical)
      return Promise.resolve(canonical)
    }
    const existing = this.state.identities.get(key)
    if (existing && existing !== id) {
      this.state.aliases.set(id, existing)
      return Promise.resolve(existing)
    }
    this.state.identities.set(key, id)
    this.state.aliases.set(id, id)
    return Promise.resolve(id)
  }
  cursor(token: string): Promise<Cursor | undefined> {
    return Promise.resolve(this.state.cursors.get(token))
  }
  aliases(): Promise<Alias[]> {
    return Promise.resolve(
      [...this.state.aliases]
        .filter(([from, to]) => from !== to)
        .map(([from, to]) => ({ from, to })),
    )
  }
  saveCursor(cursor: Cursor): Promise<string> {
    const token = randomBytes(32).toString('base64url')
    this.state.cursors.set(token, cursor)
    return Promise.resolve(token)
  }
  changes(
    after: number,
    watermark: number,
    limit: number,
  ): Promise<{ revision: number; row: StoredRow }[]> {
    return Promise.resolve(
      this.state.changes
        .filter((event) => event.revision > after && event.revision <= watermark)
        .slice(0, limit),
    )
  }
  count(): Promise<number> {
    return Promise.resolve(this.state.rows.size)
  }
}
