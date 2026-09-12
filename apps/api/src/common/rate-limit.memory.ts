import { createHash } from 'node:crypto'
import type { RateLimitDecision, RateLimitRequest, RateLimitStore } from './rate-limit.js'

function tokenHash(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

/** Process-local counters. TTS keeps sliding windows here; tests use all three algorithms. */
export class MemoryRateLimitStore implements RateLimitStore {
  private readonly fixed = new Map<string, { count: number; expiresAt: number }>()
  private readonly sliding = new Map<string, number[]>()

  consume(request: RateLimitRequest): Promise<RateLimitDecision> {
    if (request.algorithm === 'sliding') return Promise.resolve(this.slide(request))
    if (request.algorithm === 'tumbling-hash') return Promise.resolve(this.tumble(request))
    return Promise.resolve(this.reset(request))
  }

  private tumble(request: RateLimitRequest): RateLimitDecision {
    const window = Math.floor(request.now / request.windowMs)
    const bucket = tokenHash(`${request.key}:${window}`)
    const expiresAt = (window + 1) * request.windowMs
    const current = this.fixed.get(bucket)
    const count = (current?.expiresAt === expiresAt ? current.count : 0) + 1
    this.fixed.set(bucket, { count, expiresAt })
    return {
      allowed: count <= request.limit,
      retryAfterSeconds: retryAfter(expiresAt, request.now),
    }
  }

  private reset(request: RateLimitRequest): RateLimitDecision {
    const current = this.fixed.get(request.key)
    const next =
      current && current.expiresAt > request.now
        ? { count: current.count + 1, expiresAt: current.expiresAt }
        : { count: 1, expiresAt: request.now + request.windowMs }
    this.fixed.set(request.key, next)
    return {
      allowed: next.count <= request.limit,
      retryAfterSeconds: retryAfter(next.expiresAt, request.now),
    }
  }

  private slide(request: RateLimitRequest): RateLimitDecision {
    const start = request.now - request.windowMs
    const times = (this.sliding.get(request.key) ?? []).filter((time) => time > start)
    if (times.length >= request.limit) {
      this.sliding.set(request.key, times)
      const oldest = times[0] ?? request.now
      return {
        allowed: false,
        retryAfterSeconds: retryAfter(oldest + request.windowMs, request.now),
      }
    }
    times.push(request.now)
    this.sliding.set(request.key, times)
    return {
      allowed: true,
      retryAfterSeconds: retryAfter(request.now + request.windowMs, request.now),
    }
  }
}

function retryAfter(expiresAt: number, now: number): number {
  return Math.max(1, Math.ceil((expiresAt - now) / 1_000))
}
