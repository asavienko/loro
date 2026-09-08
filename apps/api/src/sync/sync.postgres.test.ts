/** F-04: real PostgreSQL restart, rollback and concurrent receipts. Set LORO_TEST_DATABASE_URL. */
import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { AuthPrincipal } from '../auth/auth.tokens.js'
import { PostgresDatabase } from '../database/database.js'
import { mergeAvailable, type StoredRow } from './merge.js'
import { PostgresSyncRepository } from './sync.repository.postgres.js'
import { SyncService } from './sync.service.js'

const databaseUrl = process.env['LORO_TEST_DATABASE_URL']
const id = (n: number) => `0197f2a0-0000-7000-8000-${String(n).padStart(12, '0')}`
const value = <T>(v: T, at = 1000) => ({ v, hlc: `${at}:0000:device-a` })
const envelope = (ops: unknown[]) => ({ client_hlc: '1000:0000:device-a', ops })
const phrase = (seq: number, rowId = id(seq)) => ({
  seq,
  entity: 'user_phrase',
  entity_id: rowId,
  op: 'upsert',
  fields: {
    targetLocale: value('es-ES'),
    source: value('starter'),
    addedAt: value(1000),
    phraseId: value(null),
    ownEs: value('Un café'),
    reps: value(2),
  },
})
const principal = (userId: string): AuthPrincipal => ({
  userId,
  deviceId: 'device-a',
  sessionId: 'session-a',
})
const clock = { now: () => 1_700_000_000_000 }

