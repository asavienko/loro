import { afterEach, describe, expect, it, vi } from 'vitest'
import { openSqlPersistence, userPhraseId, type FieldWrite, type OutboxOp } from '@loro/core'
import { makePhrase } from '@loro/core/testing'
import { PullResponseSchema, type PullResponse, type PushResponse } from '@loro/core/api/target'
import { openNodeSqlite } from './driver.node'
import { createSqlSyncStore } from './sync'
import { deferPhraseDelete, undoPendingPhraseDelete } from './pendingDeletes'
import { createSyncClient } from '../lib/sync/client'
import { outboxToWire } from '../lib/sync/codec'
import { SyncError, type SyncSession, type SyncTransport } from '../lib/sync/types'

const ID = '00000000-0000-7000-8000-000000000001'
const CANONICAL = '00000000-0000-7000-8000-000000000002'
const HLC = '1000:0001:device'
const SERVER_HLC = '2000:0001:server'
const session: SyncSession = { accountId: 'account1', deviceId: 'device' }
const databases: ReturnType<typeof openNodeSqlite>[] = []
afterEach(() => {
  for (const db of databases.splice(0)) db.close()
})

function database() {
  const driver = openNodeSqlite()
  databases.push(driver)
  const persistence = openSqlPersistence(driver, () => HLC, 1000)
  const observe = vi.fn((remote: string) => {
    driver.run(
      "INSERT INTO kv(k,v) VALUES('observed',?) ON CONFLICT(k) DO UPDATE SET v=excluded.v",
      [remote],
    )
  })
  const local = createSqlSyncStore({
    driver,
    persistence,
    hlc: () => HLC,
    receiveHlc: observe,
    now: () => 1000,
  })
  return { driver, persistence, local, observe }
}
function append(
  db: ReturnType<typeof database>,
  fields: Record<string, FieldWrite>,
  entity = 'user_phrase',
  entityId = ID,
) {
  db.persistence.outbox.append({
    entity,
    entityId,
    op: 'upsert',
    fields,
    hlc: HLC,
    createdAt: 1000,
  })
}
function field(v: string | number | boolean | null, hlc = HLC): FieldWrite {
  return { v, hlc }
}
function response(accepted: number[]): PushResponse {
  return { accepted, rejected: [], conflicts: [], server_hlc: SERVER_HLC, server_time: 2000 }
}
function page(changes: unknown[] = [], next = 'cursor1'): PullResponse {
  return PullResponseSchema.parse({ changes, next, has_more: false, server_hlc: SERVER_HLC })
}
function phraseChange(fields: Record<string, { v: unknown; hlc: string }> = {}, id = ID) {
  return {
    entity: 'user_phrase',
    entity_id: id,
    deleted_at: null,
    fields: {
      phraseId: field('cafe1'),
      source: field('starter'),
      addedAt: field(1000),
      targetLocale: field('es-ES'),
      ...fields,
    },
  }
}
function seed(db: ReturnType<typeof database>) {
  db.persistence.phrases.upsert({
    ...makePhrase('cafe1'),
    id: userPhraseId(ID),
    targetLocale: 'es-ES',
    addedAt: 1000,
  })
  append(db, {
    phraseId: field('cafe1'),
    source: field('starter'),
    addedAt: field(1000),
    targetLocale: field('es-ES'),
  })
}

