import { LoroError } from '../common/errors.js'
import type { ServerClock } from '../common/clock.js'
import type { SqlDatabase } from '../database/database.js'
import { tokenHash } from './auth.tokens.js'

export const AUTH_RATE_WINDOW = 15 * 60 * 1_000
export const AUTH_IP_LIMIT = 30
export const EMAIL_LIMIT = 5

/** Hashed transport-peer / email buckets. Raw IPs and emails never enter storage. */
export async function consumeAuthLimit(
  database: SqlDatabase,
  clock: ServerClock,
  key: string,
  limit: number,
): Promise<void> {
  const now = clock.now()
  const window = Math.floor(now / AUTH_RATE_WINDOW)
  const bucket = tokenHash(`${key}:${window}`)
  const result = await database.query<{ count: number }>(
    `INSERT INTO auth_rate_limits(bucket,count,expires_at) VALUES($1,1,$2)
     ON CONFLICT(bucket) DO UPDATE SET count=auth_rate_limits.count+1 RETURNING count`,
    [bucket, (window + 1) * AUTH_RATE_WINDOW],
  )
  if (!result.rows[0] || result.rows[0].count > limit) {
    throw new LoroError('RATE_LIMITED', undefined, {
      retry_after: Math.ceil(((window + 1) * AUTH_RATE_WINDOW - now) / 1_000),
    })
  }
  await database.query('DELETE FROM auth_rate_limits WHERE expires_at<$1', [now - AUTH_RATE_WINDOW])
}
