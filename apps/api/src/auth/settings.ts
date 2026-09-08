/** All auth deployment configuration is read here. Never expose secrets to the app. */
import type { OAuthProvider } from '@loro/core/api/oauth'
import { config } from '../common/config.js'
import { AccessTokens } from './auth.tokens.js'
export interface AuthSettings {
  databaseUrl: string
  publicUrl: string
  redirects: string[]
  signingKey: string
  googleClientId: string
  googleClientSecret: string
  appleClientId: string
  appleTeamId: string
  appleKeyId: string
  applePrivateKey: string
}
export function authSettings(): AuthSettings | undefined {
  const raw = config.oauthSettings()
  if (raw.enabled !== 'true') return undefined
  const required = (name: string, value: string | undefined): string => {
    if (!value) throw new Error(`Missing auth configuration: ${name}`)
    return value
  }
  const publicUrl = required('AUTH_PUBLIC_URL', raw.publicUrl).replace(/\/$/, '')
  const origin = new URL(publicUrl)
  if (origin.protocol !== 'https:' || origin.origin !== publicUrl)
    throw new Error('AUTH_PUBLIC_URL requires an exact HTTPS origin')
  const signingKey = raw.signingKey ?? ''
  if (!config.authSettings().privateKeyPem && Buffer.byteLength(signingKey) < 32)
    throw new Error('AUTH_SIGNING_KEY requires at least 32 bytes')
  new AccessTokens(config.authSettings())
  const redirects = required('AUTH_REDIRECT_URIS', raw.redirectsRaw)
    .split(',')
    .map((v) => v.trim())
  for (const redirect of redirects) {
    const url = new URL(redirect)
    if (
      (url.protocol !== 'https:' && redirect !== 'loro://account') ||
      url.search ||
      url.hash ||
      url.username ||
      url.password
    )
      throw new Error(
        'Auth redirects must be exact HTTPS URLs or loro://account, without query/fragment',
      )
  }
  return {
    databaseUrl: required('DATABASE_URL', config.databaseUrl()),
    publicUrl,
    redirects,
    signingKey,
    googleClientId: raw.googleClientId ?? '',
    googleClientSecret: raw.googleClientSecret ?? '',
    appleClientId: raw.appleClientId ?? '',
    appleTeamId: raw.appleTeamId ?? '',
    appleKeyId: raw.appleKeyId ?? '',
    applePrivateKey: (raw.applePrivateKey ?? '').replace(/\\n/g, '\n'),
  }
}
export function providerEnabled(settings: AuthSettings, provider: OAuthProvider): boolean {
  return provider === 'google'
    ? Boolean(settings.googleClientId && settings.googleClientSecret)
    : Boolean(
        settings.appleClientId &&
        settings.appleTeamId &&
        settings.appleKeyId &&
        settings.applePrivateKey,
      )
}
