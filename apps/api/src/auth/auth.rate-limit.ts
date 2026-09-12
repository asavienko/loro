import { RATE_LIMITS } from '../common/errors.js'
import { rejectIfLimited, windowMs, type RateLimitStore } from '../common/rate-limit.js'
import type { ServerClock } from '../common/clock.js'

export const AUTH_RATE_WINDOW = windowMs(RATE_LIMITS.auth.windowMinutes)
export const AUTH_IP_LIMIT = RATE_LIMITS.auth.perIp
/** Deployed email identity cap. `RATE_LIMITS.auth.perUser` (10) is not enforced. */
export const EMAIL_LIMIT = 5

/** Hashed transport-peer / email buckets. Raw IPs and emails never enter storage. */
export async function consumeAuthLimit(
  store: RateLimitStore,
  clock: ServerClock,
  key: string,
  limit: number,
): Promise<void> {
  rejectIfLimited(
    await store.consume({
      key,
      limit,
      windowMs: AUTH_RATE_WINDOW,
      now: clock.now(),
      algorithm: 'tumbling-hash',
    }),
  )
}
