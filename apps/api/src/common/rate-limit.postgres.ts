import { createHash } from 'node:crypto'
import { Inject, Injectable } from '@nestjs/common'
import { DATABASE, type SqlDatabase } from '../database/database.js'
import { LoroError } from './errors.js'
import type { RateLimitDecision, RateLimitRequest, RateLimitStore } from './rate-limit.js'

function tokenHash(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

@Injectable()
export class PostgresRateLimitStore implements RateLimitStore {
  constructor(@Inject(DATABASE) private readonly database: SqlDatabase) {}

  async consume(request: RateLimitRequest): Promise<RateLimitDecision> {
    if (request.algorithm === 'sliding') {
      throw new LoroError('INTERNAL', 'Sliding rate limits stay process-local')
    }
    if (request.algorithm === 'tumbling-hash') return this.tumble(request)
    return this.reset(request)
  }

  private async tumble(request: RateLimitRequest): Promise<RateLimitDecision> {
    const window = Math.floor(request.now / request.windowMs)
    const bucket = tokenHash(`${request.key}:${window}`)
    const expiresAt = (window + 1) * request.windowMs
    const result = await this.database.query<{ count: number }>(
      `INSERT INTO auth_rate_limits(bucket,count,expires_at) VALUES($1,1,$2)
       ON CONFLICT(bucket) DO UPDATE SET count=auth_rate_limits.count+1 RETURNING count`,
      [bucket, expiresAt],
    )
    await this.database.query('DELETE FROM auth_rate_limits WHERE expires_at<$1', [
      request.now - request.windowMs,
    ])
    const count = result.rows[0]?.count ?? request.limit + 1
    return {
      allowed: count <= request.limit,
      retryAfterSeconds: Math.max(1, Math.ceil((expiresAt - request.now) / 1_000)),
    }
  }

  private async reset(request: RateLimitRequest): Promise<RateLimitDecision> {
    const expiresAt = request.now + request.windowMs
    const result = await this.database.query<{ count: number }>(
      `INSERT INTO auth_rate_limits(bucket,count,expires_at) VALUES($1,1,$2)
       ON CONFLICT(bucket) DO UPDATE SET
       count=CASE WHEN auth_rate_limits.expires_at<=$3 THEN 1 ELSE auth_rate_limits.count+1 END,
       expires_at=CASE WHEN auth_rate_limits.expires_at<=$3 THEN $2 ELSE auth_rate_limits.expires_at END
       RETURNING count`,
      [request.key, expiresAt, request.now],
    )
    const count = result.rows[0]?.count ?? request.limit + 1
    return {
      allowed: count <= request.limit,
      retryAfterSeconds: Math.max(1, Math.ceil((expiresAt - request.now) / 1_000)),
    }
  }
}
