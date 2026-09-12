import { describe, expect, it } from 'vitest'
import { LoroError, RATE_LIMITS } from './errors.js'
import { MemoryRateLimitStore } from './rate-limit.memory.js'
import { rejectIfLimited, windowMs } from './rate-limit.js'

describe('named rate-limit policies', () => {
  it('keeps the deployed auth IP cap and leaves auth.perUser unused', () => {
    expect(RATE_LIMITS.auth.perIp).toBe(30)
    expect(RATE_LIMITS.auth.perUser).toBe(10)
    expect(RATE_LIMITS.sync.perUser).toBe(120)
    expect(RATE_LIMITS.sync.perIp).toBe(600)
    expect(RATE_LIMITS.ttsRender.perUser).toBe(100)
  })
})

describe('memory rate-limit store', () => {
  it('allows the tumbling-hash limit and rejects the next hit in the same window', async () => {
    const store = new MemoryRateLimitStore()
    const now = 1_800_000_000_000
    const request = {
      key: 'ip:203.0.113.8',
      limit: 2,
      windowMs: windowMs(15),
      now,
      algorithm: 'tumbling-hash' as const,
    }
    expect((await store.consume(request)).allowed).toBe(true)
    expect((await store.consume(request)).allowed).toBe(true)
    const blocked = await store.consume(request)
    expect(blocked.allowed).toBe(false)
    expect(() => {
      rejectIfLimited(blocked)
    }).toThrow(LoroError)
    expect((await store.consume({ ...request, now: now + windowMs(15) })).allowed).toBe(true)
  })

  it('resets expire-reset counters when the window elapses, matching sync', async () => {
    const store = new MemoryRateLimitStore()
    let now = 1_000
    const request = {
      key: 'sync:user-a',
      limit: 2,
      windowMs: 60_000,
      now,
      algorithm: 'expire-reset' as const,
    }
    expect((await store.consume({ ...request, now })).allowed).toBe(true)
    expect((await store.consume({ ...request, now })).allowed).toBe(true)
    expect((await store.consume({ ...request, now })).allowed).toBe(false)
    now += 59_999
    expect((await store.consume({ ...request, now })).allowed).toBe(false)
    now += 1
    expect((await store.consume({ ...request, now })).allowed).toBe(true)
  })

  it('uses a sliding window for process-local TTS caps', async () => {
    const store = new MemoryRateLimitStore()
    const request = {
      key: 'user:learner',
      limit: 2,
      windowMs: 60_000,
      now: 10_000,
      algorithm: 'sliding' as const,
    }
    expect((await store.consume(request)).allowed).toBe(true)
    expect((await store.consume({ ...request, now: 20_000 })).allowed).toBe(true)
    expect((await store.consume({ ...request, now: 30_000 })).allowed).toBe(false)
    expect((await store.consume({ ...request, now: 70_001 })).allowed).toBe(true)
  })
})
