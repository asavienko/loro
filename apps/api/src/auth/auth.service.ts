import { randomBytes, randomInt, randomUUID } from 'node:crypto'
import { Inject, Injectable } from '@nestjs/common'
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
import { DATABASE, type SqlDatabase, type SqlConnection } from '../database/database.js'
import {
  ACCESS_SECONDS,
  AccessTokens,
  CODE_MILLISECONDS,
  equalHash,
  keyedHash,
  legacyTokenHash,
  MAX_CODE_ATTEMPTS,
  newRefreshToken,
  REFRESH_MILLISECONDS,
  tokenHash,
  type AuthPrincipal,
} from './auth.tokens.js'
import { verifyIdentityToken, type IdentityProvider } from './auth.providers.js'

interface UserRow {
  id: string
  created_at: string | number | null
  provider?: string
}
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

interface LegacyRefreshRow {
  id: string
  user_id: string
  expires: string | number
  revoked: boolean
  consumed: boolean
  provider: 'google' | 'apple'
  subject: string
}

export interface RefreshRegistration {
  device: DeviceRegistration
  anon_id: string
}

const RATE_WINDOW = 15 * 60 * 1_000
const AUTH_IP_LIMIT = 30
const EMAIL_LIMIT = 5

@Injectable()
export class AuthService {
  constructor(
    @Inject(DATABASE) private readonly database: SqlDatabase,
    @Inject(SERVER_CLOCK) private readonly clock: ServerClock,
  ) {}

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
      this.createSession(connection, tokens, provider, subject, input.device, input.anon_id),
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
      const response = await fetch(settings.magicDeliveryUrl, {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(5_000),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${settings.magicDeliveryToken}`,
        },
        body: JSON.stringify({ email: normalized, code, expires_in: CODE_MILLISECONDS / 1_000 }),
      })
      // Delivery response content is not a trusted error message and is never logged.
      await response.body?.cancel()
      if (!response.ok) throw new Error('Delivery unavailable')
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
      return this.createSession(connection, tokens, 'email', emailHash, input.device, input.anon_id)
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
      if (!row) return this.upgradeLegacyRefresh(connection, tokens, refreshToken, registration)
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
      await this.insertRefresh(connection, nextToken, row.id, Number(row.expires_at))
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
      if (!(await this.hasLegacySessions(connection))) return
      const row = (
        await connection.query<{ id: string }>(
          `SELECT s.id FROM auth_sessions_legacy s JOIN auth_refresh r ON r.session_id=s.id
         WHERE r.hash=$1 FOR UPDATE OF s`,
          [legacyTokenHash(refreshToken)],
        )
      ).rows[0]
      if (row) await this.revokeLegacyFamily(connection, row.id, now)
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
    return this.createSession(
      connection,
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
      this.recordClaim(connection, principal, input.anon_id, input.request_id),
    )
  }

  private async createSession(
    connection: SqlConnection,
    tokens: AccessTokens,
    provider: string,
    subject: string,
    device: DeviceRegistration,
    anonId: string,
    legacyExpiresAt?: number,
  ): Promise<SignInResponse> {
    const now = this.clock.now()
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
    await this.insertRefresh(connection, refreshToken, principal.sessionId, expiresAt)
    const claim = await this.recordClaim(connection, principal, anonId, anonId)
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

  private async upgradeLegacyRefresh(
    connection: SqlConnection,
    tokens: AccessTokens,
    refreshToken: string,
    registration?: RefreshRegistration,
  ): Promise<SignInResponse | null> {
    if (!(await this.hasLegacySessions(connection))) return null
    const row = (
      await connection.query<LegacyRefreshRow>(
        `SELECT s.id,s.user_id,s.expires,s.revoked,r.consumed,a.provider,a.subject
       FROM auth_refresh r JOIN auth_sessions_legacy s ON s.id=r.session_id
       JOIN auth_accounts a ON a.id=s.user_id WHERE r.hash=$1 FOR UPDATE OF s,r`,
        [legacyTokenHash(refreshToken)],
      )
    ).rows[0]
    if (!row) return null
    const now = this.clock.now()
    if (row.consumed || row.revoked) {
      // Revocation commits outside the eventual 401, including an already-upgraded family.
      await this.revokeLegacyFamily(connection, row.id, now)
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
    const result = await this.createSession(
      connection,
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

  private async hasLegacySessions(connection: SqlConnection): Promise<boolean> {
    return (
      (
        await connection.query<{ present: boolean }>(
          `SELECT to_regclass(format('%I.auth_refresh',current_schema())) IS NOT NULL
         AND to_regclass(format('%I.auth_sessions_legacy',current_schema())) IS NOT NULL AS present`,
        )
      ).rows[0]?.present === true
    )
  }

  private async revokeLegacyFamily(
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

  private requireEnabled(): void {
    if (config.authSettings().enabled === false) throw new LoroError('PROVIDER_UNAVAILABLE')
  }

  private async recordClaim(
    connection: SqlConnection,
    principal: AuthPrincipal,
    anonId: string,
    requestId: string,
  ): Promise<ClaimResult> {
    const row = (
      await connection.query<{ id: string; anon_id: string }>(
        `INSERT INTO auth_claims(id,user_id,device_id,request_id,anon_id,created_at)
       VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(user_id,device_id,request_id) DO UPDATE
       SET request_id=EXCLUDED.request_id RETURNING id,anon_id`,
        [randomUUID(), principal.userId, principal.deviceId, requestId, anonId, this.clock.now()],
      )
    ).rows[0]
    if (!row) throw new LoroError('INTERNAL')
    if (row.anon_id !== anonId) throw new LoroError('VALIDATION_FAILED')
    // The server never moves rows named by anon_id. The device must upload its
    // actual local rows before reconciliation can be considered complete.
    return { performed: false, mode: null, claim_id: row.id, upload_required: true }
  }

  private async insertRefresh(
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

  /** Shared transport-peer budget for OAuth start/exchange and session authentication. */
  async rateAuthentication(address: string): Promise<void> {
    await this.limit(`ip:${address}`, AUTH_IP_LIMIT)
  }

  private async limit(key: string, limit: number): Promise<void> {
    const now = this.clock.now()
    const window = Math.floor(now / RATE_WINDOW)
    // Hash addresses; raw IPs and emails never enter rate-limit storage.
    const bucket = tokenHash(`${key}:${window}`)
    const result = await this.database.query<{ count: number }>(
      `INSERT INTO auth_rate_limits(bucket,count,expires_at) VALUES($1,1,$2)
       ON CONFLICT(bucket) DO UPDATE SET count=auth_rate_limits.count+1 RETURNING count`,
      [bucket, (window + 1) * RATE_WINDOW],
    )
    if (!result.rows[0] || result.rows[0].count > limit) {
      throw new LoroError('RATE_LIMITED', undefined, {
        retry_after: Math.ceil(((window + 1) * RATE_WINDOW - now) / 1_000),
      })
    }
    await this.database.query('DELETE FROM auth_rate_limits WHERE expires_at<$1', [
      now - RATE_WINDOW,
    ])
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
    if (!value) return false
    try {
      const url = new URL(value)
      return url.protocol === 'https:' && !url.username && !url.password && !url.hash
    } catch {
      return false
    }
  }
}
