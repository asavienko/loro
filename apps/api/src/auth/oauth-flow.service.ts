/** Browser/native OAuth handoff; the shared AuthService owns every account and session. */
import { randomBytes, createHash } from 'node:crypto'
import { LoroError } from '../common/errors.js'
import type { ServerClock } from '../common/clock.js'
import type { OAuthProvider } from '@loro/core/api/oauth'
import type { DeviceRegistration, SignInResponse } from '@loro/core/api/account'
import type { SqlDatabase } from '../database/database.js'
import type { OAuthDeploymentSettings } from './settings.js'
import { providerEnabled } from './settings.js'
import type { OAuthIdentity } from './provider.js'
import type { AuthService } from './auth.service.js'
import { OAuthRepository } from './repository.js'

export const secret = (): string => randomBytes(32).toString('base64url')
export const hash = (value: string): string =>
  createHash('sha256').update(value).digest('base64url')
const deny = (): never => {
  throw new LoroError('UNAUTHENTICATED', 'Sign in again to continue.')
}
export class OAuthFlowService {
  readonly repository: OAuthRepository
  constructor(
    readonly settings: OAuthDeploymentSettings,
    private readonly database: SqlDatabase,
    private readonly provider: OAuthIdentity,
    private readonly sessions: AuthService,
    private readonly clock: ServerClock,
  ) {
    this.repository = new OAuthRepository(database)
  }
  async rate(ip: string): Promise<void> {
    await this.sessions.rateAuthentication(ip)
  }
  async start(provider: OAuthProvider, redirect: string, challenge: string) {
    if (!providerEnabled(this.settings, provider))
      throw new LoroError('PROVIDER_UNAVAILABLE', 'Sign-in is not configured.')
    if (!this.settings.redirects.includes(redirect))
      throw new LoroError('VALIDATION_FAILED', 'Invalid redirect.')
    const state = secret(),
      nonce = secret(),
      verifier = secret()
    await this.repository.saveAttempt({
      hash: hash(state),
      provider,
      nonce,
      verifier,
      challenge,
      redirect,
      expires: this.clock.now() + 300_000,
    })
    return {
      authorization_url: this.provider.authorizationUrl(provider, state, nonce, hash(verifier)),
      state,
    }
  }
  async callback(provider: OAuthProvider, state: string, code?: string): Promise<string> {
    const attempt = await this.repository.consumeAttempt(hash(state), provider, this.clock.now())
    if (!attempt) return deny()
    const url = new URL(attempt.redirect)
    url.searchParams.set('state', state)
    try {
      if (!code) throw new Error('Provider declined')
      const identity = await this.provider.exchange(
        provider,
        code,
        attempt.nonce,
        attempt.verifier,
        this.clock.now(),
      )
      if (identity.provider !== provider) throw new Error('Provider mismatch')
      const ticket = secret()
      await this.repository.saveGrant(
        hash(ticket),
        provider,
        identity.subject,
        attempt.challenge,
        this.clock.now() + 60_000,
      )
      url.searchParams.set('ticket', ticket)
    } catch {
      // Provider errors and tokens never enter logs or redirect query parameters.
      url.searchParams.set('error', 'sign_in_failed')
    }
    return url.toString()
  }
  async exchange(
    ticket: string,
    verifier: string,
    device: DeviceRegistration,
    anonId: string,
  ): Promise<SignInResponse> {
    return this.database.transaction(async (connection) => {
      const grant = await this.repository.consumeGrant(
        connection,
        hash(ticket),
        hash(verifier),
        this.clock.now(),
      )
      if (!grant) return deny()
      // Redemption, identity lookup, installation registration and token creation commit together.
      return this.sessions.signInVerified(connection, grant.provider, grant.subject, device, anonId)
    })
  }
}
