/**
 * The in-memory sync store.
 *
 * Persistence isn't wired yet (plans/13-api-postgres-persistence.md), so rows live in a
 * `Map` and the service empties on restart. The MERGE semantics this store holds are
 * already the real ones — the same Rust code the client runs — which is the part worth
 * getting right first.
 *
 * Per instance, not per module: a provider means `Test.createTestingModule` gets a fresh
 * store instead of inheriting whatever a previous suite pushed.
 */

import { Injectable } from '@nestjs/common'
import type { StoredRow } from './merge.js'
import type { SyncRepository } from './sync.repository.js'

@Injectable()
export class InMemorySyncRepository implements SyncRepository {
  private readonly rows = new Map<string, StoredRow>()

  get(entity: string, id: string): Promise<StoredRow | undefined> {
    return Promise.resolve(this.rows.get(key(entity, id)))
  }

  put(row: StoredRow): Promise<void> {
    this.rows.set(key(row.entity, row.id), row)
    return Promise.resolve()
  }

  all(): Promise<StoredRow[]> {
    return Promise.resolve([...this.rows.values()])
  }

  count(): Promise<number> {
    return Promise.resolve(this.rows.size)
  }
}

/**
 * The composite key. Not user-scoped — see the note on `SyncRepository`; plans/06 owns
 * that, and this is the one line it changes.
 */
function key(entity: string, id: string): string {
  return `${entity}:${id}`
}
