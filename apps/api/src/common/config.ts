import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ANTHROPIC_EFFORTS, type AnthropicEffort } from '../integrations/anthropic/messages.js'

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
  aiApiKey: (): string | undefined => process.env['ANTHROPIC_API_KEY'],
  aiSuggestModel: (): string => process.env['AI_MODEL_TRANSLATE'] ?? 'claude-haiku-4-5-20251001',
  /** The library's writer (plan 106): phrase decks, lyrics and cover specs. */
  aiGenerateModel: (): string => {
    // An empty line in the env file means the default, not a model called "".
    const value = process.env['AI_MODEL_GENERATE']?.trim()
    if (value) return value
    return 'claude-sonnet-5'
  },
  /**
   * How hard the writer thinks (`output_config.effort`): `low` keeps a deck quick enough to wait
   * for. Empty leaves it to the model, as a model without effort (Claude Haiku 4.5) needs; an
   * unknown value is ignored the same way.
   */
  aiGenerateEffort: (): AnthropicEffort | undefined => {
    const value = (process.env['AI_EFFORT_GENERATE'] ?? 'low').trim()
    return ANTHROPIC_EFFORTS.find((effort) => effort === value)
  },

  /**
   * A learner's daily allowances (plan 106), counted per UTC day: phrase decks, covers and songs.
   * Zero turns that kind of generation off.
   */
  libraryDailyLimit: (kind: 'phrases' | 'cover' | 'song'): number =>
    Number(
      process.env[`LIMIT_${kind.toUpperCase()}_DAILY`] ??
        { phrases: '30', cover: '10', song: '5' }[kind],
    ),
  /** Signs song audio URLs; set it when more than one API process serves the same database. */
  libraryUrlSecret: (): string | undefined => {
    const value = process.env['LIBRARY_URL_SECRET']?.trim()
    return value === '' ? undefined : value
  },
  /** How many sets, albums and songs one account keeps. */
  libraryStorageLimit: (kind: 'sets' | 'albums' | 'songs'): number =>
    Number(
      process.env[`LIMIT_${kind.toUpperCase()}_KEPT`] ??
        { sets: '100', albums: '30', songs: '120' }[kind],
    ),

  /** Lyrics model selector only. Never used to pick ElevenLabs Music. */
  musicProvider: (): string => process.env['MUSIC_PROVIDER'] ?? 'stub',
  musicMonthlyBudgetUsdPerUser: (): number =>
    Number(process.env['MUSIC_MONTHLY_BUDGET_USD_PER_USER'] ?? '0'),
  musicDailyBudgetUsdGlobal: (): number =>
    Number(process.env['MUSIC_DAILY_BUDGET_USD_GLOBAL'] ?? '0'),
  musicApiKey: (): string | undefined => process.env['MUSIC_API_KEY'],
  musicBaseUrl: (): string => process.env['MUSIC_BASE_URL'] ?? 'https://api.elevenlabs.io',

  /** Where catalog audio is served from. MinIO locally, a CDN in production. */
  cdnBaseUrl: (): string => process.env['CDN_BASE_URL'] ?? 'http://localhost:9000/loro-content',

  /** Reported by `/health`. `npm_package_version` is set by the package manager. */
  appVersion: (): string => process.env['npm_package_version'] ?? '0.0.0',

  /** Raw listen port. TTS download fallbacks keep the string form. */
  listenPort: (): string => process.env['PORT'] ?? '3000',
  port: (): number => Number(config.listenPort()),

  /** Trimmed public origin; whitespace-only is unset so Host echoing still works. */
  publicUrl: (): string | undefined => {
    const value = process.env['AUTH_PUBLIC_URL']?.trim()
    if (!value) return undefined
    return value
  },

  /** Production TTS download fallback when no public URL or Host is available. */
  authIssuer: (): string => process.env['AUTH_ISSUER'] ?? 'https://api.loro.app',

  databaseUrl: (): string | undefined => process.env['DATABASE_URL'],

  /**
   * `1` when the API sits behind Loro's nginx (the EC2 gateway), which sets `X-Real-IP` to the
   * learner's address: auth limits then key on it, from a loopback or private-network peer only
   * (common/http.ts). Anything else, the default, keys them on the transport peer.
   */
  trustProxy: (): boolean => process.env['TRUST_PROXY'] === '1',
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

  /**
   * Session/token engine: signing keys, issuer, and native/email audiences.
   * Browser OAuth deployment (redirects, client secrets) is `oauthDeploymentSettings()`.
   */
  sessionAuthSettings: (): SessionAuthSettings => {
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

  /**
   * TTS env for `parseTtsConfig`. Stub is the local default so CI never spends.
   * Catalog pins live in `CATALOG_REFERENCE_VOICES`; this reader still takes env.
   * `TTS_STUB_RENDER=1` is labeled listening-class silence only; CI stays `0`.
   * With that flag, listening-class render/asset may omit a bearer locally.
   */
  ttsEnv: (): NodeJS.Dict<string> => ({
    TTS_PROVIDER: process.env['TTS_PROVIDER'],
    TTS_API_KEY: process.env['TTS_API_KEY'],
    TTS_MODEL: process.env['TTS_MODEL'],
    TTS_OUTPUT_FORMAT: process.env['TTS_OUTPUT_FORMAT'],
    TTS_VOICE_ES_ES: process.env['TTS_VOICE_ES_ES'],
    TTS_VOICE_BG_BG: process.env['TTS_VOICE_BG_BG'],
    TTS_VOICE_RU_RU: process.env['TTS_VOICE_RU_RU'],
    TTS_VOICE_EN_GB: process.env['TTS_VOICE_EN_GB'],
    TTS_STUB_RENDER: process.env['TTS_STUB_RENDER'],
  }),

  ttsProvider: (): string => config.ttsEnv()['TTS_PROVIDER'] ?? 'stub',

  ttsCacheDir: (): string => process.env['TTS_CACHE_DIR'] ?? join(tmpdir(), 'loro-tts-cache'),
} as const

/** Session/token settings. Distinct from browser OAuth deployment settings. */
export interface SessionAuthSettings {
  enabled?: boolean | undefined
  privateKeyPem: string | undefined
  signingKey?: string | undefined
  issuer: string
  audience: string
  keyId: string
  emailHashKey: string | undefined
  magicDeliveryUrl: string | undefined
  magicDeliveryToken: string | undefined
  googleClientIds: string[]
  appleClientIds: string[]
}
