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

  /**
   * Production refuses to start without the shared WASM merge; development warns.
   * See main.ts for why the two differ.
   */
  isProduction: (): boolean => process.env['NODE_ENV'] === 'production',
} as const
