import { randomBytes, randomUUID, createHash } from 'node:crypto'
import { SignJWT, jwtVerify } from 'jose'
import { LoroError } from '../common/errors.js'
import type { ServerClock } from '../common/clock.js'
import type { OAuthProvider, OAuthSession } from '@loro/core/api/oauth'
import type { AuthSettings } from './settings.js'
import { providerEnabled } from './settings.js'
import type { IdentityProvider } from './provider.js'
import { type Account, type AuthRepository } from './repository.js'

export const secret = (): string => randomBytes(32).toString('base64url')
export const hash = (value: string): string =>
  createHash('sha256').update(value).digest('base64url')
const deny = (): never => {
  throw new LoroError('UNAUTHENTICATED', 'Sign in again to continue.')
}
const SESSION_MS = 30 * 24 * 60 * 60 * 1000
export class AuthService {
  constructor(
    readonly settings: AuthSettings,
    readonly repository: AuthRepository,
    private readonly provider: IdentityProvider,
    private readonly clock: ServerClock,
  ) {}
  async rate(ip: string): Promise<void> {
    if (!(await this.repository.rate(hash(ip), this.clock.now(), 30)))
      throw new LoroError('RATE_LIMITED', 'Try again later.')
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
      const account = await this.repository.account(provider, identity.subject, randomUUID())
      const ticket = secret()
      await this.repository.saveGrant(
        hash(ticket),
        account.id,
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
  async exchange(ticket: string, verifier: string): Promise<OAuthSession> {
    const now = this.clock.now(),
      refresh = secret(),
      sessionId = randomUUID()
    const account = await this.repository.transaction(async (c) => {
      const grant = await c.query<{ user_id: string }>(
        'DELETE FROM auth_grants WHERE hash=$1 AND challenge=$2 AND expires>$3 RETURNING user_id',
        [hash(ticket), hash(verifier), now],
      )
      const userId = grant.rows[0]?.user_id
      if (!userId) return undefined
      const user = (
        await c.query<Account>('SELECT id,provider FROM auth_accounts WHERE id=$1', [userId])
      ).rows[0]
      if (!user) throw new Error('Missing account')
      await c.query('INSERT INTO auth_sessions(id,user_id,expires) VALUES($1,$2,$3)', [
        sessionId,
        userId,
        now + SESSION_MS,
      ])
      await c.query('INSERT INTO auth_refresh(hash,session_id) VALUES($1,$2)', [
        hash(refresh),
        sessionId,
      ])
      return user
    })
    if (!account) return deny()
    return this.tokens(account, sessionId, refresh, now)
  }
  async refresh(token: string): Promise<OAuthSession> {
    const now = this.clock.now(),
      next = secret()
    const result = await this.repository.transaction(async (c) => {
      const credential = (
        await c.query<{ session_id: string }>('SELECT session_id FROM auth_refresh WHERE hash=$1', [
          hash(token),
        ])
      ).rows[0]
      if (!credential) return undefined
      const session = (
        await c.query<{ user_id: string; expires: string; revoked: boolean }>(
          'SELECT user_id,expires,revoked FROM auth_sessions WHERE id=$1 FOR UPDATE',
          [credential.session_id],
        )
      ).rows[0]
      if (!session || session.revoked || Number(session.expires) <= now) return undefined
      const current = (
        await c.query<{ consumed: boolean }>('SELECT consumed FROM auth_refresh WHERE hash=$1', [
          hash(token),
        ])
      ).rows[0]
      if (!current || current.consumed) {
        await c.query('UPDATE auth_sessions SET revoked=true WHERE id=$1', [credential.session_id])
        return undefined // Commit revocation, then reject outside the transaction.
      }
      await c.query('UPDATE auth_refresh SET consumed=true WHERE hash=$1', [hash(token)])
      await c.query('INSERT INTO auth_refresh(hash,session_id) VALUES($1,$2)', [
        hash(next),
        credential.session_id,
      ])
      const user = (
        await c.query<Account>('SELECT id,provider FROM auth_accounts WHERE id=$1', [
          session.user_id,
        ])
      ).rows[0]
      if (!user) throw new Error('Missing account')
      return { user, sessionId: credential.session_id }
    })
    if (!result) return deny()
    return this.tokens(result.user, result.sessionId, next, now)
  }
  async logout(token: string): Promise<void> {
    await this.repository.pool.query(
      'UPDATE auth_sessions SET revoked=true WHERE id IN (SELECT session_id FROM auth_refresh WHERE hash=$1)',
      [hash(token)],
    )
  }
  async principal(token: string): Promise<Account> {
    try {
      const { payload } = await jwtVerify(
        token,
        new TextEncoder().encode(this.settings.signingKey),
        {
          algorithms: ['HS256'],
          issuer: this.settings.publicUrl,
          audience: 'loro-api',
          currentDate: new Date(this.clock.now()),
          requiredClaims: ['sub', 'exp', 'iat', 'sid'],
        },
      )
      if (typeof payload['sid'] !== 'string' || !payload.sub) return deny()
      const result = await this.repository.pool.query<Account>(
        `SELECT a.id,a.provider FROM auth_accounts a JOIN auth_sessions s ON s.user_id=a.id
        WHERE s.id=$1 AND a.id=$2 AND s.revoked=false AND s.expires>$3`,
        [payload['sid'], payload.sub, this.clock.now()],
      )
      return result.rows[0] ?? deny()
    } catch {
      return deny()
    }
  }
  private async tokens(
    user: Account,
    sessionId: string,
    refresh: string,
    now: number,
  ): Promise<OAuthSession> {
    const access = await new SignJWT({ sid: sessionId })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuer(this.settings.publicUrl)
      .setAudience('loro-api')
      .setSubject(user.id)
      .setIssuedAt(Math.floor(now / 1000))
      .setExpirationTime(Math.floor(now / 1000) + 900)
      .sign(new TextEncoder().encode(this.settings.signingKey))
    return { access_token: access, refresh_token: refresh, expires_in: 900, user }
  }
}
