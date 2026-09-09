import { randomUUID } from 'node:crypto'
import type { ClaimResult } from '@loro/core/api/account'
import type { ServerClock } from '../common/clock.js'
import { LoroError } from '../common/errors.js'
import type { SqlConnection } from '../database/database.js'
import type { AuthPrincipal } from './auth.tokens.js'

/** Idempotent claim row. The server never moves learner rows named by anon_id. */
export async function recordClaim(
  connection: SqlConnection,
  clock: ServerClock,
  principal: AuthPrincipal,
  anonId: string,
  requestId: string,
): Promise<ClaimResult> {
  const row = (
    await connection.query<{ id: string; anon_id: string }>(
      `INSERT INTO auth_claims(id,user_id,device_id,request_id,anon_id,created_at)
       VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(user_id,device_id,request_id) DO UPDATE
       SET request_id=EXCLUDED.request_id RETURNING id,anon_id`,
      [randomUUID(), principal.userId, principal.deviceId, requestId, anonId, clock.now()],
    )
  ).rows[0]
  if (!row) throw new LoroError('INTERNAL')
  if (row.anon_id !== anonId) throw new LoroError('VALIDATION_FAILED')
  // The device must upload its actual local rows before reconciliation can be
  // considered complete.
  return { performed: false, mode: null, claim_id: row.id, upload_required: true }
}
