import { randomUUID } from 'node:crypto'
import type { DeviceRegistration, SignInResponse } from '@loro/core/api/account'
import type { ServerClock } from '../common/clock.js'
import { LoroError } from '../common/errors.js'
import type { SqlConnection } from '../database/database.js'
import { recordClaim } from './auth.claim.js'
import {
  ACCESS_SECONDS,
  type AccessTokens,
  legacyTokenHash,
  newRefreshToken,
  REFRESH_MILLISECONDS,
  tokenHash,
} from './auth.tokens.js'

export interface UserRow {
  id: string
  created_at: string | number | null
  provider?: string
}

export interface RefreshRegistration {
  device: DeviceRegistration
  anon_id: string
}

interface LegacyRefreshRow {
  id: string
  user_id: string
  expires: string | number
  revoked: boolean
  consumed: boolean
  provider: 'google' | 'apple'
  subject: string
}

export async function createSession(
  connection: SqlConnection,
  clock: ServerClock,
  tokens: AccessTokens,
  provider: string,
  subject: string,
  device: DeviceRegistration,
  anonId: string,
  legacyExpiresAt?: number,
): Promise<SignInResponse> {
  const now = clock.now()
  // Serializes first login of the same verified identity across processes. No
  // user-controlled identifier is interpolated into SQL or used as an account.
  await connection.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
    `identity:${provider}:${subject}`,
  ])
  let user = (
    await connection.query<UserRow>(
      `SELECT u.id,u.created_at FROM auth_users u JOIN auth_identities i ON i.user_id=u.id
       WHERE i.provider=$1 AND i.subject=$2`,
      [provider, subject],
    )
  ).rows[0]
  if (!user) {
    user = { id: randomUUID(), created_at: now }
    await connection.query('INSERT INTO auth_users(id,created_at) VALUES($1,$2)', [user.id, now])
    await connection.query(
      'INSERT INTO auth_identities(provider,subject,user_id) VALUES($1,$2,$3)',
      [provider, subject, user.id],
    )
  }
  const registered = (
    await connection.query<{ id: string }>(
      `INSERT INTO auth_devices(id,user_id,installation_id,platform,app_version,created_at)
       VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(user_id,installation_id) DO UPDATE
       SET app_version=EXCLUDED.app_version RETURNING id`,
      [randomUUID(), user.id, device.installation_id, device.platform, device.app_version, now],
    )
  ).rows[0]
  if (!registered) throw new LoroError('INTERNAL')
  const principal = { userId: user.id, deviceId: registered.id, sessionId: randomUUID() }
  const expiresAt = Math.min(now + REFRESH_MILLISECONDS, legacyExpiresAt ?? Infinity)
  await connection.query(
    'INSERT INTO auth_sessions(id,user_id,device_id,created_at,expires_at) VALUES($1,$2,$3,$4,$5)',
    [principal.sessionId, user.id, registered.id, now, expiresAt],
  )
  const refreshToken = newRefreshToken()
  await insertRefresh(connection, refreshToken, principal.sessionId, expiresAt)
  const claim = await recordClaim(connection, clock, principal, anonId, anonId)
  return {
    access_token: await tokens.issue(principal, now),
    expires_in: ACCESS_SECONDS,
    refresh_token: refreshToken,
    user: {
      id: user.id,
      created_at: user.created_at === null ? null : Number(user.created_at),
      provider,
    },
    device_id: registered.id,
    claim,
  }
}

export async function insertRefresh(
  connection: SqlConnection,
  token: string,
  sessionId: string,
  expiresAt: number,
): Promise<void> {
  await connection.query(
    'INSERT INTO auth_refresh_tokens(token_hash,session_id,expires_at) VALUES($1,$2,$3)',
    [tokenHash(token), sessionId, expiresAt],
  )
}

export async function upgradeLegacyRefresh(
  connection: SqlConnection,
  clock: ServerClock,
  tokens: AccessTokens,
  refreshToken: string,
  registration?: RefreshRegistration,
): Promise<SignInResponse | null> {
  if (!(await hasLegacySessions(connection))) return null
  const row = (
    await connection.query<LegacyRefreshRow>(
      `SELECT s.id,s.user_id,s.expires,s.revoked,r.consumed,a.provider,a.subject
       FROM auth_refresh r JOIN auth_sessions_legacy s ON s.id=r.session_id
       JOIN auth_accounts a ON a.id=s.user_id WHERE r.hash=$1 FOR UPDATE OF s,r`,
      [legacyTokenHash(refreshToken)],
    )
  ).rows[0]
  if (!row) return null
  const now = clock.now()
  if (row.consumed || row.revoked) {
    // Revocation commits outside the eventual 401, including an already-upgraded family.
    await revokeLegacyFamily(connection, row.id, now)
    return null
  }
  if (Number(row.expires) <= now || !registration) return null
  const identity = (
    await connection.query<{ user_id: string }>(
      'SELECT user_id FROM auth_identities WHERE provider=$1 AND subject=$2',
      [row.provider, row.subject],
    )
  ).rows[0]
  if (identity?.user_id !== row.user_id) throw new LoroError('UNAUTHENTICATED')
  await connection.query('UPDATE auth_refresh SET consumed=true WHERE hash=$1', [
    legacyTokenHash(refreshToken),
  ])
  await connection.query('UPDATE auth_sessions_legacy SET revoked=true WHERE id=$1', [row.id])
  const result = await createSession(
    connection,
    clock,
    tokens,
    row.provider,
    row.subject,
    registration.device,
    registration.anon_id,
    Number(row.expires),
  )
  const principal = await tokens.verify(result.access_token, now)
  await connection.query(
    'INSERT INTO auth_legacy_upgrades(legacy_session_id,session_id) VALUES($1,$2)',
    [row.id, principal.sessionId],
  )
  return result
}

export async function hasLegacySessions(connection: SqlConnection): Promise<boolean> {
  return (
    (
      await connection.query<{ present: boolean }>(
        `SELECT to_regclass(format('%I.auth_refresh',current_schema())) IS NOT NULL
         AND to_regclass(format('%I.auth_sessions_legacy',current_schema())) IS NOT NULL AS present`,
      )
    ).rows[0]?.present === true
  )
}

export async function revokeLegacyFamily(
  connection: SqlConnection,
  sessionId: string,
  now: number,
): Promise<void> {
  await connection.query('UPDATE auth_sessions_legacy SET revoked=true WHERE id=$1', [sessionId])
  await connection.query(
    `UPDATE auth_sessions SET revoked_at=$1 WHERE id IN
       (SELECT session_id FROM auth_legacy_upgrades WHERE legacy_session_id=$2)`,
    [now, sessionId],
  )
}
