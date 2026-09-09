/** F-02/F-04: tenant isolation, durable receipts, and the target sync wire. */
import { describe, expect, it } from 'vitest'
import { PullResponseSchema, PushResponseSchema } from '@loro/core/api/target'
import type { AuthPrincipal } from '../auth/auth.tokens.js'
import type { ServerClock } from '../common/clock.js'
import { mergeAvailable } from './merge.js'
import { InMemorySyncRepository } from './testing/sync.repository.memory.js'
import { fieldValue, phraseUpsert, syncEnvelope, testRowId } from './testing/fixtures.js'
import { SyncService } from './sync.service.js'

const userA: AuthPrincipal = { userId: 'learner-a', deviceId: 'device-a', sessionId: 'session-a' }
const deviceB: AuthPrincipal = { ...userA, deviceId: 'device-b', sessionId: 'session-b' }
const userB: AuthPrincipal = { userId: 'learner-b', deviceId: 'device-a', sessionId: 'session-c' }
const id = testRowId
const value = fieldValue
const frozen: ServerClock = { now: () => 1_700_000_000_000 }
const envelope = syncEnvelope
const upsert = phraseUpsert
const setup = () => {
  const repository = new InMemorySyncRepository()
  return { repository, sync: new SyncService(repository, frozen) }
}
const needsWasm = it.skipIf(!mergeAvailable())

function field(change: { fields: unknown } | undefined, name: string): unknown {
  return (change?.fields as Record<string, { v: unknown }> | undefined)?.[name]?.v
}

describe('push validation', () => {
  it('rejects malformed envelopes, missing clocks, and oversized batches', async () => {
    const { sync } = setup()
    for (const body of [
      { client_hlc: '1000:0000:device-a', ops: 'nope' },
      { ops: [] },
      { client_hlc: 'broken', ops: [] },
      envelope(Array.from({ length: 501 }, (_, index) => upsert(index))),
      envelope(Array.from({ length: 300 }, () => ({ blob: 'x'.repeat(2000) }))),
    ]) {
      await expect(sync.push(userA, body)).rejects.toMatchObject({
        code: 'VALIDATION_FAILED',
        status: 422,
      })
    }
  })

  needsWasm(
    'validates all 500 allowed items, with null seq for an unidentifiable item',
    async () => {
      const { sync } = setup()
      const result = await sync.push(userA, envelope(Array.from({ length: 500 }, () => null)))
      expect(result.accepted).toEqual([])
      expect(result.rejected).toHaveLength(500)
      expect(result.rejected[499]).toMatchObject({
        index: 499,
        seq: null,
        code: 'VALIDATION_FAILED',
      })
    },
  )

  needsWasm(
    'rejects individual unknown entities, fields, malformed values and duplicate seqs',
    async () => {
      const { sync } = setup()
      const result = await sync.push(
        userA,
        envelope([
          upsert(1),
          { ...upsert(2), entity: 'toString' },
          { ...upsert(3), fields: { recording: value('private-audio') } },
          { ...upsert(4), fields: { reps: value(-1) } },
          { ...upsert(5), fields: { srsStability: value(4) } },
          { ...upsert(6), entity_id: 'not-a-uuid' },
          upsert(1, id(7)),
          null,
          upsert(8),
          { ...upsert(9), fields: { targetLocale: value('es-ES'), phraseId: value('cafe1') } },
        ]),
      )
      expect(PushResponseSchema.parse(result).accepted).toEqual([1, 8])
      expect(result.rejected.map(({ index, seq, code }) => ({ index, seq, code }))).toEqual([
        { index: 1, seq: 2, code: 'VALIDATION_FAILED' },
        { index: 2, seq: 3, code: 'VALIDATION_FAILED' },
        { index: 3, seq: 4, code: 'VALIDATION_FAILED' },
        { index: 4, seq: 5, code: 'VALIDATION_FAILED' },
        { index: 5, seq: 6, code: 'VALIDATION_FAILED' },
        { index: 6, seq: 1, code: 'VALIDATION_FAILED' },
        { index: 7, seq: null, code: 'VALIDATION_FAILED' },
        { index: 9, seq: 9, code: 'VALIDATION_FAILED' },
      ])
    },
  )
})

