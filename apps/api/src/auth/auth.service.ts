import { randomBytes, randomInt } from 'node:crypto'
import { Inject, Injectable, Logger, Optional } from '@nestjs/common'
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
import { RATE_LIMIT_STORE, type RateLimitStore } from '../common/rate-limit.js'
import { PostgresRateLimitStore } from '../common/rate-limit.postgres.js'
import { DATABASE, type SqlConnection, type SqlDatabase } from '../database/database.js'
import { deliverMagicCode } from './delivery.js'
import { isAllowedMagicDeliveryUrl, SES_DELIVERY } from './settings.js'
import { verifyIdentityToken, type IdentityProvider } from './auth.providers.js'
import { AUTH_STORE, PostgresAuthStore, type AuthStore } from './auth.store.js'
import type { RefreshRegistration } from './auth.session.js'
import { AUTH_IP_LIMIT, EMAIL_LIMIT, consumeAuthLimit } from './auth.rate-limit.js'
import {
  ACCESS_TOKENS,
  AccessTokens,
  CODE_MILLISECONDS,
  equalHash,
  keyedHash,
  MAX_CODE_ATTEMPTS,
  type AuthPrincipal,
} from './auth.tokens.js'

export type { RefreshRegistration }

@Injectable()
export class AuthService {
  private readonly limits: RateLimitStore
  private readonly store: AuthStore
  private readonly issuedTokens: AccessTokens | undefined
  private readonly logger = new Logger('auth')

  constructor(
    @Inject(DATABASE) database: SqlDatabase,
    @Inject(SERVER_CLOCK) private readonly clock: ServerClock,
    @Optional() @Inject(RATE_LIMIT_STORE) limits?: RateLimitStore,
    @Optional() @Inject(AUTH_STORE) store?: AuthStore,
    @Optional() @Inject(ACCESS_TOKENS) tokens?: AccessTokens | null,
  ) {
    this.limits = limits ?? new PostgresRateLimitStore(database)
    this.store = store ?? new PostgresAuthStore(database, clock)
    this.issuedTokens = tokens ?? undefined
  }

  capabilities(): { apple: boolean; google: boolean; email: boolean } {
    const settings = config.sessionAuthSettings()
    let canSign = false
    try {
      this.tokens()
      canSign = true
    } catch {
      /* Unconfigured or malformed keys do not advertise a working provider. */
    }
    return {
      apple: canSign && settings.appleClientIds.length > 0,
      google: canSign && settings.googleClientIds.length > 0,
      email:
        canSign &&
        Boolean(settings.emailHashKey && settings.emailHashKey.length >= 32) &&
        this.validDeliveryUrl(settings.magicDeliveryUrl) &&
        // SES needs a sender; the webhook and the local inbox need the bearer.
        (settings.magicDeliveryUrl === SES_DELIVERY
          ? Boolean(settings.emailFrom)
          : Boolean(settings.magicDeliveryToken)),
    }
  }

  async signIn(
    provider: IdentityProvider,
    input: SignInRequest,
    address: string,
  ): Promise<SignInResponse> {
    const settings = config.sessionAuthSettings()
    const tokens = this.tokens()
    await this.limit(`ip:${address}`, AUTH_IP_LIMIT)
    const subject = await verifyIdentityToken(
      provider,
      input.identity_token,
      provider === 'google' ? settings.googleClientIds : settings.appleClientIds,
      this.clock.now(),
    )
    return this.store.transaction((connection) =>
      this.store.createSession(connection, tokens, provider, subject, input.device, input.anon_id),
    )
  }

  async requestCode(email: string, address: string): Promise<{ status: 'accepted' }> {
    const settings = config.sessionAuthSettings()
    if (!this.capabilities().email || !settings.magicDeliveryUrl) {
      throw new LoroError('PROVIDER_UNAVAILABLE')
    }
    this.tokens()
    const secret = this.emailSecret()
    const normalized = this.normalizeEmail(email)
    const emailHash = keyedHash(secret, `email:${normalized}`)
    await this.limit(`ip:${address}`, AUTH_IP_LIMIT)
    await this.limit(`email:${emailHash}`, EMAIL_LIMIT)
    const now = this.clock.now()
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0')
    const nonce = randomBytes(32).toString('hex')
    const codeHash = keyedHash(secret, `code:${emailHash}:${nonce}:${code}`)
    await this.store.saveMagicCode(emailHash, codeHash, nonce, now + CODE_MILLISECONDS, now)
    try {
      await deliverMagicCode(
        {
          url: settings.magicDeliveryUrl,
          token: settings.magicDeliveryToken,
          from: settings.emailFrom,
        },
        { email: normalized, code, expires_in: CODE_MILLISECONDS / 1_000 },
      )
    } catch (error) {
      // The error's name only (e.g. SES MessageRejected): never the address or the code.
      this.logger.warn(
        `email code delivery failed: ${error instanceof Error ? error.name : 'unknown'}`,
      )
      await this.store.deleteMagicCode(emailHash, codeHash)
      throw new LoroError('PROVIDER_UNAVAILABLE')
    }
    return { status: 'accepted' }
  }

