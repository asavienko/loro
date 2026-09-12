/**
 * Named rate-limit decisions.
 *
 * Callers supply the deployed key, limit, window and algorithm. The store
 * persists the counter; `rejectIfLimited` is the only mapping to RFC 9457.
 * Documented-but-undeployed rows in `RATE_LIMITS` stay unused until a contract
 * decision enables them.
 */

import { LoroError } from './errors.js'

export const RATE_LIMIT_STORE = Symbol('RateLimitStore')

export type RateLimitAlgorithm = 'tumbling-hash' | 'expire-reset' | 'sliding'

export interface RateLimitRequest {
  key: string
  limit: number
  windowMs: number
  now: number
  algorithm: RateLimitAlgorithm
}

export interface RateLimitDecision {
  allowed: boolean
  retryAfterSeconds: number
}

export interface RateLimitStore {
  consume(request: RateLimitRequest): Promise<RateLimitDecision>
}

export function rejectIfLimited(decision: RateLimitDecision): void {
  if (decision.allowed) return
  throw new LoroError('RATE_LIMITED', undefined, {
    retry_after: decision.retryAfterSeconds,
  })
}

export function windowMs(minutes: number): number {
  return minutes * 60_000
}
