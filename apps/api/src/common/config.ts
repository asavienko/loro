/**
 * Environment access, in one place.
 *
 * Every variable has exactly ONE reader and ONE default here. `AI_PROVIDER`'s default
 * had drifted into three call sites — the service, the controller, and the boot log —
 * and three copies of a default is how the boot banner ends up naming a provider the
 * service is not actually using.
 *
 * Functions, not constants: the value is read where it is used, so nothing freezes
 * whatever the environment looked like at import time. That matters for a test that
 * boots the app after setting a variable.
 *
 * Deliberately NOT a Nest provider. `process.env` is process-global and there is
 * nothing to swap, so injecting it would buy a seam nobody uses. When there is
 * something to swap (a secrets manager, remote flags), this is the one file that
 * changes. The full variable list is docs/process/environments.md.
 */

export const config = {
  /**
   * `anthropic` | `stub`. `stub` serves the bundled scenes and is the local default,
   * which is what keeps the fallback path exercised (ADR-0010).
   */
  aiProvider: (): string => process.env['AI_PROVIDER'] ?? 'stub',

  /** Where catalog audio is served from. MinIO locally, a CDN in production. */
  cdnBaseUrl: (): string => process.env['CDN_BASE_URL'] ?? 'http://localhost:9000/loro-content',

  /** Reported by `/health`. `npm_package_version` is set by the package manager. */
  appVersion: (): string => process.env['npm_package_version'] ?? '0.0.0',

  port: (): number => Number(process.env['PORT'] ?? 3000),

  databaseUrl: (): string | undefined => process.env['DATABASE_URL'],
  allowedOrigins: (): string[] =>
    (process.env['CORS_ALLOWED_ORIGINS'] ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),

  /**
   * Production refuses to start without the shared WASM merge; development warns.
   * See main.ts for why the two differ.
   */
  isProduction: (): boolean => process.env['NODE_ENV'] === 'production',

  /** Raw browser OAuth configuration; auth/settings.ts validates deployment requirements. */
  oauthSettings: () => ({
    enabled: process.env['AUTH_ENABLED'],
    publicUrl: process.env['AUTH_PUBLIC_URL'],
    redirectsRaw: process.env['AUTH_REDIRECT_URIS'],
    signingKey: process.env['AUTH_SIGNING_KEY'],
    googleClientId: process.env['GOOGLE_CLIENT_ID'],
    googleClientSecret: process.env['GOOGLE_CLIENT_SECRET'],
    appleClientId: process.env['APPLE_CLIENT_ID'],
    appleTeamId: process.env['APPLE_TEAM_ID'],
    appleKeyId: process.env['APPLE_KEY_ID'],
    applePrivateKey: process.env['APPLE_PRIVATE_KEY'],
  }),

  /** Shared session engine for native identity proof, email and browser OAuth. */
  authSettings: () => {
    const oauth = config.oauthSettings()
    return {
      enabled: oauth.enabled === 'false' ? false : undefined,
      privateKeyPem: process.env['AUTH_PRIVATE_KEY_PEM'],
      signingKey: oauth.signingKey,
      issuer:
        process.env['AUTH_ISSUER'] ?? oauth.publicUrl?.replace(/\/$/, '') ?? 'https://api.loro.app',
      audience: 'loro-mobile',
      keyId: process.env['AUTH_KEY_ID'] ?? 'primary',
      emailHashKey: process.env['AUTH_EMAIL_HASH_KEY'],
      magicDeliveryUrl: process.env['AUTH_MAGIC_DELIVERY_URL'],
      magicDeliveryToken: process.env['AUTH_MAGIC_DELIVERY_TOKEN'],
      googleClientIds: (process.env['GOOGLE_CLIENT_IDS'] ?? oauth.googleClientId ?? '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean),
      appleClientIds: (process.env['APPLE_CLIENT_IDS'] ?? oauth.appleClientId ?? '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean),
    }
  },
} as const
