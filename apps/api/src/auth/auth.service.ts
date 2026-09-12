import { randomBytes, randomInt } from 'node:crypto'
import { Inject, Injectable, Optional } from '@nestjs/common'
import type {
  ClaimRequest,
  ClaimResult,
  DeviceRegistration,
  MagicVerifyRequest,
  SignInRequest,
  SignInResponse,
  TokenResponse,
  User,
} from '@loro/core/api/account'
import { SERVER_CLOCK, type ServerClock } from '../common/clock.js'
import { config } from '../common/config.js'
import { LoroError } from '../common/errors.js'
import { deliverMagicCode } from './delivery.js'
import { isAllowedMagicDeliveryUrl } from './settings.js'
import { DATABASE, type SqlConnection, type SqlDatabase } from '../database/database.js'
import { recordClaim } from './auth.claim.js'
import { verifyIdentityToken, type IdentityProvider } from './auth.providers.js'
import {
  createSession,
  hasLegacySessions,
  insertRefresh,
  revokeLegacyFamily,
  upgradeLegacyRefresh,
  type RefreshRegistration,
  type UserRow,
} from './auth.session.js'
import { RATE_LIMIT_STORE, type RateLimitStore } from '../common/rate-limit.js'
import { PostgresRateLimitStore } from '../common/rate-limit.postgres.js'
import { AUTH_IP_LIMIT, EMAIL_LIMIT, consumeAuthLimit } from './auth.rate-limit.js'
import {
  ACCESS_SECONDS,
  AccessTokens,
  CODE_MILLISECONDS,
  equalHash,
  keyedHash,
  legacyTokenHash,
  MAX_CODE_ATTEMPTS,
  newRefreshToken,
  tokenHash,
  type AuthPrincipal,
} from './auth.tokens.js'

export type { RefreshRegistration }

interface SessionRow {
  id: string
  user_id: string
  device_id: string
  expires_at: string | number
  revoked_at: string | number | null
}
interface RefreshRow extends SessionRow {
  consumed_at: string | number | null
}
interface CodeRow {
  code_hash: string
  nonce: string
  expires_at: string | number
  attempts: number
}

@Injectable()
export class AuthService {
  private readonly limits: RateLimitStore

  constructor(
    @Inject(DATABASE) private readonly database: SqlDatabase,
    @Inject(SERVER_CLOCK) private readonly clock: ServerClock,
    @Optional() @Inject(RATE_LIMIT_STORE) limits?: RateLimitStore,
  ) {
    this.limits = limits ?? new PostgresRateLimitStore(database)
  }

  capabilities(): { apple: boolean; google: boolean; email: boolean } {
    const settings = config.authSettings()
    let canSign = false
    try {
      new AccessTokens(settings)
      canSign = true
    } catch {
      /* Unconfigured or malformed keys do not advertise a working provider. */
    }
    return {
      apple: canSign && settings.appleClientIds.length > 0,
      google: canSign && settings.googleClientIds.length > 0,
      email:
        canSign &&
        Boolean(settings.magicDeliveryToken) &&
        Boolean(settings.emailHashKey && settings.emailHashKey.length >= 32) &&
        this.validDeliveryUrl(settings.magicDeliveryUrl),
    }
  }

  async signIn(
    provider: IdentityProvider,
    input: SignInRequest,
    address: string,
  ): Promise<SignInResponse> {
    const settings = config.authSettings()
    const tokens = new AccessTokens(settings)
    await this.limit(`ip:${address}`, AUTH_IP_LIMIT)
    const subject = await verifyIdentityToken(
      provider,
      input.identity_token,
      provider === 'google' ? settings.googleClientIds : settings.appleClientIds,
      this.clock.now(),
    )
    return this.database.transaction((connection) =>
      createSession(connection, this.clock, tokens, provider, subject, input.device, input.anon_id),
    )
  }