describe('durable sync and canonical Rust merge', () => {
  it('converges two offline SQLite devices after duplicated and reordered delivery', () => {
    const left = database(),
      right = database()
    seed(left)
    seed(right)
    append(left, { reps: field(9, '1500:0000:left'), loved: field(true, '1500:0000:left') })
    append(right, {
      reps: field(3, '1600:0000:right'),
      note: field('Keep practising', '1600:0000:right'),
    })
    function changes(db: ReturnType<typeof database>) {
      return db.local
        .pending(100)
        .map((op) => outboxToWire(op))
        .map((op) => ({
          entity: op.entity,
          entity_id: op.entity_id,
          fields: op.op === 'upsert' ? op.fields : {},
          deleted_at: op.op === 'delete' ? op.deleted_at : null,
        }))
    }
    const a = changes(left),
      b = changes(right)
    left.local.applyPage(page([...b].reverse()))
    right.local.applyPage(page(a))
    left.local.applyPage(page(b))
    right.local.applyPage(page([...a].reverse()))
    expect(left.persistence.phrases.all()).toEqual(right.persistence.phrases.all())
    expect(left.persistence.phrases.all()[0]).toMatchObject({
      reps: 9,
      loved: true,
      note: 'Keep practising',
    })
  })
  it('preserves a provisional Undo deletion through a pull without making it a sync tombstone', () => {
    const db = database()
    seed(db)
    const runtime = { ...db, deviceId: 'device', hlc: () => HLC }
    db.persistence.phrases.softDelete(userPhraseId(ID), 1000)
    deferPhraseDelete(runtime, ID, 1000)
    db.local.applyPage(page([phraseChange({ loved: field(true, SERVER_HLC) })]))
    expect(db.persistence.phrases.count()).toBe(0)
    expect(undoPendingPhraseDelete(runtime, ID, 1100)).toBe(true)
    db.local.applyPage(page([phraseChange({ loved: field(true, SERVER_HLC) })]))
    expect(db.persistence.phrases.count()).toBe(1)
    expect(db.persistence.phrases.all()[0]?.loved).toBe(true)
  })
  it('merges a remote field without losing an offline local maximum and replays idempotently', () => {
    const db = database()
    seed(db)
    db.persistence.phrases.upsert({ ...db.persistence.phrases.byId(userPhraseId(ID))!, reps: 9 })
    append(db, { reps: field(9) })
    const remote = page([
      phraseChange({ reps: field(3, SERVER_HLC), loved: field(true, SERVER_HLC) }),
    ])
    db.local.applyPage(remote)
    db.local.applyPage(remote)
    expect(db.persistence.phrases.all()).toHaveLength(1)
    expect(db.persistence.phrases.byId(userPhraseId(ID))).toMatchObject({ reps: 9, loved: true })
    expect(db.local.state().cursor).toBe('cursor1')
    expect(db.persistence.outbox.size()).toBeGreaterThan(0)
  })
  it('rolls back rows and cursor when any row in a page cannot be applied', () => {
    const db = database()
    const invalid = phraseChange({ phraseId: field('cafe2') }, CANONICAL)
    delete (invalid.fields as Record<string, unknown>)['source']
    expect(() => {
      db.local.applyPage(page([phraseChange(), invalid]))
    }).toThrow('INCOMPLETE_PHRASE')
    expect(db.persistence.phrases.count()).toBe(0)
    expect(db.local.state().cursor).toBeNull()
    expect(db.driver.all('SELECT * FROM sync_rows')).toHaveLength(0)
  })
  it('retains a tombstone after a later offline edit and targets the correct course day', () => {
    const db = database()
    seed(db)
    db.local.applyPage(
      page([{ entity: 'user_phrase', entity_id: ID, fields: {}, deleted_at: 2000 }]),
    )
    db.local.applyPage(page([phraseChange({ loved: field(true, '3000:0000:late') })], 'cursor2'))
    expect(db.persistence.phrases.count()).toBe(0)
    db.persistence.refrainDay.save({
      localDay: '2026-09-08',
      targetLocale: 'bg-BG',
      setIds: [],
      waves: [],
      substituted: [],
    })
    db.persistence.refrainDay.save({
      localDay: '2026-09-08',
      targetLocale: 'es-ES',
      setIds: [],
      waves: [],
      substituted: [],
    })
    db.local.applyPage(
      page([
        { entity: 'refrain_day', entity_id: 'bg-BG:2026-09-08', fields: {}, deleted_at: 2000 },
      ]),
    )
    expect(db.persistence.refrainDay.load('2026-09-08', 'bg-BG')).toBeNull()
    expect(db.persistence.refrainDay.load('2026-09-08', 'es-ES')).not.toBeNull()
  })
  it('persists account ownership across adapter recreation and refuses another tenant', () => {
    const db = database()
    db.local.bindAccount('account1')
    const reopened = createSqlSyncStore({
      ...db,
      hlc: () => HLC,
      receiveHlc: db.observe,
      now: () => 1000,
    })
    expect(() => {
      reopened.bindAccount('account2')
    }).toThrow('ACCOUNT_MISMATCH')
    expect(() => {
      reopened.bindAccount('account1')
    }).not.toThrow()
  })
  it('keeps a sent seq immutable during new writes and compaction', () => {
    const db = database()
    append(db, { loved: field(true) })
    const sent = db.local.pending(100)
    db.local.beginPush(sent.map((op) => op.seq))
    append(db, { loved: field(false, '1100:0000:device') })
    db.persistence.outbox.compact(0)
    expect(db.local.pending(100)).toHaveLength(2)
    expect(db.local.pending(100)[0]?.fields['loved']?.v).toBe(true)
    db.local.commitPush(sent, response(sent.map((op) => op.seq)))
    expect(db.local.pending(100)[0]?.fields['loved']?.v).toBe(false)
  })
  it('uses original receipt clock corrections after a lost response and intervening remote edit', () => {
    const db = database()
    seed(db)
    const future = '200000000:0000:device'
    append(db, { loved: field(true, future) })
    db.driver.run('UPDATE user_phrase SET loved=1,field_hlc=? WHERE id=?', [
      JSON.stringify({ loved: future }),
      ID,
    ])
    const pending = db.local.pending(100)
    db.local.beginPush(pending.map((op) => op.seq))
    expect(db.local.pending(100).find((op) => op.fields['loved'])?.fields['loved']?.hlc).toBe(
      future,
    )
    // The server accepted at 2000, its reply was lost, and another device edited at
    // 2500. Receipt replay at 3000 must retain 2000, never invent a 3000 local clock.
    db.local.commitPush(pending, {
      ...response(pending.map((op) => op.seq)),
      server_time: 3000,
      clock_corrections: [
        {
          seq: pending.find((op) => op.fields['loved'])!.seq,
          field: 'loved',
          from: future,
          to: '2000:0000:device',
        },
      ],
    })
    db.local.applyPage(page([phraseChange({ loved: field(false, '2500:0000:other') })]))
    expect(db.persistence.phrases.byId(userPhraseId(ID))?.loved).toBe(false)
    expect(db.local.pending(100)).toHaveLength(0)
    expect(db.driver.all("SELECT v FROM kv WHERE k='sync.server_time'")).toEqual([{ v: '3000' }])
  })
  it('persists explicit re-add proof without folding it into other operations', () => {
    const db = database()
    const replaces = { id: ID, deleted_at: 1000 }
    db.persistence.outbox.append({
      entity: 'user_phrase',
      entityId: CANONICAL,
      op: 'upsert',
      fields: { phraseId: field('cafe1') },
      hlc: HLC,
      createdAt: 2000,
      replaces,
    })
    append(db, { loved: field(true) }, 'user_phrase', CANONICAL)
    db.persistence.outbox.compact(0)
    const ops = db.local.pending(100)
    expect(ops).toHaveLength(2)
    expect(outboxToWire(ops[0]!)).toMatchObject({ replaces })
    expect(ops[1]?.replaces).toBeUndefined()
  })
  it('corrects a future clock already merged into a day shadow before acknowledgement', () => {
    const db = database()
    const future = '200000000:0000:device'
    const dayId = 'es-ES:2026-09-08'
    append(
      db,
      { setIds: field(JSON.stringify([ID]), future), targetLocale: field('es-ES') },
      'refrain_day',
      dayId,
    )
    db.local.applyPage(
      page([
        {
          entity: 'refrain_day',
          entity_id: dayId,
          deleted_at: null,
          fields: { targetLocale: field('es-ES'), setIds: { v: [], hlc: HLC } },
        },
      ]),
    )
    const pending = db.local.pending(100)
    db.local.commitPush(pending, {
      ...response(pending.map((op) => op.seq)),
      server_time: 3000,
      clock_corrections: [
        { seq: pending[0]!.seq, field: 'setIds', from: future, to: '2000:0000:device' },
      ],
    })
    db.local.applyPage(
      page([
        {
          entity: 'refrain_day',
          entity_id: dayId,
          deleted_at: null,
          fields: {
            targetLocale: field('es-ES'),
            setIds: { v: [CANONICAL], hlc: '2500:0000:other' },
          },
        },
      ]),
    )
    expect(db.persistence.refrainDay.load('2026-09-08')?.setIds).toEqual([CANONICAL])
    expect(db.local.pending(100)).toHaveLength(0)
  })
  it('retains catalog tombstone identity on a fresh device without creating a live phrase', () => {
    const db = database()
    db.local.applyPage(
      page([
        {
          entity: 'user_phrase',
          entity_id: ID,
          deleted_at: 2000,
          fields: {},
          catalog_identity: { phraseId: 'cafe1', targetLocale: 'es-ES' },
        },
      ]),
    )
    expect(db.persistence.phrases.all()).toEqual([])
    expect(db.driver.all('SELECT * FROM sync_catalog_tombstones')).toEqual([
      { id: ID, phrase_id: 'cafe1', target_locale: 'es-ES', deleted_at: 2000 },
    ])
    expect(db.local.state().cursor).toBe('cursor1')
  })
  it('remaps a catalog alias with progress, frozen sets and unsent outbox references', () => {
    const db = database()
    seed(db)
    db.persistence.refrainDay.save({
      localDay: '2026-09-08',
      setIds: [ID],
      waves: [],
      substituted: [ID],
    })
    const sent = db.local.pending(100)
    db.local.beginPush(sent.map((op) => op.seq))
    append(db, { loved: field(true, '1100:0000:device') })
    db.local.commitPush(sent, {
      ...response(sent.map((op) => op.seq)),
      aliases: [{ from: ID, to: CANONICAL }],
    })
    expect(db.persistence.phrases.byId(userPhraseId(ID))).toBeNull()
    expect(db.persistence.phrases.byId(userPhraseId(CANONICAL))?.loved).toBe(true)
    expect(db.local.pending(100)[0]?.entityId).toBe(CANONICAL)
    expect(db.persistence.refrainDay.load('2026-09-08')?.setIds).toEqual([CANONICAL])
  })
  it('rejects unrelated and duplicated acknowledgements transactionally', () => {
    const db = database()
    seed(db)
    const pending = db.local.pending(100)
    expect(() => {
      db.local.commitPush(pending, response([999]))
    }).toThrow('INVALID_ACK')
    expect(db.persistence.outbox.size()).toBe(pending.length)
    expect(() => {
      db.local.commitPush(pending, {
        ...response([]),
        rejected: [
          { seq: pending[0]!.seq, index: 0, code: 'VALIDATION_FAILED' },
          { seq: pending[0]!.seq, index: 0, code: 'VALIDATION_FAILED' },
        ],
      })
    }).toThrow('INVALID_ACK')
  })
  it('quarantines a private recording payload locally without sending it', async () => {
    const db = database()
    append(db, { pcm: field('private') }, 'take')
    const push = vi.fn<SyncTransport['push']>()
    const client = createSyncClient({
      local: db.local,
      transport: { push, pull: () => Promise.resolve(page()) },
      getSession: () => session,
      now: () => 1000,
      random: () => 0,
    })
    expect(await client.run()).toMatchObject({ status: 'synced', quarantined: 1 })
    expect(push).not.toHaveBeenCalled()
    expect(db.driver.all('SELECT code FROM sync_dead_letters')).toEqual([
      { code: 'LOCAL_VALIDATION_FAILED' },
    ])
  })
  it('keeps failed requests durable across restart and retries only after persisted backoff', async () => {
    const db = database()
    seed(db)
    let now = 1000
    const push = vi
      .fn<SyncTransport['push']>()
      .mockRejectedValueOnce(new SyncError('HTTP_503'))
      .mockImplementation((request) => Promise.resolve(response(request.ops.map((op) => op.seq))))
    const options = {
      local: db.local,
      transport: { push, pull: () => Promise.resolve(page()) },
      getSession: () => session,
      now: () => now,
      random: () => 0,
    }
    const client = createSyncClient(options)
    expect(await client.run()).toMatchObject({ status: 'error', retryAt: 1500 })
    expect(db.persistence.outbox.size()).toBe(1)
    expect(await createSyncClient(options).run()).toEqual({ status: 'backoff' })
    now = 1500
    expect(await client.run()).toMatchObject({ status: 'synced', pushed: 1 })
    expect(db.persistence.outbox.size()).toBe(0)
  })
  it('never applies or acknowledges an in-flight response after sign-out', async () => {
    const db = database()
    seed(db)
    let current: SyncSession | null = session
    let resolve!: (result: PushResponse) => void
    const promise = new Promise<PushResponse>((done) => {
      resolve = done
    })
    const client = createSyncClient({
      local: db.local,
      transport: { push: () => promise, pull: () => Promise.resolve(page()) },
      getSession: () => current,
      now: () => 1000,
      random: () => 0,
    })
    const running = client.run()
    current = null
    resolve(response([db.local.pending(100)[0]!.seq]))
    expect(await running).toEqual({ status: 'account-changed' })
    expect(db.persistence.outbox.size()).toBe(1)
  })
  it('validates typed JSON fields and paired scheduling fields before transport', () => {
    const op: OutboxOp = {
      seq: 1,
      entity: 'user_phrase',
      entityId: ID,
      op: 'upsert',
      fields: { tags: field('["pron"]') },
      hlc: HLC,
      createdAt: 1000,
      attempts: 0,
    }
    expect(outboxToWire(op)).toMatchObject({ fields: { tags: { v: ['pron'] } } })
    expect(() => outboxToWire({ ...op, fields: { srsDue: field(3000) } })).toThrow()
  })
})
