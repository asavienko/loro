/**
 * RFC 9457 problem details.
 *
 * `code` is the CONTRACT — the client switches on it. `title` and `detail` are for
 * logs and are never shown verbatim to a learner.
 *
 * See docs/architecture/api.md#error-shape
 */

interface ErrorSpec {
  /** The HTTP status. */
  status: number
  /** For logs and diagnostics. Never shown verbatim to a learner. */
  title: string
  /** What the client is expected to do. Documented so the two sides can't drift. */
  client: string
}

/**
 * ONE row per code.
 *
 * This was three parallel tables — status, title, client behaviour — each keyed by the
 * same union and each living in a different part of the file. Adding a code meant three
 * edits, and reading what `PLAN_REQUIRED` means meant three lookups. The three exports
 * below are now views over this, so a code cannot exist with two of the three defined.
 */
const CATALOG = {
  UNAUTHENTICATED: {
    status: 401,
    title: 'Authentication required',
    client: 'refresh once, then re-auth. NEVER drop the outbox',
  },
  FORBIDDEN: {
    status: 403,
    title: 'Not permitted',
    client: 'log — this is a bug if it happens',
  },
  PLAN_REQUIRED: {
    status: 402,
    title: 'This feature requires Loro Plus',
    client: 'show the paywall for the relevant feature',
  },
  SCHEMA_TOO_OLD: {
    status: 409,
    title: 'Client schema version is no longer supported',
    client: 'prompt to update; pause sync; local use continues',
  },
  RATE_LIMITED: {
    status: 429,
    title: 'Too many requests',
    client: 'back off per Retry-After',
  },
  BUDGET_EXCEEDED: {
    status: 429,
    title: 'AI budget exceeded',
    client: 'use the bundled fallback SILENTLY — the learner must not notice',
  },
  VALIDATION_FAILED: {
    status: 422,
    title: 'Request failed validation',
    client: 'dead-letter the op locally and report. Never retry blindly',
  },
  PROVIDER_UNAVAILABLE: {
    status: 503,
    title: 'Upstream provider unavailable',
    client: 'bundled fallback',
  },
  INTERNAL: {
    status: 500,
    title: 'Internal error',
    client: 'backoff',
  },
  /**
   * Emitted by the exception filter for a routing 404, never thrown as a `LoroError`.
   * It was previously a loose string in the filter — the one field this file's header
   * calls "the CONTRACT — the client switches on it" was shipping a value the contract
   * did not define, and `CLIENT_BEHAVIOUR` had no row to tell a client what to do with
   * it. The emitted body is unchanged; only the table now admits it exists.
   */
  NOT_FOUND: {
    status: 404,
    title: 'Not found',
    client: 'log — a 404 on a route the client knows is a bug. Never retry blindly',
  },
  CURSOR_EXPIRED: {
    status: 409,
    title: 'Sync cursor is not available',
    client: 'restart a full pull while retaining local writes',
  },
  /** A learner's own daily allowance or storage cap (plan 106), unlike the silent AI budget. */
  LIMIT_REACHED: {
    status: 429,
    title: 'Allowance used',
    client: 'show the allowance and when it resets (`resets_at`); do not retry before then',
  },
} as const satisfies Record<string, ErrorSpec>

export type ErrorCode = keyof typeof CATALOG

/** One view per column, so the three stay in step by construction. */
function view<T>(pick: (spec: ErrorSpec) => T): Record<ErrorCode, T> {
  return Object.fromEntries(
    Object.entries(CATALOG).map(([code, spec]) => [code, pick(spec)]),
  ) as Record<ErrorCode, T>
}

export const ERROR_CODES: Record<ErrorCode, number> = view((s) => s.status)

/** What the client is expected to do. Documented so the two sides can't drift. */
export const CLIENT_BEHAVIOUR: Record<ErrorCode, string> = view((s) => s.client)

const TITLES: Record<ErrorCode, string> = view((s) => s.title)

export interface ProblemDetails {
  type: string
  title: string
  status: number
  detail?: string
  code: ErrorCode
  [key: string]: unknown
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
  code: ErrorCode
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
 * body — where there is no `LoroError` to take a code from. The status carries the
 * meaning, and `title` is the framework's own message, which is safe: it describes the
 * request, not our internals.
 *
 * The slug stays `http` DELIBERATELY, even though `NOT_FOUND` is now a code in the
 * catalog: deriving it would emit `…/errors/not-found` and silently change a response a
 * client may already switch on. The `status` likewise comes from the exception, not from
 * the catalog — the framework is the authority on what it just raised.
 */
export function toHttpProblemDetails(status: number, title: string): ProblemDetails {
  return problem({
    slug: 'http',
    title,
    status,
    code: status === ERROR_CODES.NOT_FOUND ? 'NOT_FOUND' : 'INTERNAL',
  })
}

function kebab(code: string): string {
  return code.toLowerCase().replace(/_/g, '-')
}

/**
 * Rate-limit catalog. Auth IP (30/15m), email identity (5/15m), sync per-user
 * (120/min) and process-local TTS (100/500 per day) are deployed. Other rows,
 * including sync per-IP, stay documented defaults until a contract decision.
 */
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