  async requestCode(email: string, address: string): Promise<{ status: 'accepted' }> {
    const settings = config.authSettings()
    if (!this.capabilities().email || !settings.magicDeliveryUrl || !settings.magicDeliveryToken) {
      throw new LoroError('PROVIDER_UNAVAILABLE')
    }
    // Verify the signing configuration before sending a code that could not sign in.
    new AccessTokens(settings)
    const secret = this.emailSecret()
    const normalized = this.normalizeEmail(email)
    const emailHash = keyedHash(secret, `email:${normalized}`)
    await this.limit(`ip:${address}`, AUTH_IP_LIMIT)
    await this.limit(`email:${emailHash}`, EMAIL_LIMIT)
    const now = this.clock.now()
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0')
    const nonce = randomBytes(32).toString('hex')
    const codeHash = keyedHash(secret, `code:${emailHash}:${nonce}:${code}`)
    await this.database.query(
      `INSERT INTO auth_magic_codes(email_hash,code_hash,nonce,expires_at,attempts,created_at)
       VALUES($1,$2,$3,$4,0,$5) ON CONFLICT(email_hash) DO UPDATE
       SET code_hash=$2,nonce=$3,expires_at=$4,attempts=0,created_at=$5`,
      [emailHash, codeHash, nonce, now + CODE_MILLISECONDS, now],
    )
    try {
      await deliverMagicCode(settings.magicDeliveryUrl, settings.magicDeliveryToken, {
        email: normalized,
        code,
        expires_in: CODE_MILLISECONDS / 1_000,
      })
    } catch {
      await this.database.query(
        'DELETE FROM auth_magic_codes WHERE email_hash=$1 AND code_hash=$2',
        [emailHash, codeHash],
      )
      throw new LoroError('PROVIDER_UNAVAILABLE')
    }
    return { status: 'accepted' }
  }

  async verifyCode(input: MagicVerifyRequest, address: string): Promise<SignInResponse> {
    const tokens = new AccessTokens(config.authSettings())
    const secret = this.emailSecret()
    const emailHash = keyedHash(secret, `email:${this.normalizeEmail(input.email)}`)
    await this.limit(`ip:${address}`, AUTH_IP_LIMIT)
    const now = this.clock.now()
    const result = await this.database.transaction<SignInResponse | null>(async (connection) => {
      const row = (
        await connection.query<CodeRow>(
          'SELECT code_hash,nonce,expires_at,attempts FROM auth_magic_codes WHERE email_hash=$1 FOR UPDATE',
          [emailHash],
        )
      ).rows[0]
      if (!row || Number(row.expires_at) <= now || row.attempts >= MAX_CODE_ATTEMPTS) return null
      const valid = equalHash(
        keyedHash(secret, `code:${emailHash}:${row.nonce}:${input.code}`),
        row.code_hash,
      )
      if (!valid) {
        // Return the failure from the transaction so the attempt increment commits.
        await connection.query(
          'UPDATE auth_magic_codes SET attempts=attempts+1 WHERE email_hash=$1',
          [emailHash],
        )
        return null
      }
      await connection.query('DELETE FROM auth_magic_codes WHERE email_hash=$1', [emailHash])
      return createSession(
        connection,
        this.clock,
        tokens,
        'email',
        emailHash,
        input.device,
        input.anon_id,
      )
    })
    if (!result) throw new LoroError('UNAUTHENTICATED')
    return result
  }

  async refresh(
    refreshToken: string,
    address: string,
    registration?: RefreshRegistration,
  ): Promise<TokenResponse | SignInResponse> {
    const tokens = new AccessTokens(config.authSettings())
    await this.limit(`ip:${address}`, AUTH_IP_LIMIT)
    if (!/^[A-Za-z0-9_-]{43}$/.test(refreshToken)) throw new LoroError('UNAUTHENTICATED')
    const now = this.clock.now()
    const result = await this.database.transaction<TokenResponse | null>(async (connection) => {
      const row = (
        await connection.query<RefreshRow>(
          `SELECT s.id,s.user_id,s.device_id,s.expires_at,s.revoked_at,r.consumed_at
         FROM auth_refresh_tokens r JOIN auth_sessions s ON s.id=r.session_id
         WHERE r.token_hash=$1 FOR UPDATE OF s,r`,
          [tokenHash(refreshToken)],
        )
      ).rows[0]
      if (!row)
        return upgradeLegacyRefresh(connection, this.clock, tokens, refreshToken, registration)
      if (row.revoked_at !== null) return null
      if (row.consumed_at !== null) {
        // Do not throw in this transaction: rollback would undo reuse revocation.
        await connection.query('UPDATE auth_sessions SET revoked_at=$1 WHERE id=$2', [now, row.id])
        return null
      }
      if (Number(row.expires_at) <= now) return null
      await connection.query('UPDATE auth_refresh_tokens SET consumed_at=$1 WHERE token_hash=$2', [
        now,
        tokenHash(refreshToken),
      ])
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
    })
    if (!result) throw new LoroError('UNAUTHENTICATED')
    return result
  }