  async verifyCode(input: MagicVerifyRequest, address: string): Promise<SignInResponse> {
    const tokens = this.tokens()
    const secret = this.emailSecret()
    const emailHash = keyedHash(secret, `email:${this.normalizeEmail(input.email)}`)
    await this.limit(`ip:${address}`, AUTH_IP_LIMIT)
    const now = this.clock.now()
    const result = await this.store.transaction<SignInResponse | null>(async (connection) => {
      const row = await this.store.loadMagicCode(connection, emailHash)
      if (!row || Number(row.expires_at) <= now || row.attempts >= MAX_CODE_ATTEMPTS) return null
      const valid = equalHash(
        keyedHash(secret, `code:${emailHash}:${row.nonce}:${input.code}`),
        row.code_hash,
      )
      if (!valid) {
        await this.store.incrementMagicAttempts(connection, emailHash)
        return null
      }
      await this.store.deleteMagicCodeFor(connection, emailHash)
      return this.store.createSession(
        connection,
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
    const tokens = this.tokens()
    await this.limit(`ip:${address}`, AUTH_IP_LIMIT)
    if (!/^[A-Za-z0-9_-]{43}$/.test(refreshToken)) throw new LoroError('UNAUTHENTICATED')
    const now = this.clock.now()
    const result = await this.store.transaction<TokenResponse | null>(async (connection) => {
      const row = await this.store.loadRefresh(connection, refreshToken)
      if (!row)
        return this.store.upgradeLegacyRefresh(connection, tokens, refreshToken, registration)
      if (row.revoked_at !== null) return null
      if (row.consumed_at !== null) {
        await this.store.revokeSession(connection, row.id, now)
        return null
      }
      if (Number(row.expires_at) <= now) return null
      await this.store.consumeRefresh(connection, refreshToken, now)
      return this.store.rotateRefresh(connection, tokens, row, now)
    })
    if (!result) throw new LoroError('UNAUTHENTICATED')
    return result
  }

  async authenticate(accessToken: string): Promise<AuthPrincipal> {
    const principal = await this.tokens().verify(accessToken, this.clock.now())
    const session = await this.store.loadSession(principal)
    if (session?.revoked_at !== null || Number(session.expires_at) <= this.clock.now()) {
      throw new LoroError('UNAUTHENTICATED')
    }
    return principal
  }

  async logout(principal: AuthPrincipal): Promise<void> {
    this.requireEnabled()
    await this.store.revokePrincipal(principal, this.clock.now())
  }

  /** Possession of a refresh token can only revoke its family, never read account data. */
  async revokeRefresh(refreshToken: string): Promise<void> {
    this.requireEnabled()
    if (!/^[A-Za-z0-9_-]{43}$/.test(refreshToken)) throw new LoroError('UNAUTHENTICATED')
    await this.store.revokeByRefresh(refreshToken, this.clock.now())
  }

  /** Internal OAuth handoff: call only after provider proof, in the grant-consumption transaction. */
  signInVerified(
    connection: SqlConnection,
    provider: 'google' | 'apple',
    subject: string,
    device: DeviceRegistration,
    anonId: string,
  ): Promise<SignInResponse> {
    return this.store.createSession(connection, this.tokens(), provider, subject, device, anonId)
  }

  async me(principal: AuthPrincipal): Promise<{ user: User; device_id: string }> {
    const user = await this.store.loadUser(principal.userId)
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
    return this.store.transaction((connection) =>
      this.store.recordClaim(connection, principal, input),
    )
  }

  private requireEnabled(): void {
    if (config.sessionAuthSettings().enabled === false) throw new LoroError('PROVIDER_UNAVAILABLE')
  }

  /** Shared transport-peer budget for OAuth start/exchange and session authentication. */
  async rateAuthentication(address: string): Promise<void> {
    await this.limit(`ip:${address}`, AUTH_IP_LIMIT)
  }

  private tokens(): AccessTokens {
    return this.issuedTokens ?? new AccessTokens(config.sessionAuthSettings())
  }

  private limit(key: string, limit: number): Promise<void> {
    return consumeAuthLimit(this.limits, this.clock, key, limit)
  }

  private emailSecret(): string {
    const secret = config.sessionAuthSettings().emailHashKey
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
