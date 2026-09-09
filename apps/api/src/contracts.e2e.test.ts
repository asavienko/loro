/** F-04: unchanged content/AI contracts plus the implemented authenticated target sync. */
import { Test } from '@nestjs/testing'
import type { ExecutionContext, INestApplication } from '@nestjs/common'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { currentOperations, ProblemSchema, ReadinessSchema } from '@loro/core/api/current'
import { targetOperations } from '@loro/core/api/target'
import { AppModule } from './app.module.js'
import { AuthGuard, type AuthenticatedRequest } from './auth/auth.guard.js'
import { ProblemDetailsFilter } from './common/problem-filter.js'
import { DATABASE } from './database/database.js'
import { InMemorySyncRepository } from './sync/sync.repository.memory.js'
import { SYNC_REPOSITORY } from './sync/sync.repository.js'
import { mergeAvailable } from './sync/merge.js'
import * as mergeModule from './sync/merge.js'

let app: INestApplication
let base: string
beforeAll(async () => {
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(SYNC_REPOSITORY)
    .useValue(new InMemorySyncRepository())
    .overrideProvider(DATABASE)
    .useValue({ ready: () => Promise.resolve(true) })
    .overrideGuard(AuthGuard)
    .useValue({
      canActivate(context: ExecutionContext) {
        const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
        request.principal = {
          userId: 'contract-learner',
          deviceId: 'contract-device',
          sessionId: 'contract-session',
        }
        return true
      },
    })
    .compile()
  app = module.createNestApplication()
  app.setGlobalPrefix('v1')
  app.useGlobalFilters(new ProblemDetailsFilter())
  await app.listen(0, '127.0.0.1')
  base = await app.getUrl()
})
afterAll(async () => {
  await app.close()
})

const rowId = '0197f2a0-0000-7000-8000-000000000001'
const headers = { 'content-type': 'application/json', 'x-loro-device': 'contract-device' }
const requests: Record<string, { suffix?: string; body?: unknown }> = {
  contentPack: { suffix: '?id=cafe' },
  learningContentPack: { suffix: '?id=cafe' },
  contentDiff: { suffix: '?from=0' },
  syncPush: {
    body: {
      client_hlc: '1000:0000:contract',
      ops: [
        {
          seq: 1,
          entity: 'user_phrase',
          entity_id: rowId,
          op: 'upsert',
          fields: {
            targetLocale: { v: 'es-ES', hlc: '1000:0000:contract' },
            source: { v: 'starter', hlc: '1000:0000:contract' },
            addedAt: { v: 1000, hlc: '1000:0000:contract' },
            phraseId: { v: 'cafe1', hlc: '1000:0000:contract' },
            reps: { v: 2, hlc: '1000:0000:contract' },
          },
        },
      ],
    },
  },
  syncPull: { body: { since: null, limit: 1 } },
  aiScene: { body: {} },
}
const unchanged = currentOperations.filter(
  (operation) =>
    ['health', 'readiness'].includes(operation.id) ||
    operation.id.startsWith('content') ||
    operation.id.startsWith('learningContent') ||
    operation.id.startsWith('ai'),
)
const migrated = targetOperations.filter((operation) =>
  ['syncPush', 'syncPull'].includes(operation.id),
)

describe('implemented HTTP contracts', () => {
  it('returns readiness checks JSON on a real 503 when WASM is unavailable', async () => {
    const unavailable = vi.spyOn(mergeModule, 'mergeAvailable').mockReturnValue(false)
    try {
      const response = await fetch(`${base}/v1/health/ready`)
      expect(response.status).toBe(503)
      expect(response.headers.get('content-type')).toContain('application/json')
      expect(ReadinessSchema.parse(await response.json())).toMatchObject({
        status: 'degraded',
        checks: { merge: 'unavailable' },
      })
    } finally {
      unavailable.mockRestore()
    }
  })

  it('requires real WASM for contract verification', () => {
    expect(mergeAvailable()).toBe(true)
  })

  for (const operation of [...unchanged, ...migrated]) {
    it(`${operation.method} ${operation.path}`, async () => {
      const request = requests[operation.id]
      const response = await fetch(`${base}/v1${operation.path}${request?.suffix ?? ''}`, {
        method: operation.method.toUpperCase(),
        ...(operation.method === 'post'
          ? { headers, body: JSON.stringify(request?.body ?? {}) }
          : {}),
      })
      const expectedStatus = operation.id.startsWith('sync')
        ? 200
        : operation.method === 'post'
          ? 201
          : 200
      expect(response.status).toBe(expectedStatus)
      const contract = operation.responses[response.status]
      expect(contract).toBeDefined()
      contract?.schema.parse(await response.json())
    })
  }

  it('keeps unknown-pack 422 and sync per-op partial rejection distinct', async () => {
    const missing = await fetch(`${base}/v1/content/pack?id=missing`)
    expect(missing.status).toBe(422)
    expect(ProblemSchema.parse(await missing.json()).code).toBe('VALIDATION_FAILED')
    const response = await fetch(`${base}/v1/sync/push`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        client_hlc: '1000:0000:contract',
        ops: [
          { seq: 2, entity: 'unknown', entity_id: rowId, op: 'upsert' },
          {
            seq: 3,
            entity: 'user_phrase',
            entity_id: rowId,
            op: 'upsert',
            fields: { bad: { v: 1, hlc: '1000:0000:contract' } },
          },
          { seq: 4, entity: 'user_phrase', entity_id: rowId, op: 'delete', deleted_at: 2000 },
        ],
      }),
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      accepted: [4],
      rejected: [
        { seq: 2, index: 0, code: 'VALIDATION_FAILED' },
        { seq: 3, index: 1, code: 'VALIDATION_FAILED' },
      ],
    })
  })

  it('rejects a device header inconsistent with the authenticated session', async () => {
    const response = await fetch(`${base}/v1/sync/pull`, {
      method: 'POST',
      headers: { ...headers, 'x-loro-device': 'other-device' },
      body: JSON.stringify({ since: null }),
    })
    expect(response.status).toBe(403)
    expect(ProblemSchema.parse(await response.json()).code).toBe('FORBIDDEN')
  })

  it('documents framework malformed JSON and missing-route problems', async () => {
    const malformed = await fetch(`${base}/v1/sync/push`, { method: 'POST', headers, body: '{' })
    expect(malformed.status).toBe(400)
    expect(ProblemSchema.parse(await malformed.json()).code).toBe('INTERNAL')
    const missing = await fetch(`${base}/v1/missing`)
    expect(missing.status).toBe(404)
    expect(ProblemSchema.parse(await missing.json()).code).toBe('NOT_FOUND')
  })
})

describe('F-04 malformed multilingual catalog HTTP queries', () => {
  it.each([
    'manifest?target=bg-BG&native=bg',
    'manifest?target=es-ES&target=bg-BG',
    'manifest?native=fr',
    'diff?from=1&from=2',
    'diff?from=9007199254740992',
    'diff?from=1e2',
    'pack',
    'pack?id=cafe&id=cafe',
    'pack?id=missing',
  ])('returns a validation problem for %s', async (query) => {
    const response = await fetch(`${base}/v1/content/v2/${query}`)
    expect(response.status).toBe(422)
    expect(response.headers.get('content-type')).toContain('application/problem+json')
    expect(ProblemSchema.parse(await response.json()).code).toBe('VALIDATION_FAILED')
  })
})