describe.skipIf(!databaseUrl)('sync against real PostgreSQL', () => {
  let admin: Pool
  const schema = `sync_test_${randomUUID().replaceAll('-', '')}`
  const databases: PostgresDatabase[] = []
  const database = () => {
    const db = new PostgresDatabase()
    databases.push(db)
    return db
  }

  beforeAll(async () => {
    admin = new Pool({ connectionString: databaseUrl })
    await admin.query(`CREATE SCHEMA ${schema}`)
    const integrationUrl = new URL(databaseUrl!)
    integrationUrl.searchParams.set('options', `-csearch_path=${schema}`)
    vi.stubEnv('DATABASE_URL', integrationUrl.toString())
  })

  afterAll(async () => {
    await Promise.all(databases.map((db) => db.onModuleDestroy()))
    await admin.query(`DROP SCHEMA ${schema} CASCADE`)
    await admin.end()
    vi.unstubAllEnvs()
  })

  it('loads actual Rust merge and installs the durable schema', async () => {
    expect(mergeAvailable()).toBe(true)
    expect(await database().ready()).toBe(true)
  })

  it('rolls back row, clock, revision, receipt, alias and cursor together', async () => {
    const db = database()
    const repository = new PostgresSyncRepository(db)
    const userId = randomUUID()
    let cursor = ''
    const row: StoredRow = { entity: 'user_phrase', id: id(1), fields: {}, deleted_at: 3000 }
    await expect(
      repository.transaction(userId, async (tx) => {
        await tx.put(row)
        await tx.setHlc('4000:0001:srv')
        await tx.accept('device-a', 1, {
          digest: 'receipt',
          aliases: [],
          conflicts: [],
          clockCorrections: [],
        })
        await tx.canonical(id(1), 'es-ES', 'cafe1')
        await tx.canonical(id(2), 'es-ES', 'cafe1')
        cursor = await tx.saveCursor({ after: 1, watermark: 1 })
        throw new Error('Simulated interrupted commit')
      }),
    ).rejects.toThrow('Simulated interrupted commit')
    await repository.transaction(userId, async (tx) => {
      expect(await tx.head()).toEqual({ revision: 0, hlc: '0:0000:srv' })
      expect(await tx.get('user_phrase', id(1))).toBeUndefined()
      expect(await tx.receipt('device-a', 1)).toBeUndefined()
      expect(await tx.cursor(cursor)).toBeUndefined()
      expect(await tx.canonical(id(2), 'es-ES', 'cafe1')).toBe(id(2))
    })
  })

  it('retains rows, aliases, receipts and pull positions after reopening the database', async () => {
    const user = principal(randomUUID())
    const firstDb = database()
    const firstRepository = new PostgresSyncRepository(firstDb)
    const first = new SyncService(firstRepository, clock)
    const initial = envelope([
      {
        ...phrase(1),
        fields: {
          targetLocale: value('es-ES'),
          source: value('starter'),
          addedAt: value(1000),
          phraseId: value('cafe1'),
          reps: value(5),
        },
      },
    ])
    await first.push(user, initial)
    const page = await first.pull(user, { since: null, limit: 1 })
    const duplicate = envelope([
      {
        ...phrase(1, id(2)),
        fields: {
          targetLocale: value('es-ES'),
          source: value('starter'),
          addedAt: value(1000),
          phraseId: value('cafe1'),
          loved: value(true, 2000),
        },
      },
    ])
    const otherDevice = { ...user, deviceId: 'device-b' }
    const accepted = await first.push(otherDevice, duplicate)
    const head = await firstRepository.transaction(user.userId, (tx) => tx.head())
    expect(accepted.aliases).toEqual([{ from: id(2), to: id(1) }])
    await firstDb.onModuleDestroy()
    databases.splice(databases.indexOf(firstDb), 1)

    const reopenedRepository = new PostgresSyncRepository(database())
    const reopened = new SyncService(reopenedRepository, clock)
    const replay = await reopened.push(otherDevice, duplicate)
    expect(replay.accepted).toEqual([1])
    expect(replay.aliases).toEqual(accepted.aliases)
    expect((await reopenedRepository.transaction(user.userId, (tx) => tx.head())).revision).toBe(
      head.revision,
    )
    const next = await reopened.pull(user, { since: page.next })
    expect(next.changes).toHaveLength(1)
    expect(next.changes[0]).toMatchObject({
      entity_id: id(1),
      fields: { reps: { v: 5 }, loved: { v: true } },
    })
    await expect(
      reopened.pull(principal(randomUUID()), { since: page.next }),
    ).rejects.toMatchObject({ code: 'CURSOR_EXPIRED' })
  })

  it('persists replacement generations and converges concurrent observed-tombstone re-adds', async () => {
    const user = principal(randomUUID())
    const otherDevice = { ...user, deviceId: 'device-b' }
    const catalog = (addedAt: number, reps: number) => ({
      targetLocale: value('es-ES'),
      phraseId: value('cafe1'),
      source: value('starter'),
      addedAt: value(addedAt),
      reps: value(reps),
    })
    const firstDb = database()
    const first = new SyncService(new PostgresSyncRepository(firstDb), clock)
    await first.push(user, envelope([{ ...phrase(1), fields: catalog(1000, 20) }]))
    await first.push(otherDevice, envelope([{ ...phrase(1, id(2)), fields: catalog(1000, 18) }]))
    await first.push(
      user,
      envelope([
        { seq: 2, entity: 'user_phrase', entity_id: id(1), op: 'delete', deleted_at: 3000 },
      ]),
    )
    await firstDb.onModuleDestroy()
    databases.splice(databases.indexOf(firstDb), 1)
    const repository = new PostgresSyncRepository(database())
    const reopened = new SyncService(repository, clock)
    const peer = new SyncService(new PostgresSyncRepository(database()), clock)
    const observed = (
      await peer.pull({ ...user, deviceId: 'fresh-device' }, { since: null })
    ).changes.find(
      (change) =>
        change.entity === 'user_phrase' && change.entity_id === id(1) && change.deleted_at !== null,
    )
    expect(observed).toEqual({
      entity: 'user_phrase',
      entity_id: id(1),
      fields: {},
      deleted_at: 3000,
      catalog_identity: { phraseId: 'cafe1', targetLocale: 'es-ES' },
    })
    if (
      observed?.entity !== 'user_phrase' ||
      observed.deleted_at === null ||
      !observed.catalog_identity
    )
      throw new Error('Missing durable catalog tombstone identity')
    const observedProof = { id: observed.entity_id, deleted_at: observed.deleted_at }
    const incorrect = await reopened.push(
      user,
      envelope([
        {
          ...phrase(3, id(3)),
          fields: catalog(4000, 1),
          replaces: { id: id(1), deleted_at: 2999 },
        },
      ]),
    )
    expect(incorrect.accepted).toEqual([])
    expect(incorrect.rejected).toEqual([{ seq: 3, index: 0, code: 'VALIDATION_FAILED' }])
    const replacements = await Promise.all([
      reopened.push(
        user,
        envelope([
          {
            ...phrase(3, id(3)),
            fields: catalog(4000, 1),
            replaces: observedProof,
          },
        ]),
      ),
      peer.push(
        otherDevice,
        envelope([
          {
            ...phrase(2, id(4)),
            fields: catalog(4000, 2),
            replaces: observedProof,
          },
        ]),
      ),
    ])
    expect(replacements.map((response) => response.accepted)).toEqual([[3], [2]])
    const currentId = await repository.transaction(user.userId, async (tx) => {
      expect(await tx.canonical(id(2))).toBe(id(1))
      expect((await tx.get('user_phrase', id(1)))?.deleted_at).toBe(3000)
      const current = await tx.canonical(id(3))
      expect(await tx.canonical(id(4))).toBe(current)
      const row = await tx.get('user_phrase', current)
      expect(row?.deleted_at).toBeNull()
      expect(row?.fields['reps']?.v).toBe(2)
      expect(await tx.count()).toBe(2)
      return current
    })
    const repeated = await peer.push(
      otherDevice,
      envelope([
        {
          ...phrase(3, currentId),
          fields: { ...catalog(4000, 1), loved: value(true, 5000) },
          replaces: observedProof,
        },
      ]),
    )
    expect(repeated.accepted).toEqual([3])
    expect(repeated.aliases).toEqual([])
    const repeatedRow = await repository.transaction(user.userId, (tx) =>
      tx.get('user_phrase', currentId),
    )
    expect(repeatedRow).toMatchObject({
      deleted_at: null,
      fields: { reps: { v: 2 }, loved: { v: true } },
    })
    const stale = await reopened.push(
      user,
      envelope([{ ...phrase(4, id(5)), fields: catalog(9000, 999) }]),
    )
    expect(stale.aliases).toEqual([{ from: id(5), to: id(1) }])
    await reopened.push(
      user,
      envelope([
        { seq: 5, entity: 'user_phrase', entity_id: currentId, op: 'delete', deleted_at: 6000 },
      ]),
    )
    const next = await reopened.push(
      user,
      envelope([
        {
          ...phrase(6, id(6)),
          fields: catalog(7000, 0),
          replaces: { id: currentId, deleted_at: 6000 },
        },
      ]),
    )
    expect(next.accepted).toEqual([6])
    expect(next.aliases).toEqual([])
    await repository.transaction(user.userId, async (tx) => {
      expect((await tx.get('user_phrase', currentId))?.deleted_at).toBe(6000)
      expect((await tx.get('user_phrase', id(6)))?.deleted_at).toBeNull()
    })
  })

  it('replays the original durable clock correction after a lost response and later server time', async () => {
    const user = principal(randomUUID())
    const originalTime = clock.now()
    let now = originalTime
    const firstDb = database()
    const first = new SyncService(new PostgresSyncRepository(firstDb), { now: () => now })
    const future = originalTime + 48 * 60 * 60 * 1000
    const body = envelope([
      {
        ...phrase(1),
        fields: { ...phrase(1).fields, note: value('Remember the article', future) },
      },
    ])
    const accepted = await first.push(user, body)
    expect(accepted.accepted).toEqual([1])
    expect(accepted.clock_corrections).toEqual([
      {
        seq: 1,
        field: 'note',
        from: `${future}:0000:device-a`,
        to: `${originalTime}:0000:device-a`,
      },
    ])
    await firstDb.onModuleDestroy()
    databases.splice(databases.indexOf(firstDb), 1)
    now += 60_000
    const repository = new PostgresSyncRepository(database())
    const reopened = new SyncService(repository, { now: () => now })
    const retry = await reopened.push(user, body)
    expect(retry.accepted).toEqual([1])
    expect(retry.server_time).toBe(now)
    expect(retry.clock_corrections).toEqual(accepted.clock_corrections)
    const stored = await repository.transaction(user.userId, (tx) => tx.get('user_phrase', id(1)))
    expect(stored?.fields['note']?.hlc.physical).toBe(originalTime)
  })

  it('retains the user rate charge when a transaction fails and across reconnect, then resets after a minute', async () => {
    const user = principal(randomUUID())
    let now = clock.now()
    const firstDb = database()
    const first = new SyncService(new PostgresSyncRepository(firstDb), { now: () => now })
    await expect(first.pull(user, { since: 'missing-checkpoint' })).rejects.toMatchObject({
      code: 'CURSOR_EXPIRED',
    })
    await firstDb.onModuleDestroy()
    databases.splice(databases.indexOf(firstDb), 1)
    const repository = new PostgresSyncRepository(database())
    const reopened = new SyncService(repository, { now: () => now })
    for (let request = 1; request < 120; request++) {
      expect((await reopened.push(user, envelope([]))).accepted).toEqual([])
    }
    await expect(
      reopened.push({ ...user, deviceId: 'device-b' }, envelope([])),
    ).rejects.toMatchObject({ code: 'RATE_LIMITED', status: 429 })
    expect((await reopened.push(principal(randomUUID()), envelope([]))).accepted).toEqual([])
    now += 60_000
    expect((await reopened.pull(user, { since: null })).changes).toEqual([])
  }, 20_000)

  it('serializes retries across independent pools and rejects a changed payload after restart', async () => {
    const user = principal(randomUUID())
    const repositoryA = new PostgresSyncRepository(database())
    const repositoryB = new PostgresSyncRepository(database())
    const first = new SyncService(repositoryA, clock)
    const second = new SyncService(repositoryB, clock)
    const body = envelope([phrase(1)])
    const responses = await Promise.all(
      Array.from({ length: 12 }, (_, index) => (index % 2 ? first : second).push(user, body)),
    )
    expect(responses.every((response) => response.accepted[0] === 1)).toBe(true)
    expect((await repositoryA.transaction(user.userId, (tx) => tx.head())).revision).toBe(1)
    const collision = await second.push(
      user,
      envelope([{ ...phrase(1), fields: { reps: value(99) } }]),
    )
    expect(collision.rejected).toEqual([{ index: 0, seq: 1, code: 'VALIDATION_FAILED' }])
    const otherDevice = await second.push(
      { ...user, deviceId: 'device-b' },
      envelope([phrase(1, id(2))]),
    )
    expect(otherDevice.accepted).toEqual([1])
    await Promise.all([
      first.push(
        user,
        envelope([
          {
            seq: 2,
            entity: 'user_phrase',
            entity_id: id(1),
            op: 'upsert',
            fields: { reps: value(20, 2000) },
          },
        ]),
      ),
      second.push(
        { ...user, deviceId: 'device-b' },
        envelope([
          {
            seq: 2,
            entity: 'user_phrase',
            entity_id: id(1),
            op: 'upsert',
            fields: { loved: value(true, 2000) },
          },
        ]),
      ),
    ])
    const merged = await repositoryA.transaction(user.userId, (tx) => tx.get('user_phrase', id(1)))
    expect(merged?.fields).toMatchObject({ reps: { v: 20 }, loved: { v: true } })
    expect(await first.status(user)).toMatchObject({ entities: 2 })
    expect((await first.pull(principal(randomUUID()), { since: null })).changes).toEqual([])
  })
})
