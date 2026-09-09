import { describe, expect, it } from 'vitest'
import { ProviderConcurrency } from './provider-concurrency.js'

describe('provider admission control', () => {
  it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid limit %s',
    (limit) => {
      expect(() => new ProviderConcurrency(limit)).toThrow('Invalid provider concurrency limit')
    },
  )

  it('rejects excess work immediately and releases each permit at most once', () => {
    const pool = new ProviderConcurrency(2)
    const first = pool.acquire()!
    const second = pool.acquire()!
    expect(pool.acquire()).toBeNull()
    first()
    first()
    const third = pool.acquire()!
    expect(pool.acquire()).toBeNull()
    second()
    third()
    expect(pool.acquire()).toBeTypeOf('function')
    expect(pool.acquire()).toBeTypeOf('function')
    expect(pool.acquire()).toBeNull()
  })
})
