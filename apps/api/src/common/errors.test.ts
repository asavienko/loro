import { describe, expect, it } from 'vitest'
import {
  CLIENT_BEHAVIOUR,
  ERROR_CODES,
  LoroError,
  RATE_LIMITS,
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
