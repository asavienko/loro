/** F-04: exercise authenticated sync through the real HTTP routing and Rust merge. */
import { Test } from '@nestjs/testing'
import type { ExecutionContext, INestApplication } from '@nestjs/common'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PullResponseSchema, PushResponseSchema } from '@loro/core/api/target'
import { AppModule } from '../app.module.js'
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard.js'
import { ProblemDetailsFilter } from '../common/problem-filter.js'
import { DATABASE } from '../database/database.js'
import { mergeAvailable } from './merge.js'
import { InMemorySyncRepository } from './testing/sync.repository.memory.js'
import { SYNC_REPOSITORY } from './sync.repository.js'

const id = (n: number) => `0197f2a0-0000-7000-8000-${String(n).padStart(12, '0')}`
const value = <T>(v: T, at = 1000) => ({ v, hlc: `${at}:0000:device-a` })
const envelope = (ops: unknown[]) => ({ client_hlc: '1000:0000:device-a', ops })
const needsWasm = it.skipIf(!mergeAvailable())

describe('the API over HTTP', () => {
  let app: INestApplication
  let unauthed: INestApplication
  let base: string
  let unauthBase: string

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SYNC_REPOSITORY)
      .useValue(new InMemorySyncRepository())
      .overrideProvider(DATABASE)
      .useValue({ ready: () => Promise.resolve(true) })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
          request.principal = {
            userId: 'http-learner',
            deviceId: 'http-device',
            sessionId: 'http-session',
          }
          return true
        },
      })
      .compile()
    app = moduleRef.createNestApplication()
    app.setGlobalPrefix('v1')
    app.useGlobalFilters(new ProblemDetailsFilter())
    await app.listen(0, '127.0.0.1')
    base = await app.getUrl()

    const actual = await Test.createTestingModule({ imports: [AppModule] }).compile()
    unauthed = actual.createNestApplication()
    unauthed.setGlobalPrefix('v1')
    unauthed.useGlobalFilters(new ProblemDetailsFilter())
    await unauthed.listen(0, '127.0.0.1')
    unauthBase = await unauthed.getUrl()
  })

  afterAll(async () => {
    await Promise.all([app.close(), unauthed.close()])
  })

  const post = (path: string, body: unknown) =>
    fetch(`${base}/v1${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-loro-device': 'http-device' },
      body: JSON.stringify(body),
    })

  it('requires authentication for every sync route', async () => {
    for (const route of ['push', 'pull', 'status']) {
      const response = await fetch(`${unauthBase}/v1/sync/${route}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      })
      expect(response.status).toBe(401)
      expect(await response.json()).toMatchObject({ code: 'UNAUTHENTICATED' })
    }
  })

  it('serves public liveness and observes real merge readiness', async () => {
    const live = await fetch(`${base}/v1/health`)
    expect(live.status).toBe(200)
    expect(await live.json()).toMatchObject({ status: 'ok' })
    const ready = await fetch(`${base}/v1/health/ready`)
    expect(ready.status).toBe(mergeAvailable() ? 200 : 503)
    expect(await ready.json()).toMatchObject({
      checks: { merge: mergeAvailable() ? 'ok' : 'unavailable', database: 'ok' },
    })
  })

  it('serves the content manifest with real counts', async () => {
    const res = await fetch(`${base}/v1/content/manifest`)
    const body = (await res.json()) as { phrase_count: number; lang: string; packs: unknown[] }
    expect(body.lang).toBe('es-ES')
    expect(body.phrase_count).toBeGreaterThanOrEqual(31)
    expect(body.packs.length).toBeGreaterThan(0)
  })

  needsWasm(
    'uses 200 target responses and serialised HLCs while preserving max/LWW merging',
    async () => {
      const first = await post(
        '/sync/push',
        envelope([
          {
            seq: 1,
            entity: 'user_phrase',
            entity_id: id(1),
            op: 'upsert',
            fields: {
              targetLocale: value('es-ES'),
              source: value('starter'),
              addedAt: value(1000),
              phraseId: value(null),
              ownEs: value('Un café'),
              reps: value(20),
              difficulty: value('hard'),
            },
          },
        ]),
      )
      expect(first.status).toBe(200)
      expect(PushResponseSchema.parse(await first.json()).accepted).toEqual([1])
      const second = await post(
        '/sync/push',
        envelope([
          {
            seq: 2,
            entity: 'user_phrase',
            entity_id: id(1),
            op: 'upsert',
            fields: { reps: value(18, 9999), difficulty: value('easy', 9999) },
          },
        ]),
      )
      expect(second.status).toBe(200)
      expect(PushResponseSchema.parse(await second.json()).accepted).toEqual([2])
      const pull = await post('/sync/pull', { since: null, limit: 500 })
      expect(pull.status).toBe(200)
      const pulled = PullResponseSchema.parse(await pull.json())
      const row = [...pulled.changes].reverse().find((change) => change.entity_id === id(1))
      expect(row).toMatchObject({
        fields: { reps: { v: 20 }, difficulty: { v: 'easy', hlc: '9999:0000:device-a' } },
      })
    },
  )

  needsWasm(
    'returns per-index partial rejections for invalid fields and unknown entities',
    async () => {
      const result = await post(
        '/sync/push',
        envelope([
          {
            seq: 9,
            entity: 'user_phrase',
            entity_id: id(9),
            op: 'upsert',
            fields: { rawAudio: value('forbidden') },
          },
          { seq: 10, entity: 'unknown', entity_id: id(10), op: 'upsert', fields: {} },
          {
            seq: 11,
            entity: 'streak_day',
            entity_id: '2026-09-08',
            op: 'upsert',
            fields: { practised: value(true) },
          },
        ]),
      )
      expect(result.status).toBe(200)
      expect(PushResponseSchema.parse(await result.json())).toMatchObject({
        accepted: [11],
        rejected: [
          { seq: 9, index: 0, code: 'VALIDATION_FAILED' },
          { seq: 10, index: 1, code: 'VALIDATION_FAILED' },
        ],
      })
    },
  )

  it('returns 422 for an invalid envelope and a legacy HLC-object payload', async () => {
    for (const body of [
      { ops: [] },
      { client_hlc: { physical: 1, logical: 0, node_id: 'a' }, ops: [] },
    ]) {
      const res = await post('/sync/push', body)
      expect(res.status).toBe(422)
      expect(await res.json()).toMatchObject({ code: 'VALIDATION_FAILED' })
    }
  })

  it('returns problem details without leaking internals', async () => {
    const res = await fetch(`${base}/v1/content/diff?from=banana`)
    expect(res.status).toBe(422)
    const body = (await res.json()) as Record<string, unknown>
    expect(body['code']).toBe('VALIDATION_FAILED')
    expect(body).not.toHaveProperty('stack')
  })

  it('serves a valid bundled roleplay scene', async () => {
    const response = await post('/ai/scene', { theme: 'Hotel' })
    const result = (await response.json()) as {
      scene: { turns: { options: { best?: boolean; tip: string }[] }[] }
    }
    expect(result.scene.turns.length).toBeGreaterThanOrEqual(3)
    for (const turn of result.scene.turns) {
      expect(turn.options).toHaveLength(3)
      expect(turn.options.filter((option) => option.best === true)).toHaveLength(1)
      for (const option of turn.options) expect(option.tip.length).toBeGreaterThan(10)
    }
  })
})
