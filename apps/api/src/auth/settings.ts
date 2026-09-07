/** All auth deployment configuration is read here. Never expose secrets to the app. */
import type { OAuthProvider } from '@loro/core/api/oauth'
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
  const env = process.env
  if (env['AUTH_ENABLED'] !== 'true') return undefined
  const required = (name: string): string => {
    const value = env[name]
    if (!value) throw new Error(`Missing auth configuration: ${name}`)
    return value
  }
  const publicUrl = required('AUTH_PUBLIC_URL').replace(/\/$/, '')
  const origin = new URL(publicUrl)
  if (origin.protocol !== 'https:' || origin.origin !== publicUrl)
    throw new Error('AUTH_PUBLIC_URL requires an exact HTTPS origin')
  const signingKey = required('AUTH_SIGNING_KEY')
  if (Buffer.byteLength(signingKey) < 32)
    throw new Error('AUTH_SIGNING_KEY requires at least 32 bytes')
  const redirects = required('AUTH_REDIRECT_URIS')
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
    databaseUrl: required('DATABASE_URL'),
    publicUrl,
    redirects,
    signingKey,
    googleClientId: env['GOOGLE_CLIENT_ID'] ?? '',
    googleClientSecret: env['GOOGLE_CLIENT_SECRET'] ?? '',
    appleClientId: env['APPLE_CLIENT_ID'] ?? '',
    appleTeamId: env['APPLE_TEAM_ID'] ?? '',
    appleKeyId: env['APPLE_KEY_ID'] ?? '',
    applePrivateKey: (env['APPLE_PRIVATE_KEY'] ?? '').replace(/\\n/g, '\n'),
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
