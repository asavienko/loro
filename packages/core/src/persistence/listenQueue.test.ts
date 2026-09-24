import { describe, expect, it } from 'vitest'
import type { SqlDriver, SqlRow, SqlValue } from './driver.js'
import {
  applyListenOrder,
  buildListenQueue,
  decodeListenQueue,
  encodeListenQueue,
  listenQueueKey,
  moveListenItem,
  type ListenQueue,
} from './listenQueue.js'
import { clearListenQueue, loadListenQueue, saveListenQueue } from './sqlite/listenQueue.js'

function payload(overrides: Partial<ListenQueue> = {}): ListenQueue {
  return {
    version: 1,
    targetLocale: 'es-ES',
    phraseIds: ['alpha', 'beta', 'gamma'],
    ...overrides,
  }
}

class MemoryMeta implements SqlDriver {
  private readonly rows = new Map<string, string>()
  exec(): void {}
  close(): void {}
  transaction<T>(fn: () => T): T {
    return fn()
  }
  run(sql: string, params: readonly SqlValue[] = []): void {
    if (sql.includes('DELETE')) {
      this.rows.delete(`${params[0]}:${params[1]}`)
      return
    }
    this.rows.set(`${params[0]}:${params[1]}`, String(params[2]))
  }
  all(_sql: string, params: readonly SqlValue[] = []): SqlRow[] {
    const value = this.rows.get(`${params[0]}:${params[1]}`)
    return value === undefined ? [] : [{ value }]
  }
}

describe('listen queue codec', () => {
  it('round-trips a valid payload', () => {
    const value = payload()
    expect(decodeListenQueue(encodeListenQueue(value))).toEqual(value)
  })

  it('rejects malformed, empty, duplicate and unknown-locale payloads', () => {
    expect(decodeListenQueue('{')).toBeNull()
    expect(decodeListenQueue(JSON.stringify({ ...payload(), phraseIds: [] }))).toBeNull()
    expect(
      decodeListenQueue(JSON.stringify({ ...payload(), phraseIds: ['alpha', 'alpha'] })),
    ).toBeNull()
    expect(decodeListenQueue(JSON.stringify({ ...payload(), targetLocale: 'xx-XX' }))).toBeNull()
    expect(decodeListenQueue(JSON.stringify({ ...payload(), version: 2 }))).toBeNull()
    expect(buildListenQueue({ targetLocale: 'es-ES', phraseIds: [] })).toBeNull()
  })
})

describe('applyListenOrder', () => {
  const ranked = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

  it('keeps Rust rank when nothing is stored', () => {
    expect(applyListenOrder(ranked, null)).toEqual(ranked)
  })

  it('overlays stored ids, drops missing, and appends newcomers in ranked order', () => {
    expect(applyListenOrder(ranked, ['c', 'gone', 'a'])).toEqual([{ id: 'c' }, { id: 'a' }, { id: 'b' }])
  })
})

describe('moveListenItem', () => {
  it('moves an upcoming id and refuses Now Playing or Earlier slots', () => {
    expect(moveListenItem(['now', 'one', 'two'], 2, 1, 1)).toEqual(['now', 'two', 'one'])
    expect(moveListenItem(['now', 'one', 'two'], 1, 0, 1)).toBeNull()
    expect(moveListenItem(['now', 'one', 'two'], 1, 1, 1)).toBeNull()
  })
})

describe('listen queue local_metadata writes', () => {
  it('upserts owned columns only and decodes fail-closed', () => {
    const driver = new MemoryMeta()
    expect(loadListenQueue(driver, 'local', 'es-ES')).toBeNull()
    saveListenQueue(driver, 'local', payload())
    expect(loadListenQueue(driver, 'local', 'es-ES')).toEqual(payload())
    saveListenQueue(driver, 'local', payload({ phraseIds: ['beta', 'alpha'] }))
    expect(loadListenQueue(driver, 'local', 'es-ES')?.phraseIds).toEqual(['beta', 'alpha'])
    expect(listenQueueKey('es-ES')).toBe('listen_queue:es-ES')
    driver.run('UPDATE ignored', ['local', 'listen_queue:es-ES', '{'])
    expect(loadListenQueue(driver, 'local', 'es-ES')).toBeNull()
    saveListenQueue(driver, 'local', payload())
    clearListenQueue(driver, 'local', 'es-ES')
    expect(loadListenQueue(driver, 'local', 'es-ES')).toBeNull()
  })
})
