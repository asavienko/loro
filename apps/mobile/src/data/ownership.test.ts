import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openSqlPersistence, userPhraseId, type OutboxAppend, type Persistence } from '@loro/core'
import { makePhrase } from '@loro/core/testing'
import { openNodeSqlite, type NodeSqliteDriver } from './driver.node'

const AT = 1_785_231_660_000

function write(value: number, extras: Partial<OutboxAppend> = {}): OutboxAppend {
  return {
    entity: 'user_phrase',
    entityId: 'same-row',
    op: 'upsert',
    fields: { reps: { v: value, hlc: `h${String(value)}` } },
    hlc: `h${String(value)}`,
    createdAt: AT,
    ...extras,
  }
}

describe('SQLite learner ownership', () => {
  let driver: NodeSqliteDriver
  let local: Persistence
  let other: Persistence

  beforeEach(() => {
    driver = openNodeSqlite()
    local = openSqlPersistence(driver, () => 'h', AT)
    other = openSqlPersistence(driver, () => 'h', AT, 'other')
  })

  afterEach(() => {
    driver.close()
  })

  it('keeps owner queues separate when both edit the same row', () => {
    local.outbox.append(write(1, { fields: { difficulty: { v: 'hard', hlc: 'h1' } } }))
    other.outbox.append(write(2, { fields: { difficulty: { v: 'easy', hlc: 'h2' } } }))
    local.outbox.append(write(3, { fields: { difficulty: { v: 'med', hlc: 'h3' } } }))

    expect(local.outbox.size()).toBe(1)
    expect(other.outbox.size()).toBe(1)
    expect(local.outbox.pending(1)[0]?.fields['difficulty']?.v).toBe('med')
    expect(other.outbox.pending(1)[0]?.fields['difficulty']?.v).toBe('easy')
    expect(driver.all('SELECT user_id FROM outbox ORDER BY seq')).toEqual([
      { user_id: 'local' },
      { user_id: 'other' },
    ])
  })

  it('cannot acknowledge or mark failed another owner sequence', () => {
    local.outbox.append(write(1))
    other.outbox.append(write(2))
    const localSeq = local.outbox.pending(1)[0]!.seq
    const otherSeq = other.outbox.pending(1)[0]!.seq

    local.outbox.recordFailure([localSeq, otherSeq], 'offline')
    expect(local.outbox.pending(1)[0]?.attempts).toBe(1)
    expect(other.outbox.pending(1)[0]?.attempts).toBe(0)
    local.outbox.ack([localSeq, otherSeq])
    expect(local.outbox.size()).toBe(0)
    expect(other.outbox.pending(1)[0]?.seq).toBe(otherSeq)
  })

  it('compacts only its owner while preserving attempted payloads and replacement proof', () => {
    local.outbox.append(write(1))
    const attempted = local.outbox.pending(1)[0]!
    local.outbox.recordFailure([attempted.seq], 'lost response')
    local.outbox.append(write(2))
    local.outbox.append(write(4))
    local.outbox.append(write(5, { replaces: { id: 'old-row', deleted_at: AT } }))
    other.outbox.append(write(100))
    other.outbox.append(write(200))
    const otherBefore = other.outbox.pending(10)

    expect(local.outbox.compact(1)).toBe(1)
    expect(local.outbox.pending(10).map((op) => op.fields['reps']?.v)).toEqual([1, 4, 5])
    expect(local.outbox.pending(10)[0]?.fields).toEqual(attempted.fields)
    expect(local.outbox.pending(10)[2]?.replaces).toEqual({ id: 'old-row', deleted_at: AT })
    expect(other.outbox.pending(10)).toEqual(otherBefore)
  })

  it('wipes one owner without deleting another learner or the installation binding', () => {
    local.phrases.upsert({ ...makePhrase('a'), id: userPhraseId('local-a') })
    other.phrases.upsert({ ...makePhrase('a'), id: userPhraseId('other-a') })
    const settings = { onboarded: true, level: null, dailyMinutes: null, waveTimes: [] }
    local.settings.save({ ...settings, goal: 'trip' })
    other.settings.save({ ...settings, goal: 'move' })
    local.outbox.append(write(1))
    other.outbox.append(write(2))
    for (const [key, value] of [
      ['sync.account', 'account-a'],
      ['device_id', 'installation-a'],
      ['last_hlc', 'h20'],
      ['pending_phrase_deletes', 'private-data'],
    ] as const) {
      driver.run('INSERT INTO kv(k,v) VALUES(?,?)', [key, value])
    }
    driver.exec(`CREATE TABLE sync_state (
      id INTEGER PRIMARY KEY, cursor TEXT, failures INTEGER, next_attempt_at INTEGER, server_hlc TEXT
    )`)
    driver.run('INSERT INTO sync_state VALUES(1,?,3,?,?)', ['cursor-1', AT, 'server-hlc'])
    const otherBefore = other.outbox.pending(10)

    local.wipe()

    expect(local.phrases.count()).toBe(0)
    expect(local.settings.load()).toBeNull()
    expect(local.outbox.size()).toBe(0)
    expect(other.phrases.count()).toBe(1)
    expect(other.settings.load()?.goal).toBe('move')
    expect(other.outbox.pending(10)).toEqual(otherBefore)
    expect(driver.all('SELECT k,v FROM kv ORDER BY k')).toEqual([
      { k: 'device_id', v: 'installation-a' },
      { k: 'last_hlc', v: 'h20' },
      { k: 'sync.account', v: 'account-a' },
    ])
    expect(driver.all('SELECT * FROM sync_state')).toEqual([
      { id: 1, cursor: null, failures: 0, next_attempt_at: 0, server_hlc: null },
    ])

    driver.run("INSERT INTO kv(k,v) VALUES('local-setting','preserved')")
    other.wipe()
    expect(other.phrases.count()).toBe(0)
    expect(other.outbox.size()).toBe(0)
    expect(driver.all("SELECT v FROM kv WHERE k='local-setting'")).toEqual([{ v: 'preserved' }])
  })

  it('never reuses an erased sequence so a stale acknowledgement cannot drop a new write', () => {
    local.outbox.append(write(1))
    const oldSeq = local.outbox.pending(1)[0]!.seq
    local.wipe()
    local.outbox.append(write(2))
    const newSeq = local.outbox.pending(1)[0]!.seq

    expect(newSeq).toBeGreaterThan(oldSeq)
    local.outbox.ack([oldSeq])
    expect(local.outbox.pending(1)[0]?.seq).toBe(newSeq)
  })
})
