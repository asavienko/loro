/**
 * Durable auth rows. Policy and token orchestration stay on AuthService.
 */

import { Inject, Injectable } from '@nestjs/common'
import type {
  ClaimRequest,
  ClaimResult,
  DeviceRegistration,
  SignInResponse,
  TokenResponse,
} from '@loro/core/api/account'
import { SERVER_CLOCK, type ServerClock } from '../common/clock.js'
import { DATABASE, type SqlConnection, type SqlDatabase } from '../database/database.js'
import { recordClaim } from './auth.claim.js'
import {
  createSession,
  hasLegacySessions,
  insertRefresh,
  revokeLegacyFamily,
  upgradeLegacyRefresh,
  type RefreshRegistration,
  type UserRow,
} from './auth.session.js'
import {
  ACCESS_SECONDS,
  legacyTokenHash,
  newRefreshToken,
  tokenHash,
  type AccessTokens,
  type AuthPrincipal,
} from './auth.tokens.js'

export const AUTH_STORE = Symbol('AuthStore')

export interface SessionRow {
  id: string
  user_id: string
  device_id: string
  expires_at: string | number
  revoked_at: string | number | null
}

export interface RefreshRow extends SessionRow {
  consumed_at: string | number | null
}

export interface CodeRow {
  code_hash: string
  nonce: string
  expires_at: string | number
  attempts: number
}

export interface AuthStore {
  transaction<T>(work: (connection: SqlConnection) => Promise<T>): Promise<T>
  saveMagicCode(
    emailHash: string,
    codeHash: string,
    nonce: string,
    expiresAt: number,
    createdAt: number,
  ): Promise<void>
  deleteMagicCode(emailHash: string, codeHash: string): Promise<void>
  loadMagicCode(connection: SqlConnection, emailHash: string): Promise<CodeRow | undefined>
  incrementMagicAttempts(connection: SqlConnection, emailHash: string): Promise<void>
  deleteMagicCodeFor(connection: SqlConnection, emailHash: string): Promise<void>
  createSession(
    connection: SqlConnection,
    tokens: AccessTokens,
    provider: string,
    subject: string,
    device: DeviceRegistration,
    anonId: string,
  ): Promise<SignInResponse>
  loadRefresh(connection: SqlConnection, refresh: string): Promise<RefreshRow | undefined>
  upgradeLegacyRefresh(
    connection: SqlConnection,
    tokens: AccessTokens,
    refreshToken: string,
    registration?: RefreshRegistration,
  ): Promise<SignInResponse | null>
  revokeSession(connection: SqlConnection, sessionId: string, now: number): Promise<void>
  consumeRefresh(connection: SqlConnection, refresh: string, now: number): Promise<void>
  rotateRefresh(
    connection: SqlConnection,
    tokens: AccessTokens,
    row: RefreshRow,
    now: number,
  ): Promise<TokenResponse>
  loadSession(principal: AuthPrincipal): Promise<SessionRow | undefined>
  revokePrincipal(principal: AuthPrincipal, now: number): Promise<void>
  revokeByRefresh(refresh: string, now: number): Promise<void>
  loadUser(userId: string): Promise<UserRow | undefined>
  recordClaim(
    connection: SqlConnection,
    principal: AuthPrincipal,
    input: ClaimRequest,
  ): Promise<ClaimResult>
}

@Injectable()
export class PostgresAuthStore implements AuthStore {
  constructor(
    @Inject(DATABASE) private readonly database: SqlDatabase,
    @Inject(SERVER_CLOCK) private readonly clock: ServerClock,
  ) {}

  transaction<T>(work: (connection: SqlConnection) => Promise<T>): Promise<T> {
    return this.database.transaction(work)
  }

  async saveMagicCode(
    emailHash: string,
    codeHash: string,
    nonce: string,
    expiresAt: number,
    createdAt: number,
  ): Promise<void> {
    await this.database.query(
      `INSERT INTO auth_magic_codes(email_hash,code_hash,nonce,expires_at,attempts,created_at)
       VALUES($1,$2,$3,$4,0,$5) ON CONFLICT(email_hash) DO UPDATE
       SET code_hash=$2,nonce=$3,expires_at=$4,attempts=0,created_at=$5`,
      [emailHash, codeHash, nonce, expiresAt, createdAt],
    )
  }

  async deleteMagicCode(emailHash: string, codeHash: string): Promise<void> {
    await this.database.query('DELETE FROM auth_magic_codes WHERE email_hash=$1 AND code_hash=$2', [
      emailHash,
      codeHash,
    ])
  }

  async loadMagicCode(connection: SqlConnection, emailHash: string): Promise<CodeRow | undefined> {
    return (
      await connection.query<CodeRow>(
        'SELECT code_hash,nonce,expires_at,attempts FROM auth_magic_codes WHERE email_hash=$1 FOR UPDATE',
        [emailHash],
      )
    ).rows[0]
  }

