import { createRemoteJWKSet, type JWTVerifyGetKey } from 'jose'

/** Shared HTTPS JWKS fetch for native ID-token verify and browser code exchange. */
const JWKS_TIMEOUT_MS = 5_000

export const GOOGLE_ISSUER = 'https://accounts.google.com'
export const APPLE_ISSUER = 'https://appleid.apple.com'

export const IDENTITY_JWKS_URLS = {
  google: 'https://www.googleapis.com/oauth2/v3/certs',
  apple: `${APPLE_ISSUER}/auth/keys`,
} as const

export const IDENTITY_ISSUERS = {
  google: [GOOGLE_ISSUER, 'accounts.google.com'],
  apple: [APPLE_ISSUER],
} as const

export type IdentityIssuer = keyof typeof IDENTITY_JWKS_URLS

export function identityJwks(provider: IdentityIssuer): JWTVerifyGetKey {
  return createRemoteJWKSet(new URL(IDENTITY_JWKS_URLS[provider]), {
    timeoutDuration: JWKS_TIMEOUT_MS,
  })
}
