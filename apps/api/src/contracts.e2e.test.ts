/** F-04: exercise the observed API, without installing target validation middleware. */
import { Test } from '@nestjs/testing'
import type { INestApplication } from '@nestjs/common'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { currentOperations, ProblemSchema, ReadinessSchema } from '@loro/core/api/current'
import { AppModule } from './app.module.js'
import { ProblemDetailsFilter } from './common/problem-filter.js'
import { mergeAvailable } from './sync/merge.js'
import * as mergeModule from './sync/merge.js'

let app: INestApplication
let base: string
beforeAll(async () => {
  const module = await Test.createTestingModule({ imports: [AppModule] }).compile()
  app = module.createNestApplication()
  app.setGlobalPrefix('v1')
  app.useGlobalFilters(new ProblemDetailsFilter())
  await app.init()
  await app.listen(0)
  base = await app.getUrl()
})
afterAll(async () => {
  await app.close()
})

const requests: Record<string, { suffix?: string; body?: unknown }> = {
  contentPack: { suffix: '?id=cafe' },
  contentDiff: { suffix: '?from=0' },
  syncPush: {
    body: {
      ops: [
        {
          seq: 1,
          entity: 'user_phrase',
          entity_id: 'contract-row',
          op: 'upsert',
          fields: { reps: { v: 2, hlc: { physical: 1, logical: 0, node_id: 'contract' } } },
        },
      ],
    },
  },
  syncPull: { body: { since: 'ignored', limit: 1 } },
  syncStatus: { body: {} },
  aiScene: { body: {} },
}
describe('current HTTP contracts', () => {
  it('returns the readiness checks body on a real HTTP 503 when WASM is unavailable', async () => {
    const unavailable = vi.spyOn(mergeModule, 'mergeAvailable').mockReturnValue(false)
    try {
      const res = await fetch(`${base}/v1/health/ready`)
      expect(res.status).toBe(503)
      expect(res.headers.get('content-type')).toContain('application/json')
      expect(ReadinessSchema.parse(await res.json())).toMatchObject({
        status: 'degraded',
        checks: { merge: 'unavailable' },
      })
    } finally {
      unavailable.mockRestore()
    }
  })

  it('requires the real WASM for contract verification', () => {
    expect(mergeAvailable()).toBe(true)
  })
  // Configured auth routes have their own HTTP suite with a verified identity-provider seam.
  for (const operation of currentOperations.filter((operation) => !operation.id.startsWith('oauth'))) {
    it(`${operation.method} ${operation.path}`, async () => {
      const req = requests[operation.id]
      const res = await fetch(`${base}/v1${operation.path}${req?.suffix ?? ''}`, {
        method: operation.method.toUpperCase(),
        ...(operation.method === 'post'
          ? {
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(req?.body ?? {}),
            }
          : {}),
      })
      const status = operation.method === 'post' ? 201 : 200
      expect(res.status).toBe(status)
      const response = operation.responses[res.status]
      expect(response).toBeDefined()
      response?.schema.parse(await res.json())
    })
  }
  it('keeps unknown-pack 422 and per-op partial rejection distinct', async () => {
    const missing = await fetch(`${base}/v1/content/pack?id=missing`)
    expect(missing.status).toBe(422)
    expect(ProblemSchema.parse(await missing.json()).code).toBe('VALIDATION_FAILED')
    const res = await fetch(`${base}/v1/sync/push`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ops: [
          { seq: 2, entity: 'unknown', entity_id: 'x', op: 'upsert' },
          {
            seq: 3,
            entity: 'user_phrase',
            entity_id: 'x',
            op: 'upsert',
            fields: { bad: { v: 1, hlc: { physical: 1, logical: 0, node_id: 'contract' } } },
          },
          { seq: 4, entity: 'user_phrase', entity_id: 'contract-row', op: 'delete', deleted_at: 2 },
        ],
      }),
    })
    expect(res.status).toBe(201)
    expect(await res.json()).toMatchObject({
      accepted: [4],
      rejected: [
        { seq: 2, code: 'schema_unknown' },
        { seq: 3, code: 'VALIDATION_FAILED', field: 'bad' },
      ],
    })
  })
  it('documents framework malformed JSON and missing-route problems', async () => {
    const malformed = await fetch(`${base}/v1/sync/push`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{',
    })
    expect(malformed.status).toBe(400)
    expect(ProblemSchema.parse(await malformed.json()).code).toBe('INTERNAL')
    const missing = await fetch(`${base}/v1/missing`)
    expect(missing.status).toBe(404)
    expect(ProblemSchema.parse(await missing.json()).code).toBe('NOT_FOUND')
  })
})
