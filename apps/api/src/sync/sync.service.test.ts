/**
 * Sync arbitration, without HTTP.
 *
 * Every guard here was previously reachable only through `POST /sync/push`, and two of
 * them had no test at all. They are the guards that stop an undeclared field becoming
 * silent data loss (docs/architecture/sync-protocol.md), so they are worth asserting
 * directly — none of them needs the WASM merge, because each rejects before it.
 */

import { describe, expect, it } from 'vitest'
import { systemClock, type ServerClock } from '../common/clock.js'
import { LoroError } from '../common/errors.js'
import { mergeAvailable, type StoredRow } from './merge.js'
import { InMemorySyncRepository } from './sync.repository.memory.js'
import { SyncService, type PushOp } from './sync.service.js'

const hlc = (
  physical: number,
  node_id: string,
): { physical: number; logical: number; node_id: string } => ({
  physical,
  logical: 0,
  node_id,
})

const service = (clock: ServerClock = systemClock): SyncService =>
  new SyncService(new InMemorySyncRepository(), clock)

/** A clock that does not move, so a response string can be asserted exactly. */
const frozen = (at: number): ServerClock => ({ now: () => at })

const upsert = (overrides: Partial<PushOp> = {}): PushOp => ({
  seq: 1,
  entity: 'user_phrase',
  entity_id: 'up_1',
  op: 'upsert',
  fields: { reps: { v: 1, hlc: hlc(1000, 'a') } },
  ...overrides,
})

const needsWasm = it.skipIf(!mergeAvailable())

describe('push validation', () => {
  it('rejects a body whose `ops` is not an array', async () => {
    // Untrusted input: the type says `PushOp[]`, the wire says whatever it likes.
    const body = { ops: 'nope' } as unknown as { ops: PushOp[] }
    await expect(service().push(body)).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      status: 422,
    })
  })

  it('rejects a batch over the cap rather than merging 10,000 ops', async () => {
    const ops = Array.from({ length: 501 }, (_, i) => upsert({ seq: i, entity_id: `up_${i}` }))
    await expect(service().push({ ops })).rejects.toBeInstanceOf(LoroError)
  })

  it('accepts a batch at exactly the cap', async () => {
    // Off-by-one on a cap is the classic way a client's largest legal batch starts
    // failing, and it fails for every op at once.
    const ops = Array.from({ length: 500 }, (_, i) => upsert({ seq: i, entity: 'nope' }))
    const res = await service().push({ ops })
    expect(res.rejected).toHaveLength(500)
  })

  it('rejects an unknown entity without failing the rest of the batch', async () => {
    const res = await service().push({
      ops: [upsert({ seq: 1, entity: 'nope', fields: {} }), upsert({ seq: 2, entity: 'nope' })],
    })
    expect(res.accepted).toEqual([])
    expect(res.rejected).toEqual([
      { seq: 1, code: 'schema_unknown' },
      { seq: 2, code: 'schema_unknown' },
    ])
  })

  it('names the undeclared field rather than guessing a merge class for it', async () => {
    const res = await service().push({
      ops: [upsert({ fields: { someNewField: { v: 1, hlc: hlc(1, 'a') } } })],
    })
    expect(res.accepted).toEqual([])
    expect(res.rejected[0]).toEqual({ seq: 1, code: 'VALIDATION_FAILED', field: 'someNewField' })
  })

  it('treats an entity name inherited from Object.prototype as unknown', async () => {
    // `'toString' in FIELD_POLICY` is TRUE — the prototype chain. The guard therefore
    // has to be an own-property check (`isSyncEntity`), or a client can write rows under
    // `toString` / `constructor` that no field policy governs and every pull returns.
    const res = await service().push({ ops: [upsert({ entity: 'toString', fields: {} })] })
    expect(res.rejected).toEqual([{ seq: 1, code: 'schema_unknown' }])
  })
})

describe('push response', () => {
  it('reports a server clock the client can measure its own skew against', async () => {
    // The HLC format is a wire contract: the client parses the physical part out of it
    // to detect skew, so the exact string matters, not just that it is a string.
    const res = await service(frozen(1_700_000_000_000)).push({ ops: [] })
    expect(res).toEqual({
      accepted: [],
      rejected: [],
      conflicts: [],
      server_hlc: '1700000000000:0000:srv',
      server_time: 1_700_000_000_000,
    })
  })

  needsWasm('stamps a delete with the server clock when the client sent no time', async () => {
    const repo = new InMemorySyncRepository()
    const sync = new SyncService(repo, frozen(4_242))
    await sync.push({ ops: [upsert({ op: 'delete', fields: {} })] })
    expect((await repo.get('user_phrase', 'up_1'))?.deleted_at).toBe(4_242)
  })

  needsWasm('keeps a delete time the client DID send — the device owns that instant', async () => {
    const repo = new InMemorySyncRepository()
    const sync = new SyncService(repo, frozen(4_242))
    await sync.push({ ops: [upsert({ op: 'delete', fields: {}, deleted_at: 999 })] })
    expect((await repo.get('user_phrase', 'up_1'))?.deleted_at).toBe(999)
  })
})

describe('the injected store', () => {
  it('starts empty for each instance, so one suite cannot leak into the next', async () => {
    expect(await service().status()).toMatchObject({ entities: 0 })
  })

  needsWasm('writes the merged row through the repository, not to module state', async () => {
    const repo = new InMemorySyncRepository()
    const sync = new SyncService(repo, systemClock)

    await sync.push({ ops: [upsert({ fields: { reps: { v: 20, hlc: hlc(1000, 'a') } } })] })
    // A LOWER count with a LATER clock: `max` must hold 20. Asserted here to prove the
    // service read its local side back from the repository before merging.
    await sync.push({ ops: [upsert({ seq: 2, fields: { reps: { v: 18, hlc: hlc(9999, 'b') } } })] })

    const stored = await repo.get('user_phrase', 'up_1')
    expect(stored?.fields['reps']?.v).toBe(20)
    expect((await sync.pull({})).changes).toEqual([stored])
    // A second service with its own store sees none of it.
    expect(await service().status()).toMatchObject({ entities: 0 })
  })
})

describe('the in-memory repository', () => {
  const row = (entity: string, id: string): StoredRow => ({
    entity,
    id,
    fields: {},
    deleted_at: null,
  })

  it('keys on (entity, id), so two entities may share an id', async () => {
    const repo = new InMemorySyncRepository()
    await repo.put(row('user_phrase', 'x'))
    await repo.put(row('trip', 'x'))

    expect(await repo.count()).toBe(2)
    expect(await repo.get('user_phrase', 'x')).toEqual(row('user_phrase', 'x'))
    expect(await repo.get('settings', 'x')).toBeUndefined()
  })

  it('overwrites a row on a second put rather than appending', async () => {
    const repo = new InMemorySyncRepository()
    await repo.put(row('user_phrase', 'x'))
    await repo.put({ ...row('user_phrase', 'x'), deleted_at: 500 })

    expect(await repo.count()).toBe(1)
    expect((await repo.all())[0]?.deleted_at).toBe(500)
  })
})