describe('accepted operation receipts', () => {
  needsWasm('acknowledges an identical retry without appending another revision', async () => {
    const { sync, repository } = setup()
    const body = envelope([upsert(1)])
    expect((await sync.push(userA, body)).accepted).toEqual([1])
    const firstHead = await repository.transaction(userA.userId, (tx) => tx.head())
    expect((await sync.push(userA, body)).accepted).toEqual([1])
    const replayHead = await repository.transaction(userA.userId, (tx) => tx.head())
    expect(replayHead.revision).toBe(firstHead.revision)
    expect((await sync.pull(userA, { since: null })).changes).toHaveLength(1)
  })

  needsWasm(
    'rejects a reused device seq with changed content without losing unrelated writes',
    async () => {
      const { sync } = setup()
      await sync.push(userA, envelope([upsert(1)]))
      const result = await sync.push(
        userA,
        envelope([upsert(1, id(1), { reps: value(50) }), upsert(2)]),
      )
      expect(result.accepted).toEqual([2])
      expect(result.rejected).toEqual([{ seq: 1, index: 0, code: 'VALIDATION_FAILED' }])
      const page = await sync.pull(userA, { since: null })
      expect(
        field(
          page.changes.find((change) => change.entity_id === id(1)),
          'reps',
        ),
      ).toBe(1)
    },
  )

  needsWasm('keys receipts by both authenticated learner and installation', async () => {
    const { sync } = setup()
    await sync.push(userA, envelope([upsert(1)]))
    expect((await sync.push(deviceB, envelope([upsert(1, id(2))]))).accepted).toEqual([1])
    expect((await sync.push(userB, envelope([upsert(1, id(3))]))).accepted).toEqual([1])
    expect(
      (await sync.pull(userA, { since: null })).changes.map((change) => change.entity_id),
    ).toEqual([id(1), id(2)])
    expect(
      (await sync.pull(userB, { since: null })).changes.map((change) => change.entity_id),
    ).toEqual([id(3)])
    expect(await sync.status(userA)).toMatchObject({ entities: 2 })
    expect(await sync.status(userB)).toMatchObject({ entities: 1 })
  })

  needsWasm('serializes concurrent retries to one row revision', async () => {
    const { sync, repository } = setup()
    const responses = await Promise.all(
      Array.from({ length: 10 }, () => sync.push(userA, envelope([upsert(1)]))),
    )
    expect(responses.every((response) => response.accepted[0] === 1)).toBe(true)
    expect((await repository.transaction(userA.userId, (tx) => tx.head())).revision).toBe(1)
  })
})

describe('opaque, account-bound change cursors', () => {
  needsWasm(
    'pins a page series before concurrent writes, then resumes after it without gaps',
    async () => {
      const { sync } = setup()
      await sync.push(userA, envelope([upsert(1), upsert(2), upsert(3)]))
      const first = PullResponseSchema.parse(await sync.pull(userA, { since: null, limit: 1 }))
      expect(first.changes.map((change) => change.entity_id)).toEqual([id(1)])
      expect(first.has_more).toBe(true)
      await sync.push(userA, envelope([upsert(4), upsert(5, id(1), { reps: value(8, 2000) })]))
      const second = await sync.pull(userA, { since: first.next, limit: 1 })
      const third = await sync.pull(userA, { since: second.next, limit: 1 })
      expect([...second.changes, ...third.changes].map((change) => change.entity_id)).toEqual([
        id(2),
        id(3),
      ])
      expect(third.has_more).toBe(false)
      const later = await sync.pull(userA, { since: third.next, limit: 500 })
      expect(later.changes.map((change) => change.entity_id)).toEqual([id(4), id(1)])
      expect(field(later.changes[1], 'reps')).toBe(8)
      expect(later.has_more).toBe(false)
      expect((await sync.pull(userA, { since: later.next })).changes).toEqual([])
      // Reusing an earlier checkpoint must replay precisely its remaining snapshot.
      expect(
        (await sync.pull(userA, { since: first.next, limit: 500 })).changes.map(
          (change) => change.entity_id,
        ),
      ).toEqual([id(2), id(3)])
    },
  )

  needsWasm('rejects another learner cursor and an unknown token as expired', async () => {
    const { sync } = setup()
    const { next } = await sync.pull(userA, { since: null })
    await expect(sync.pull(userB, { since: next })).rejects.toMatchObject({
      code: 'CURSOR_EXPIRED',
    })
    await expect(sync.pull(userA, { since: 'unrecognized-token' })).rejects.toMatchObject({
      code: 'CURSOR_EXPIRED',
    })
    for (const limit of [0, -1, 501, 1.5]) {
      await expect(sync.pull(userA, { since: null, limit })).rejects.toMatchObject({
        code: 'VALIDATION_FAILED',
      })
    }
  })
})

