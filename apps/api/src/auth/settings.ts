/** All auth deployment configuration is read here. Never expose secrets to the app. */
import type { OAuthProvider } from '@loro/core/api/oauth'
import { config } from '../common/config.js'
import { AccessTokens } from './auth.tokens.js'
/** Browser OAuth deployment: public URL, redirects, and provider client secrets. */
export interface OAuthDeploymentSettings {
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
const nativeRedirects = new Set(['loro://account', 'loro-dev://account'])
const loopbackHosts = new Set(['localhost', '127.0.0.1', '[::1]'])

export function isLoopbackHttpUrl(url: URL): boolean {
  return url.protocol === 'http:' && loopbackHosts.has(url.hostname)
}

/** Host-local inbox for development APIs. Never a public email sender. */
export const LOCAL_INBOX_DELIVERY = 'inbox:local'
export const LOCAL_INBOX_PATH = '/tmp/loro-magic-delivery.json'

/** Amazon SES sends email codes from `AUTH_EMAIL_FROM` with the host's AWS credentials. */
export const SES_DELIVERY = 'ses'

export function isAllowedMagicDeliveryUrl(value: string, production = false): boolean {
  if (value === LOCAL_INBOX_DELIVERY || value === SES_DELIVERY) return true
  try {
    const url = new URL(value)
    if (url.username || url.password || url.hash) return false
    if (url.protocol === 'https:') return true
    return !production && isLoopbackHttpUrl(url)
  } catch {
    return false
  }
}

export function isAllowedAuthRedirect(redirect: string, url = new URL(redirect)): boolean {
  return (
    (url.protocol === 'https:' || nativeRedirects.has(redirect) || isLoopbackHttpUrl(url)) &&
    !url.search &&
    !url.hash &&
    !url.username &&
    !url.password
  )
}

export function oauthDeploymentSettings(): OAuthDeploymentSettings | undefined {
  const raw = config.oauthSettings()
  if (raw.enabled !== 'true') return undefined
  const required = (name: string, value: string | undefined): string => {
    if (!value) throw new Error(`Missing auth configuration: ${name}`)
    return value
  }
  const publicUrl = required('AUTH_PUBLIC_URL', raw.publicUrl).replace(/\/$/, '')
  const origin = new URL(publicUrl)
  const loopbackHttp = !config.isProduction() && isLoopbackHttpUrl(origin)
  if (origin.origin !== publicUrl || (origin.protocol !== 'https:' && !loopbackHttp))
    throw new Error(
      'AUTH_PUBLIC_URL requires an exact HTTPS origin, or loopback HTTP in development',
    )
  const signingKey = raw.signingKey ?? ''
  const session = config.sessionAuthSettings()
  if (!session.privateKeyPem && Buffer.byteLength(signingKey) < 32)
    throw new Error('AUTH_SIGNING_KEY requires at least 32 bytes')
  new AccessTokens(session)
  const redirects = required('AUTH_REDIRECT_URIS', raw.redirectsRaw)
    .split(',')
    .map((v) => v.trim())
  for (const redirect of redirects) {
    const url = new URL(redirect)
    if (!isAllowedAuthRedirect(redirect, url))
      throw new Error(
        'Auth redirects must be exact HTTPS URLs, loopback HTTP URLs, loro://account, or loro-dev://account, without query/fragment',
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
export function providerEnabled(
  settings: OAuthDeploymentSettings,
  provider: OAuthProvider,
): boolean {
  return provider === 'google'
    ? Boolean(settings.googleClientId && settings.googleClientSecret)
    : Boolean(
        settings.appleClientId &&
        settings.appleTeamId &&
        settings.appleKeyId &&
        settings.applePrivateKey,
      )
}