  async authenticate(accessToken: string): Promise<AuthPrincipal> {
    const principal = await new AccessTokens(config.authSettings()).verify(
      accessToken,
      this.clock.now(),
    )
    const session = (
      await this.database.query<SessionRow>(
        `SELECT id,user_id,device_id,expires_at,revoked_at FROM auth_sessions
       WHERE id=$1 AND user_id=$2 AND device_id=$3`,
        [principal.sessionId, principal.userId, principal.deviceId],
      )
    ).rows[0]
    if (session?.revoked_at !== null || Number(session.expires_at) <= this.clock.now()) {
      throw new LoroError('UNAUTHENTICATED')
    }
    return principal
  }

  async logout(principal: AuthPrincipal): Promise<void> {
    this.requireEnabled()
    await this.database.query(
      'UPDATE auth_sessions SET revoked_at=$1 WHERE id=$2 AND user_id=$3 AND device_id=$4',
      [this.clock.now(), principal.sessionId, principal.userId, principal.deviceId],
    )
  }

  /** Possession of a refresh token can only revoke its family, never read account data. */
  async revokeRefresh(refreshToken: string): Promise<void> {
    this.requireEnabled()
    if (!/^[A-Za-z0-9_-]{43}$/.test(refreshToken)) throw new LoroError('UNAUTHENTICATED')
    const now = this.clock.now()
    await this.database.transaction(async (connection) => {
      await connection.query(
        `UPDATE auth_sessions SET revoked_at=$1
         WHERE id IN (SELECT session_id FROM auth_refresh_tokens WHERE token_hash=$2)`,
        [now, tokenHash(refreshToken)],
      )
      if (!(await hasLegacySessions(connection))) return
      const row = (
        await connection.query<{ id: string }>(
          `SELECT s.id FROM auth_sessions_legacy s JOIN auth_refresh r ON r.session_id=s.id
         WHERE r.hash=$1 FOR UPDATE OF s`,
          [legacyTokenHash(refreshToken)],
        )
      ).rows[0]
      if (row) await revokeLegacyFamily(connection, row.id, now)
    })
  }

  /** Internal OAuth handoff: call only after provider proof, in the grant-consumption transaction. */
  signInVerified(
    connection: SqlConnection,
    provider: 'google' | 'apple',
    subject: string,
    device: DeviceRegistration,
    anonId: string,
  ): Promise<SignInResponse> {
    return createSession(
      connection,
      this.clock,
      new AccessTokens(config.authSettings()),
      provider,
      subject,
      device,
      anonId,
    )
  }

  async me(principal: AuthPrincipal): Promise<{ user: User; device_id: string }> {
    const user = (
      await this.database.query<UserRow>(
        `SELECT u.id,u.created_at,i.provider FROM auth_users u
        JOIN auth_identities i ON i.user_id=u.id WHERE u.id=$1 ORDER BY i.provider LIMIT 1`,
        [principal.userId],
      )
    ).rows[0]
    if (!user) throw new LoroError('UNAUTHENTICATED')
    return {
      user: {
        id: user.id,
        created_at: user.created_at === null ? null : Number(user.created_at),
        provider: user.provider,
      },
      device_id: principal.deviceId,
    }
  }

  async claim(principal: AuthPrincipal, input: ClaimRequest): Promise<ClaimResult> {
    this.requireEnabled()
    if (input.device_id !== principal.deviceId) throw new LoroError('FORBIDDEN')
    return this.database.transaction((connection) =>
      recordClaim(connection, this.clock, principal, input.anon_id, input.request_id),
    )
  }

  private requireEnabled(): void {
    if (config.authSettings().enabled === false) throw new LoroError('PROVIDER_UNAVAILABLE')
  }

  /** Shared transport-peer budget for OAuth start/exchange and session authentication. */
  async rateAuthentication(address: string): Promise<void> {
    await this.limit(`ip:${address}`, AUTH_IP_LIMIT)
  }

  private limit(key: string, limit: number): Promise<void> {
    return consumeAuthLimit(this.limits, this.clock, key, limit)
  }

  private emailSecret(): string {
    const secret = config.authSettings().emailHashKey
    if (!secret || secret.length < 32) throw new LoroError('PROVIDER_UNAVAILABLE')
    return secret
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase()
  }

  private validDeliveryUrl(value: string | undefined): boolean {
    return value !== undefined && isAllowedMagicDeliveryUrl(value, config.isProduction())
  }
}
