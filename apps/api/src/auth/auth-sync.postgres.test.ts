/** F-01/F-04: real sign-in, bearer guard and cross-device sync in one HTTP journey. */
import { generateKeyPairSync, randomUUID } from 'node:crypto'
import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import {
  PullResponseSchema,
  PushResponseSchema,
  SignInResponseSchema,
  type SignInResponse,
} from '@loro/core/api/target'
import { AppModule } from '../app.module.js'
import { ProblemDetailsFilter } from '../common/problem-filter.js'
import { mergeAvailable } from '../sync/merge.js'

const databaseUrl = process.env['LORO_TEST_DATABASE_URL']
const rowId = (n: number) => `0197f2a0-0000-7000-8000-${String(n).padStart(12, '0')}`
const deliveryUrl = 'https://auth-sync-delivery.example.test/send'

describe.skipIf(!databaseUrl)('signed-in cross-device sync with real PostgreSQL and HTTP', () => {
  const schema = `auth_sync_test_${randomUUID().replaceAll('-', '')}`
  const deliveries = new Map<string, string>()
  let admin: Pool | undefined
  let app: INestApplication | undefined
  let base: string
  let schemaCreated = false

  beforeAll(async () => {
    admin = new Pool({ connectionString: databaseUrl })
    // Only a locally generated hexadecimal identifier enters this SQL string.
    await admin.query(`CREATE SCHEMA ${schema}`)
    schemaCreated = true
    const scopedUrl = new URL(databaseUrl!)
    scopedUrl.searchParams.set('options', `-csearch_path=${schema}`)
    vi.stubEnv('DATABASE_URL', scopedUrl.toString())
    vi.stubEnv(
      'AUTH_PRIVATE_KEY_PEM',
      generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
        .privateKey.export({ type: 'pkcs8', format: 'pem' })
        .toString(),
    )
    vi.stubEnv('AUTH_EMAIL_HASH_KEY', 'auth-sync-integration-test-secret-at-least-32-characters')
    vi.stubEnv('AUTH_MAGIC_DELIVERY_URL', deliveryUrl)
    vi.stubEnv('AUTH_MAGIC_DELIVERY_TOKEN', 'integration-delivery-only')

    const originalFetch = globalThis.fetch
    const deliverOrFetch: typeof fetch = (input, options) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      // Only the external delivery service is stubbed. Every localhost request
      // traverses the actual HTTP server, controllers, guard, services and SQL.
      if (url !== deliveryUrl) return originalFetch(input, options)
      if (typeof options?.body !== 'string') throw new Error('Expected JSON delivery body')
      const body: unknown = JSON.parse(options.body)
      if (
        !body ||
        typeof body !== 'object' ||
        !('email' in body) ||
        typeof body.email !== 'string' ||
        !('code' in body) ||
        typeof body.code !== 'string'
      )
        throw new Error('Invalid delivery body')
      deliveries.set(body.email, body.code)
      return Promise.resolve(new Response(null, { status: 202 }))
    }
    vi.stubGlobal('fetch', deliverOrFetch)

    // No provider or guard overrides: this is the production composition root.
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = module.createNestApplication()
    app.setGlobalPrefix('v1')
    app.useGlobalFilters(new ProblemDetailsFilter())
    await app.listen(0, '127.0.0.1')
    base = `${await app.getUrl()}/v1`
  }, 20_000)

  afterAll(async () => {
    await app?.close()
    if (schemaCreated) await admin?.query(`DROP SCHEMA ${schema} CASCADE`)
    await admin?.end()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  function post(path: string, body: unknown, session?: SignInResponse): Promise<Response> {
    return fetch(`${base}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Loro-App': '1.0.0+1',
        ...(session
          ? { Authorization: `Bearer ${session.access_token}`, 'X-Loro-Device': session.device_id }
          : {}),
      },
      body: JSON.stringify(body),
    })
  }

  async function signIn(email: string, deviceNumber: number): Promise<SignInResponse> {
    const requested = await post('/auth/magic-link', { email })
    expect(requested.status).toBe(202)
    expect(await requested.json()).toEqual({ status: 'accepted' })
    const verified = await post('/auth/magic-link/verify', {
      email,
      code: deliveries.get(email),
      anon_id: rowId(deviceNumber + 100),
      device: { installation_id: rowId(deviceNumber), platform: 'web', app_version: '1.0.0+1' },
    })
    expect(verified.status).toBe(200)
    return SignInResponseSchema.parse(await verified.json())
  }

  it('signs in two devices, syncs real progress only within their account, and rejects a logged-out token', async () => {
    expect(mergeAvailable()).toBe(true)
    const ready = await fetch(`${base}/health/ready`)
    expect(ready.status).toBe(200)
    expect(await ready.json()).toMatchObject({ checks: { database: 'ok', merge: 'ok' } })

    const email = `${randomUUID()}@example.test`
    const first = await signIn(email, 1)
    const field = <T>(v: T) => ({ v, hlc: '1000:0000:device-a' })
    const pushed = await post(
      '/sync/push',
      {
        client_hlc: '1000:0000:device-a',
        ops: [
          {
            seq: 1,
            entity: 'user_phrase',
            entity_id: rowId(10),
            op: 'upsert',
            fields: {
              targetLocale: field('es-ES'),
              phraseId: field('cafe1'),
              source: field('starter'),
              addedAt: field(1000),
              reps: field(7),
              loved: field(true),
            },
          },
        ],
      },
      first,
    )
    expect(pushed.status).toBe(200)
    expect(PushResponseSchema.parse(await pushed.json())).toMatchObject({
      accepted: [1],
      rejected: [],
    })

    const second = await signIn(email, 2)
    expect(second.user.id).toBe(first.user.id)
    expect(second.device_id).not.toBe(first.device_id)
    const pulled = await post('/sync/pull', { since: null }, second)
    expect(pulled.status).toBe(200)
    expect(PullResponseSchema.parse(await pulled.json()).changes).toEqual([
      expect.objectContaining({
        entity: 'user_phrase',
        entity_id: rowId(10),
        fields: expect.objectContaining({
          reps: expect.objectContaining({ v: 7 }),
          loved: expect.objectContaining({ v: true }),
        }),
      }),
    ])

    const foreign = await signIn(`${randomUUID()}@example.test`, 3)
    expect(foreign.user.id).not.toBe(first.user.id)
    const foreignPull = await post('/sync/pull', { since: null }, foreign)
    expect(foreignPull.status).toBe(200)
    expect(PullResponseSchema.parse(await foreignPull.json()).changes).toEqual([])

    const signedOut = await post('/auth/logout', {}, first)
    expect(signedOut.status).toBe(204)
    const rejected = await post('/sync/pull', { since: null }, first)
    expect(rejected.status).toBe(401)
    expect(await rejected.json()).toMatchObject({ code: 'UNAUTHENTICATED' })
  }, 20_000)
})
