import { importPKCS8, jwtVerify, SignJWT, type JWTVerifyGetKey } from 'jose'
import type { OAuthProvider } from '@loro/core/api/oauth'
import type { OAuthDeploymentSettings } from './settings.js'
import { APPLE_ISSUER, GOOGLE_ISSUER, IDENTITY_ISSUERS, identityJwks } from './jwks.js'

const GOOGLE_AUTH = `${GOOGLE_ISSUER}/o/oauth2/v2/auth`
const APPLE_AUTH = `${APPLE_ISSUER}/auth/authorize`
const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token'
const APPLE_TOKEN = `${APPLE_ISSUER}/auth/token`

export interface ProviderIdentity {
  subject: string
  provider: OAuthProvider
}
/** Browser OAuth authorization + code exchange. Distinct from `IdentityProvider` (`apple` | `google`) in `auth.providers.ts`. */
export interface OAuthIdentity {
  authorizationUrl(provider: OAuthProvider, state: string, nonce: string, challenge: string): string
  exchange(
    provider: OAuthProvider,
    code: string,
    nonce: string,
    verifier: string,
    now: number,
  ): Promise<ProviderIdentity>
}
export class OAuthIdentityProvider implements OAuthIdentity {
  constructor(
    private readonly settings: OAuthDeploymentSettings,
    private readonly keys: { google: JWTVerifyGetKey; apple: JWTVerifyGetKey } = {
      google: identityJwks('google'),
      apple: identityJwks('apple'),
    },
  ) {}
  private callback(provider: OAuthProvider): string {
    return `${this.settings.publicUrl}/v1/auth/${provider}/callback`
  }
  authorizationUrl(
    provider: OAuthProvider,
    state: string,
    nonce: string,
    challenge: string,
  ): string {
    const google = provider === 'google'
    const url = new URL(google ? GOOGLE_AUTH : APPLE_AUTH)
    url.search = new URLSearchParams({
      client_id: google ? this.settings.googleClientId : this.settings.appleClientId,
      redirect_uri: this.callback(provider),
      response_type: 'code',
      scope: google ? 'openid email' : 'email',
      state,
      nonce,
      ...(google
        ? { code_challenge: challenge, code_challenge_method: 'S256' }
        : { response_mode: 'form_post' }),
    }).toString()
    return url.toString()
  }
  async exchange(
    provider: OAuthProvider,
    code: string,
    nonce: string,
    verifier: string,
    now: number,
  ): Promise<ProviderIdentity> {
    const google = provider === 'google'
    const clientId = google ? this.settings.googleClientId : this.settings.appleClientId
    const seconds = Math.floor(now / 1000)
    const secret = google
      ? this.settings.googleClientSecret
      : await new SignJWT({})
          .setProtectedHeader({ alg: 'ES256', kid: this.settings.appleKeyId })
          .setIssuer(this.settings.appleTeamId)
          .setSubject(clientId)
          .setAudience(APPLE_ISSUER)
          .setIssuedAt(seconds)
          .setExpirationTime(seconds + 300)
          .sign(await importPKCS8(this.settings.applePrivateKey, 'ES256'))
    const response = await fetch(google ? GOOGLE_TOKEN : APPLE_TOKEN, {
      method: 'POST',
      redirect: 'error',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: secret,
        redirect_uri: this.callback(provider),
        ...(google ? { code_verifier: verifier } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) throw new Error('Provider exchange failed')
    const body: unknown = await response.json()
    if (
      !body ||
      typeof body !== 'object' ||
      !('id_token' in body) ||
      typeof body.id_token !== 'string'
    )
      throw new Error('Missing identity token')
    const { payload } = await jwtVerify(body.id_token, this.keys[provider], {
      issuer: [...IDENTITY_ISSUERS[provider]],
      audience: clientId,
      algorithms: ['RS256'],
      currentDate: new Date(now),
      clockTolerance: 30,
      requiredClaims: ['exp', 'iat', 'sub', 'nonce'],
    })
    if (
      payload.nonce !== nonce ||
      !payload.sub ||
      (payload.azp !== undefined && payload.azp !== clientId)
    )
      throw new Error('Invalid identity')
    return { subject: payload.sub, provider }
  }
}
