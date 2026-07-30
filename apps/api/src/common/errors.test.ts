import { describe, expect, it } from 'vitest'
import {
  CLIENT_BEHAVIOUR,
  ERROR_CODES,
  LoroError,
  PROBLEM_MEDIA_TYPE,
  RATE_LIMITS,
  toHttpProblemDetails,
  toProblemDetails,
  type ErrorCode,
} from './errors.js'

describe('problem details', () => {
  it('emits the documented shape', () => {
    const p = toProblemDetails(new LoroError('SCHEMA_TOO_OLD', 'Sync requires app 1.4.0 or later.'))
    expect(p).toMatchObject({
      type: 'https://loro.app/errors/schema-too-old',
      title: 'Client schema version is no longer supported',
      status: 409,
      code: 'SCHEMA_TOO_OLD',
      detail: 'Sync requires app 1.4.0 or later.',
    })
  })

  it('carries extra fields the client needs', () => {
    const p = toProblemDetails(
      new LoroError('SCHEMA_TOO_OLD', undefined, { min_app_version: '1.4.0' }),
    )
    expect(p.min_app_version).toBe('1.4.0')
  })

  it('never leaks internals from an unknown error', () => {
    const p = toProblemDetails(new Error('SELECT * FROM users WHERE secret = ...'))
    expect(p.code).toBe('INTERNAL')
    expect(p.status).toBe(500)
    expect(JSON.stringify(p)).not.toContain('SELECT')
    expect(JSON.stringify(p)).not.toContain('secret')
  })

  it('leaks nothing from a thrown non-Error either', () => {
    const p = toProblemDetails({ password: 'hunter2' })
    expect(JSON.stringify(p)).not.toContain('hunter2')
  })

  it('maps every code to the documented status', () => {
    expect(ERROR_CODES.PLAN_REQUIRED).toBe(402)
    expect(ERROR_CODES.VALIDATION_FAILED).toBe(422)
    expect(ERROR_CODES.RATE_LIMITED).toBe(429)
    expect(ERROR_CODES.BUDGET_EXCEEDED).toBe(429)
    expect(ERROR_CODES.PROVIDER_UNAVAILABLE).toBe(503)
  })

  it('documents the client behaviour for every code', () => {
    for (const code of Object.keys(ERROR_CODES) as ErrorCode[]) {
      expect(CLIENT_BEHAVIOUR[code], code).toBeTruthy()
    }
  })

  it('keeps BUDGET_EXCEEDED silent for the learner', () => {
    // A "you've used your allowance" message turns a graceful degradation into a
    // visible failure. See ADR-0010.
    expect(CLIENT_BEHAVIOUR.BUDGET_EXCEEDED).toContain('SILENTLY')
  })

  it('never drops the outbox on an auth failure', () => {
    expect(CLIENT_BEHAVIOUR.UNAUTHENTICATED).toContain('NEVER drop the outbox')
  })

  it('emits the same member order for every code, extras last', () => {
    // The order is part of what a client diffing two responses sees, and it used to
    // depend on which of three hand-written object literals produced the body.
    const p = toProblemDetails(new LoroError('RATE_LIMITED', 'Slow down.', { retry_after: 30 }))
    expect(Object.keys(p)).toEqual(['type', 'title', 'status', 'code', 'detail', 'retry_after'])
  })

  it('omits `detail` when it would only repeat the title', () => {
    expect(toProblemDetails(new LoroError('RATE_LIMITED'))).not.toHaveProperty('detail')
  })
})

describe('a framework HTTP exception', () => {
  it('reports a routing 404 as NOT_FOUND', () => {
    // What a client gets for a mistyped path. `NOT_FOUND` is not a LoroError code, so
    // the shape is easy to get wrong in a fourth hand-written literal.
    expect(toHttpProblemDetails(404, 'Cannot GET /v1/nope')).toEqual({
      type: 'https://loro.app/errors/http',
      title: 'Cannot GET /v1/nope',
      status: 404,
      code: 'NOT_FOUND',
    })
  })

  it('reports anything else as INTERNAL, carrying the framework status', () => {
    expect(toHttpProblemDetails(413, 'Payload Too Large')).toMatchObject({
      status: 413,
      code: 'INTERNAL',
    })
  })

  it('serves problem bodies as problem+json', () => {
    expect(PROBLEM_MEDIA_TYPE).toBe('application/problem+json')
  })
})

describe('rate limits', () => {
  it('is strictest on auth and AI', () => {
    expect(RATE_LIMITS.auth.perUser).toBeLessThan(RATE_LIMITS.sync.perUser)
    expect(RATE_LIMITS.aiScene.perUser).toBeLessThan(RATE_LIMITS.content.perUser)
  })

  it('caps AI scenes daily as well as hourly', () => {
    expect(RATE_LIMITS.aiScene.perUserDaily).toBe(60)
  })

  it('gives sync generous headroom — a learner must never be throttled mid-session', () => {
    expect(RATE_LIMITS.sync.perUser).toBeGreaterThanOrEqual(120)
  })
})
