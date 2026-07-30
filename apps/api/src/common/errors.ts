/**
 * RFC 9457 problem details.
 *
 * `code` is the CONTRACT — the client switches on it. `title` and `detail` are for
 * logs and are never shown verbatim to a learner.
 *
 * See docs/architecture/api.md#error-shape
 */

export const ERROR_CODES = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  PLAN_REQUIRED: 402,
  SCHEMA_TOO_OLD: 409,
  RATE_LIMITED: 429,
  BUDGET_EXCEEDED: 429,
  VALIDATION_FAILED: 422,
  PROVIDER_UNAVAILABLE: 503,
  INTERNAL: 500,
} as const

export type ErrorCode = keyof typeof ERROR_CODES

/** What the client is expected to do. Documented so the two sides can't drift. */
export const CLIENT_BEHAVIOUR: Record<ErrorCode, string> = {
  UNAUTHENTICATED: 'refresh once, then re-auth. NEVER drop the outbox',
  FORBIDDEN: 'log — this is a bug if it happens',
  PLAN_REQUIRED: 'show the paywall for the relevant feature',
  SCHEMA_TOO_OLD: 'prompt to update; pause sync; local use continues',
  RATE_LIMITED: 'back off per Retry-After',
  BUDGET_EXCEEDED: 'use the bundled fallback SILENTLY — the learner must not notice',
  VALIDATION_FAILED: 'dead-letter the op locally and report. Never retry blindly',
  PROVIDER_UNAVAILABLE: 'bundled fallback',
  INTERNAL: 'backoff',
}

/**
 * `NOT_FOUND` is not a `LoroError` code — it is what the filter emits for a routing
 * 404 raised by the framework itself. Naming it here rather than leaving it as a loose
 * string in the filter is the only way the client's switch and this table can be
 * checked against each other.
 */
export type ProblemCode = ErrorCode | 'NOT_FOUND'

export interface ProblemDetails {
  type: string
  title: string
  status: number
  detail?: string
  code: ProblemCode
  [key: string]: unknown
}

const TITLES: Record<ErrorCode, string> = {
  UNAUTHENTICATED: 'Authentication required',
  FORBIDDEN: 'Not permitted',
  PLAN_REQUIRED: 'This feature requires Loro Plus',
  SCHEMA_TOO_OLD: 'Client schema version is no longer supported',
  RATE_LIMITED: 'Too many requests',
  BUDGET_EXCEEDED: 'AI budget exceeded',
  VALIDATION_FAILED: 'Request failed validation',
  PROVIDER_UNAVAILABLE: 'Upstream provider unavailable',
  INTERNAL: 'Internal error',
}

export class LoroError extends Error {
  readonly code: ErrorCode
  readonly status: number
  readonly extra: Record<string, unknown>

  constructor(code: ErrorCode, detail?: string, extra: Record<string, unknown> = {}) {
    super(detail ?? TITLES[code])
    this.name = 'LoroError'
    this.code = code
    this.status = ERROR_CODES[code]
    this.extra = extra
  }
}

/** The `type` URI namespace. Documented in docs/architecture/api.md#error-shape. */
const PROBLEM_TYPE_BASE = 'https://loro.app/errors'

/** The media type every problem body is served as, per RFC 9457. */
export const PROBLEM_MEDIA_TYPE = 'application/problem+json'

interface ProblemInit {
  /** The last segment of the `type` URI. */
  slug: string
  title: string
  status: number
  code: ProblemCode
  /** Fields the client needs beyond the RFC members, e.g. `min_app_version`. */
  extra?: Record<string, unknown>
}

/**
 * The ONE place a problem+json body is constructed.
 *
 * Three call sites used to spell the shape out by hand, so the member order and the
 * `type` prefix were three separate opportunities to drift from the documented
 * contract. Key order is part of that contract for anyone diffing responses, so it is
 * fixed here: `type`, `title`, `status`, `code`, then extras.
 */
function problem({ slug, title, status, code, extra = {} }: ProblemInit): ProblemDetails {
  return { type: `${PROBLEM_TYPE_BASE}/${slug}`, title, status, code, ...extra }
}

/**
 * Map an error to a problem-details body.
 *
 * NEVER leaks a stack trace, an internal identifier, or SQL text — an unknown error
 * becomes a bare INTERNAL. See docs/architecture/security-privacy.md#server-hardening
 */
export function toProblemDetails(e: unknown): ProblemDetails {
  if (e instanceof LoroError) {
    return problem({
      slug: kebab(e.code),
      title: TITLES[e.code],
      status: e.status,
      code: e.code,
      // `detail` is omitted when it would only repeat the title.
      extra: { ...(e.message !== TITLES[e.code] ? { detail: e.message } : {}), ...e.extra },
    })
  }
  return problem({
    slug: 'internal',
    title: TITLES.INTERNAL,
    status: ERROR_CODES.INTERNAL,
    code: 'INTERNAL',
  })
}

/**
 * A problem body for an exception the FRAMEWORK raised — a routing 404, a malformed
 * body — where there is no `LoroError` and so no `code` of ours to report. The status
 * carries the meaning, and `title` is the framework's own message, which is safe: it
 * describes the request, not our internals.
 */
export function toHttpProblemDetails(status: number, title: string): ProblemDetails {
  return problem({
    slug: 'http',
    title,
    status,
    code: status === 404 ? 'NOT_FOUND' : 'INTERNAL',
  })
}

function kebab(code: string): string {
  return code.toLowerCase().replace(/_/g, '-')
}

/** Rate limits, per docs/architecture/api.md#rate-limits. */
export const RATE_LIMITS = {
  auth: { perUser: 10, perIp: 30, windowMinutes: 15 },
  sync: { perUser: 120, perIp: 600, windowMinutes: 1 },
  content: { perUser: 60, perIp: 600, windowMinutes: 1 },
  aiScene: { perUser: 20, perIp: 200, windowMinutes: 60, perUserDaily: 60 },
  aiOther: { perUser: 60, perIp: 400, windowMinutes: 60 },
  ttsRender: { perUser: 100, perIp: 500, windowMinutes: 1440 },
  ttsVoiceClone: { perUser: 20, perIp: 60, windowMinutes: 1440 },
  analytics: { perUser: 60, perIp: 600, windowMinutes: 1 },
} as const

export type RateLimitGroup = keyof typeof RATE_LIMITS