describe('per-account sync rate limit', () => {
  needsWasm(
    'counts failed transactions, shares the 120/minute quota across devices, and resets',
    async () => {
      let now = frozen.now()
      const sync = new SyncService(new InMemorySyncRepository(), { now: () => now })
      // Cursor lookup fails inside the transaction; its quota charge must still commit.
      await expect(sync.pull(userA, { since: 'unknown-checkpoint' })).rejects.toMatchObject({
        code: 'CURSOR_EXPIRED',
      })
      for (let request = 1; request < 120; request++) {
        const result = await sync.push(userA, envelope([null]))
        expect(result.rejected).toHaveLength(1)
      }
      await expect(sync.push(deviceB, envelope([]))).rejects.toMatchObject({
        code: 'RATE_LIMITED',
        status: 429,
      })
      expect((await sync.push(userB, envelope([]))).accepted).toEqual([])
      now += 59_999
      await expect(sync.pull(userA, { since: null })).rejects.toMatchObject({
        code: 'RATE_LIMITED',
      })
      now += 1
      expect((await sync.pull(userA, { since: null })).changes).toEqual([])
    },
  )
})

describe('shared Rust merging and catalog identity', () => {
  needsWasm(
    'round-trips explicit nulls and nested settings/Refrain objects through Rust',
    async () => {
      const { sync } = setup()
      const pair = { nativeLanguage: 'en', targetLocale: 'es-ES' }
      const waves = [{ wave: 'morning', completedAt: null }]
      const result = await sync.push(
        userA,
        envelope([
          upsert(1, id(1), { note: value(null) }),
          {
            seq: 2,
            entity: 'settings',
            entity_id: 'settings',
            op: 'upsert',
            fields: {
              languagePair: value(pair),
              goal: value(null),
              waveTimes: value(['08:00', '13:00', '19:00']),
              notifications: value(true),
            },
          },
          {
            seq: 3,
            entity: 'refrain_day',
            entity_id: 'es-ES:2026-09-08',
            op: 'upsert',
            fields: { targetLocale: value('es-ES'), setIds: value([id(1)]), waves: value(waves) },
          },
        ]),
      )
      expect(result.accepted).toEqual([1, 2, 3])
      const page = PullResponseSchema.parse(await sync.pull(userA, { since: null }))
      expect(
        field(
          page.changes.find((change) => change.entity === 'user_phrase'),
          'note',
        ),
      ).toBeNull()
      const settings = page.changes.find((change) => change.entity === 'settings')
      expect(field(settings, 'languagePair')).toEqual(pair)
      expect(field(settings, 'goal')).toBeNull()
      expect(field(settings, 'waveTimes')).toEqual(['08:00', '13:00', '19:00'])
      expect(field(settings, 'notifications')).toBe(true)
      expect(
        field(
          page.changes.find((change) => change.entity === 'refrain_day'),
          'waves',
        ),
      ).toEqual(waves)
      expect(page.changes.every((change) => change.deleted_at === null)).toBe(true)
    },
  )

  needsWasm(
    'preserves maximum counters and later editable fields across installations',
    async () => {
      const { sync } = setup()
      await sync.push(
        userA,
        envelope([upsert(1, id(1), { reps: value(20), difficulty: value('hard') })]),
      )
      await sync.push(
        deviceB,
        envelope([upsert(1, id(1), { reps: value(18, 9999), difficulty: value('easy', 9999) })]),
      )
      const changes = (await sync.pull(userA, { since: null })).changes
      expect(field(changes.at(-1), 'reps')).toBe(20)
      expect(field(changes.at(-1), 'difficulty')).toBe('easy')
    },
  )

  needsWasm(
    'merges duplicate catalog additions and returns an alias without dropping progress',
    async () => {
      const { sync } = setup()
      await sync.push(
        userA,
        envelope([
          {
            ...upsert(1),
            fields: {
              targetLocale: value('es-ES'),
              source: value('starter'),
              addedAt: value(1000),
              phraseId: value('cafe1'),
              reps: value(20),
              note: value('my note'),
            },
          },
        ]),
      )
      const duplicate = envelope([
        {
          ...upsert(1, id(2)),
          fields: {
            targetLocale: value('es-ES', 2000),
            source: value('starter'),
            addedAt: value(1000),
            phraseId: value('cafe1', 2000),
            reps: value(18, 2000),
            loved: value(true, 2000),
          },
        },
      ])
      const response = await sync.push(deviceB, duplicate)
      expect(response.accepted).toEqual([1])
      expect(response.aliases).toEqual([{ from: id(2), to: id(1) }])
      expect((await sync.push(deviceB, duplicate)).aliases).toEqual(response.aliases)
      const page = await sync.pull(userA, { since: null })
      const canonical = [...page.changes].reverse().find((change) => change.entity_id === id(1))
      expect(field(canonical, 'reps')).toBe(20)
      expect(field(canonical, 'note')).toBe('my note')
      expect(field(canonical, 'loved')).toBe(true)
      expect(await sync.status(userA)).toMatchObject({ entities: 1 })

      const references = await sync.push(
        deviceB,
        envelope([
          {
            seq: 2,
            entity: 'review_log',
            entity_id: id(3),
            op: 'upsert',
            fields: {
              phraseId: value(id(2)),
              at: value(3000),
              grade: value('good'),
              stability: value(5),
              difficulty: value(4),
              due: value(10000),
            },
          },
          {
            seq: 3,
            entity: 'refrain_day',
            entity_id: 'es-ES:2026-09-08',
            op: 'upsert',
            fields: { targetLocale: value('es-ES'), setIds: value([id(2)]), waves: value([]) },
          },
        ]),
      )
      expect(references.accepted).toEqual([2, 3])
      const referred = (await sync.pull(userA, { since: page.next })).changes
      expect(
        field(
          referred.find((change) => change.entity === 'review_log'),
          'phraseId',
        ),
      ).toBe(id(1))
      expect(
        field(
          referred.find((change) => change.entity === 'refrain_day'),
          'setIds',
        ),
      ).toEqual([id(1)])
    },
  )

  needsWasm(
    'repairs references written before alias discovery, including a caught-up device',
    async () => {
      const { sync } = setup()
      const catalogFields = {
        targetLocale: value('es-ES'),
        source: value('starter'),
        addedAt: value(1000),
        phraseId: value('cafe1'),
        reps: value(20),
      }
      await sync.push(userA, envelope([{ ...upsert(1), fields: catalogFields }]))
      await sync.push(
        deviceB,
        envelope([
          {
            seq: 1,
            entity: 'review_log',
            entity_id: id(3),
            op: 'upsert',
            fields: {
              phraseId: value(id(2)),
              at: value(3000),
              grade: value('good'),
              stability: value(5),
              difficulty: value(4),
              due: value(10000),
            },
          },
          {
            seq: 2,
            entity: 'refrain_day',
            entity_id: 'es-ES:2026-09-08',
            op: 'upsert',
            fields: {
              targetLocale: value('es-ES'),
              setIds: value([id(1), id(2)]),
              waves: value([]),
            },
          },
        ]),
      )
      const beforeAlias = await sync.pull(userA, { since: null })
      expect(
        field(
          beforeAlias.changes.find((change) => change.entity === 'review_log'),
          'phraseId',
        ),
      ).toBe(id(2))
      await sync.push(deviceB, envelope([{ ...upsert(3, id(2)), fields: catalogFields }]))
      const caughtUp = PullResponseSchema.parse(await sync.pull(userA, { since: beforeAlias.next }))
      expect(caughtUp.changes).toEqual([])
      expect(caughtUp.aliases).toEqual([{ from: id(2), to: id(1) }])
      const bootstrap = await sync.pull(userA, { since: null })
      expect(
        field(
          bootstrap.changes.find((change) => change.entity === 'review_log'),
          'phraseId',
        ),
      ).toBe(id(1))
      expect(
        field(
          bootstrap.changes.find((change) => change.entity === 'refrain_day'),
          'setIds',
        ),
      ).toEqual([id(1)])
    },
  )

  needsWasm(
    'rejects catalog identity changes without reserving the rejected identity or seq',
    async () => {
      const { sync } = setup()
      await sync.push(
        userA,
        envelope([
          {
            ...upsert(1),
            fields: {
              targetLocale: value('es-ES'),
              source: value('starter'),
              addedAt: value(1000),
              phraseId: value('cafe1'),
            },
          },
        ]),
      )
      const rejected = await sync.push(
        userA,
        envelope([
          {
            ...upsert(2, id(1)),
            fields: {
              targetLocale: value('es-ES'),
              source: value('starter'),
              addedAt: value(1000),
              phraseId: value('cafe2'),
            },
          },
        ]),
      )
      expect(rejected.rejected).toEqual([{ seq: 2, index: 0, code: 'VALIDATION_FAILED' }])
      const corrected = await sync.push(
        userA,
        envelope([
          {
            ...upsert(2, id(2)),
            fields: {
              targetLocale: value('es-ES'),
              source: value('starter'),
              addedAt: value(1000),
              phraseId: value('cafe2'),
            },
          },
        ]),
      )
      expect(corrected.accepted).toEqual([2])
      expect(corrected.aliases).toEqual([])
      expect(await sync.status(userA)).toMatchObject({ entities: 2 })
    },
  )

  needsWasm(
    'gives a fresh device nontext catalog tombstone identity and accepts repeated replacement snapshots',
    async () => {
      const { sync, repository } = setup()
      await sync.push(
        userA,
        envelope([
          {
            ...upsert(1),
            fields: {
              targetLocale: value('es-ES'),
              phraseId: value('cafe1'),
              source: value('starter'),
              addedAt: value(1000),
              ownEs: value('private override'),
              note: value('private note'),
              reps: value(20),
            },
          },
          { seq: 2, entity: 'user_phrase', entity_id: id(1), op: 'delete', deleted_at: 3000 },
          upsert(3, id(2), { ownEs: value('private own phrase') }),
          { seq: 4, entity: 'user_phrase', entity_id: id(2), op: 'delete', deleted_at: 3500 },
        ]),
      )
      const page = PullResponseSchema.parse(await sync.pull(deviceB, { since: null }))
      const tombstones = page.changes.filter((change) => change.deleted_at !== null)
      expect(tombstones).toEqual([
        {
          entity: 'user_phrase',
          entity_id: id(1),
          fields: {},
          deleted_at: 3000,
          catalog_identity: { phraseId: 'cafe1', targetLocale: 'es-ES' },
        },
        { entity: 'user_phrase', entity_id: id(2), fields: {}, deleted_at: 3500 },
      ])
      expect(JSON.stringify(tombstones)).not.toContain('private')
      expect((await sync.pull(userB, { since: null })).changes).toEqual([])
      const deleted = tombstones.find((change) => change.entity_id === id(1))
      if (deleted?.entity !== 'user_phrase' || !deleted.catalog_identity)
        throw new Error('Missing catalog tombstone identity')
      const replaces = { id: deleted.entity_id, deleted_at: deleted.deleted_at }
      const fields = {
        targetLocale: value(deleted.catalog_identity.targetLocale),
        phraseId: value(deleted.catalog_identity.phraseId),
        source: value('starter'),
        addedAt: value(4000),
        reps: value(5),
        note: value('after re-add'),
      }
      const added = await sync.push(deviceB, envelope([{ ...upsert(1, id(3)), fields, replaces }]))
      expect(added.accepted).toEqual([1])
      expect(added.aliases).toEqual([])
      const repeated = await sync.push(
        deviceB,
        envelope([
          {
            ...upsert(2, id(3)),
            fields: { ...fields, reps: value(2, 5000), loved: value(true, 5000) },
            replaces,
          },
        ]),
      )
      expect(repeated.accepted).toEqual([2])
      expect(repeated.aliases).toEqual([])
      await repository.transaction(userA.userId, async (tx) => {
        expect((await tx.get('user_phrase', id(1)))?.deleted_at).toBe(3000)
        expect(await tx.get('user_phrase', id(3))).toMatchObject({
          deleted_at: null,
          fields: { reps: { v: 5 }, loved: { v: true }, note: { v: 'after re-add' } },
        })
        expect(await tx.count()).toBe(3)
      })
      await sync.push(
        deviceB,
        envelope([
          { seq: 3, entity: 'user_phrase', entity_id: id(3), op: 'delete', deleted_at: 6000 },
        ]),
      )
      const deletedSnapshot = await sync.push(
        deviceB,
        envelope([{ ...upsert(4, id(3)), fields, replaces }]),
      )
      expect(deletedSnapshot.accepted).toEqual([])
      expect(deletedSnapshot.rejected).toEqual([{ seq: 4, index: 0, code: 'VALIDATION_FAILED' }])
    },
  )

  needsWasm(
    're-adds only with an observed tombstone proof while keeping the old ID and aliases deleted',
    async () => {
      const { sync, repository } = setup()
      const catalog = (addedAt: number, reps: number) => ({
        targetLocale: value('es-ES'),
        phraseId: value('cafe1'),
        source: value('starter'),
        addedAt: value(addedAt),
        reps: value(reps),
      })
      await sync.push(userA, envelope([{ ...upsert(1), fields: catalog(1000, 20) }]))
      await sync.push(deviceB, envelope([{ ...upsert(1, id(2)), fields: catalog(1000, 18) }]))
      await sync.push(
        userA,
        envelope([
          { seq: 2, entity: 'user_phrase', entity_id: id(1), op: 'delete', deleted_at: 3000 },
        ]),
      )
      const replacement = envelope([
        {
          ...upsert(3, id(3)),
          fields: catalog(4000, 0),
          replaces: { id: id(1), deleted_at: 3000 },
        },
      ])
      const response = await sync.push(userA, replacement)
      expect(response.accepted).toEqual([3])
      expect(response.aliases).toEqual([])
      const head = await repository.transaction(userA.userId, (tx) => tx.head())
      expect((await sync.push(userA, replacement)).accepted).toEqual([3])
      expect((await repository.transaction(userA.userId, (tx) => tx.head())).revision).toBe(
        head.revision,
      )
      await sync.push(deviceB, envelope([{ ...upsert(2, id(2)), fields: catalog(1000, 999) }]))
      await repository.transaction(userA.userId, async (tx) => {
        expect(await tx.canonical(id(2))).toBe(id(1))
        expect((await tx.get('user_phrase', id(1)))?.deleted_at).toBe(3000)
        const live = await tx.get('user_phrase', id(3))
        expect(live?.deleted_at).toBeNull()
        expect(live?.fields['reps']?.v).toBe(0)
      })
      const unknownDuplicate = await sync.push(
        deviceB,
        envelope([{ ...upsert(3, id(4)), fields: catalog(9000, 999) }]),
      )
      expect(unknownDuplicate.aliases).toEqual([{ from: id(4), to: id(1) }])
      const parallelReadd = await sync.push(
        deviceB,
        envelope([
          {
            ...upsert(4, id(5)),
            fields: catalog(4000, 2),
            replaces: { id: id(1), deleted_at: 3000 },
          },
        ]),
      )
      expect(parallelReadd.aliases).toEqual([{ from: id(5), to: id(3) }])
      const page = PullResponseSchema.parse(await sync.pull(userA, { since: null }))
      const last = [...page.changes].reverse()
      expect(last.find((change) => change.entity_id === id(1))).toMatchObject({
        fields: {},
        deleted_at: 3000,
      })
      expect(last.find((change) => change.entity_id === id(3))).toMatchObject({
        deleted_at: null,
        fields: { reps: { v: 2 } },
      })
    },
  )

  needsWasm(
    'rejects invalid replacement proofs independently without claiming their seq or identity',
    async () => {
      const { sync, repository } = setup()
      const fields = {
        targetLocale: value('es-ES'),
        phraseId: value('cafe1'),
        source: value('starter'),
        addedAt: value(4000),
        reps: value(0),
      }
      await sync.push(userA, envelope([{ ...upsert(1), fields }]))
      await sync.push(
        userA,
        envelope([{ ...upsert(2, id(20)), fields: { ...fields, phraseId: value('cafe2') } }]),
      )
      await sync.push(
        userA,
        envelope([
          { seq: 3, entity: 'user_phrase', entity_id: id(1), op: 'delete', deleted_at: 3000 },
        ]),
      )
      const validProof = { id: id(1), deleted_at: 3000 }
      const invalid = [
        { ...upsert(4, id(4)), fields, replaces: { ...validProof, deleted_at: 2999 } },
        { ...upsert(5, id(5)), fields, replaces: { id: id(99), deleted_at: 3000 } },
        {
          ...upsert(6, id(6)),
          fields: { ...fields, phraseId: value('cafe2') },
          replaces: { id: id(20), deleted_at: 3000 },
        },
        {
          ...upsert(7, id(7)),
          fields: { ...fields, targetLocale: value('bg-BG') },
          replaces: validProof,
        },
        {
          ...upsert(8, id(8)),
          fields: { ...fields, phraseId: value('cafe3') },
          replaces: validProof,
        },
        { ...upsert(9, id(1)), fields, replaces: validProof },
      ]
      const result = await sync.push(
        userA,
        envelope([
          ...invalid,
          { ...upsert(10, id(10)), fields: { ...fields, phraseId: value('cafe4') } },
        ]),
      )
      expect(result.accepted).toEqual([10])
      expect(result.aliases).toEqual([])
      expect(result.rejected.map(({ seq }) => seq)).toEqual([4, 5, 6, 7, 8, 9])
      await repository.transaction(userA.userId, async (tx) => {
        for (const seq of [4, 5, 6, 7, 8, 9])
          expect(await tx.receipt(userA.deviceId, seq)).toBeUndefined()
        expect(await tx.aliases()).toEqual([])
      })
      const otherAccount = await sync.push(
        userB,
        envelope([{ ...upsert(1, id(4)), fields, replaces: validProof }]),
      )
      expect(otherAccount.accepted).toEqual([])
      expect(otherAccount.rejected).toEqual([{ index: 0, seq: 1, code: 'VALIDATION_FAILED' }])
      const corrected = await sync.push(
        userA,
        envelope([{ ...upsert(4, id(4)), fields, replaces: validProof }]),
      )
      expect(corrected.accepted).toEqual([4])
      expect(corrected.aliases).toEqual([])
    },
  )

  needsWasm('does not deduplicate the same catalog ID across different courses', async () => {
    const { sync } = setup()
    const result = await sync.push(
      userA,
      envelope([
        {
          ...upsert(1),
          fields: {
            targetLocale: value('es-ES'),
            source: value('starter'),
            addedAt: value(1000),
            phraseId: value('cafe1'),
          },
        },
        {
          ...upsert(2),
          fields: {
            targetLocale: value('bg-BG'),
            source: value('starter'),
            addedAt: value(1000),
            phraseId: value('cafe1'),
          },
        },
      ]),
    )
    expect(result.aliases ?? []).toEqual([])
    expect(await sync.status(userA)).toMatchObject({ entities: 2 })
  })

  needsWasm(
    'publishes an empty-field tombstone and never resurrects it on a stale upsert',
    async () => {
      const { sync } = setup()
      await sync.push(userA, envelope([upsert(1)]))
      const initial = await sync.pull(userA, { since: null })
      await sync.push(
        userA,
        envelope([
          { seq: 2, entity: 'user_phrase', entity_id: id(1), op: 'delete', deleted_at: 3000 },
        ]),
      )
      const removed = PullResponseSchema.parse(await sync.pull(userA, { since: initial.next }))
      expect(removed.changes).toEqual([
        { entity: 'user_phrase', entity_id: id(1), fields: {}, deleted_at: 3000 },
      ])
      await sync.push(deviceB, envelope([upsert(1, id(1), { reps: value(500, 4000) })]))
      const changes = (await sync.pull(userA, { since: null })).changes
      expect(changes.at(-1)).toMatchObject({ entity_id: id(1), fields: {}, deleted_at: 3000 })
    },
  )

  needsWasm('uses a monotonic HLC even when the wall clock does not move', async () => {
    const { sync } = setup()
    const first = PushResponseSchema.parse(await sync.push(userA, envelope([])))
    const second = PushResponseSchema.parse(await sync.push(userA, envelope([])))
    expect(first.server_time).toBe(frozen.now())
    expect(second.server_time).toBe(frozen.now())
    expect(second.server_hlc).not.toBe(first.server_hlc)
    expect(Number(second.server_hlc.split(':')[1])).toBeGreaterThan(
      Number(first.server_hlc.split(':')[1]),
    )
  })
})