  async incrementMagicAttempts(connection: SqlConnection, emailHash: string): Promise<void> {
    await connection.query('UPDATE auth_magic_codes SET attempts=attempts+1 WHERE email_hash=$1', [
      emailHash,
    ])
  }

  async deleteMagicCodeFor(connection: SqlConnection, emailHash: string): Promise<void> {
    await connection.query('DELETE FROM auth_magic_codes WHERE email_hash=$1', [emailHash])
  }

  createSession(
    connection: SqlConnection,
    tokens: AccessTokens,
    provider: string,
    subject: string,
    device: DeviceRegistration,
    anonId: string,
  ): Promise<SignInResponse> {
    return createSession(connection, this.clock, tokens, provider, subject, device, anonId)
  }

  async loadRefresh(connection: SqlConnection, refresh: string): Promise<RefreshRow | undefined> {
    return (
      await connection.query<RefreshRow>(
        `SELECT s.id,s.user_id,s.device_id,s.expires_at,s.revoked_at,r.consumed_at
         FROM auth_refresh_tokens r JOIN auth_sessions s ON s.id=r.session_id
         WHERE r.token_hash=$1 FOR UPDATE OF s,r`,
        [tokenHash(refresh)],
      )
    ).rows[0]
  }

  upgradeLegacyRefresh(
    connection: SqlConnection,
    tokens: AccessTokens,
    refreshToken: string,
    registration?: RefreshRegistration,
  ): Promise<SignInResponse | null> {
    return upgradeLegacyRefresh(connection, this.clock, tokens, refreshToken, registration)
  }

  async revokeSession(connection: SqlConnection, sessionId: string, now: number): Promise<void> {
    await connection.query('UPDATE auth_sessions SET revoked_at=$1 WHERE id=$2', [now, sessionId])
  }

  async consumeRefresh(connection: SqlConnection, refresh: string, now: number): Promise<void> {
    await connection.query('UPDATE auth_refresh_tokens SET consumed_at=$1 WHERE token_hash=$2', [
      now,
      tokenHash(refresh),
    ])
  }

  async rotateRefresh(
    connection: SqlConnection,
    tokens: AccessTokens,
    row: RefreshRow,
    now: number,
  ): Promise<TokenResponse> {
    const nextToken = newRefreshToken()
    await insertRefresh(connection, nextToken, row.id, Number(row.expires_at))
    return {
      access_token: await tokens.issue(
        { userId: row.user_id, deviceId: row.device_id, sessionId: row.id },
        now,
      ),
      expires_in: ACCESS_SECONDS,
      refresh_token: nextToken,
    }
  }

  async loadSession(principal: AuthPrincipal): Promise<SessionRow | undefined> {
    return (
      await this.database.query<SessionRow>(
        `SELECT id,user_id,device_id,expires_at,revoked_at FROM auth_sessions
       WHERE id=$1 AND user_id=$2 AND device_id=$3`,
        [principal.sessionId, principal.userId, principal.deviceId],
      )
    ).rows[0]
  }

  async revokePrincipal(principal: AuthPrincipal, now: number): Promise<void> {
    await this.database.query(
      'UPDATE auth_sessions SET revoked_at=$1 WHERE id=$2 AND user_id=$3 AND device_id=$4',
      [now, principal.sessionId, principal.userId, principal.deviceId],
    )
  }

  async revokeByRefresh(refresh: string, now: number): Promise<void> {
    await this.database.transaction(async (connection) => {
      await connection.query(
        `UPDATE auth_sessions SET revoked_at=$1
         WHERE id IN (SELECT session_id FROM auth_refresh_tokens WHERE token_hash=$2)`,
        [now, tokenHash(refresh)],
      )
      if (!(await hasLegacySessions(connection))) return
      const row = (
        await connection.query<{ id: string }>(
          `SELECT s.id FROM auth_sessions_legacy s JOIN auth_refresh r ON r.session_id=s.id
         WHERE r.hash=$1 FOR UPDATE OF s`,
          [legacyTokenHash(refresh)],
        )
      ).rows[0]
      if (row) await revokeLegacyFamily(connection, row.id, now)
    })
  }

  async loadUser(userId: string): Promise<UserRow | undefined> {
    return (
      await this.database.query<UserRow>(
        `SELECT u.id,u.created_at,i.provider FROM auth_users u
        JOIN auth_identities i ON i.user_id=u.id WHERE u.id=$1 ORDER BY i.provider LIMIT 1`,
        [userId],
      )
    ).rows[0]
  }

  recordClaim(
    connection: SqlConnection,
    principal: AuthPrincipal,
    input: ClaimRequest,
  ): Promise<ClaimResult> {
    return recordClaim(connection, this.clock, principal, input.anon_id, input.request_id)
  }
}
