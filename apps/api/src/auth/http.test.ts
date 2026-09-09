/** F-01/F-02/F-04: real HTTP OAuth and shared bearer-authenticated PostgreSQL sync. */
import { generateKeyPairSync, randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { Test } from '@nestjs/testing'
import type { INestApplication } from '@nestjs/common'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import {
  PullResponseSchema,
  PushResponseSchema,
  SignInResponseSchema,
  TokenResponseSchema,
  type DeviceRegistration,
  type SignInResponse,
} from '@loro/core/api/target'
import type { OAuthProvider } from '@loro/core/api/oauth'
import { AppModule } from '../app.module.js'
import { SERVER_CLOCK } from '../common/clock.js'
import { ProblemDetailsFilter } from '../common/problem-filter.js'
import { DATABASE, PostgresDatabase } from '../database/database.js'
import { AuthService } from './auth.service.js'
import { AUTH_RUNTIME } from './runtime.js'
import { OAuthFlowService, hash, secret } from './oauth-flow.service.js'
import type { AuthSettings } from './settings.js'

const testUrl = process.env['LORO_TEST_DATABASE_URL']
const now = 1_800_000_000_000
const key = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
  .privateKey.export({ type: 'pkcs8', format: 'pem' })
  .toString()
const id = (n: number) => `0197f2a0-0000-7000-8000-${String(n).padStart(12, '0')}`
const device: DeviceRegistration = {
  installation_id: id(1),
  platform: 'web',
  app_version: '1.0.0+1',
}
const fields = {
  targetLocale: { v: 'es-ES', hlc: `${now}:0000:browser` },
  phraseId: { v: 'cafe1', hlc: `${now}:0000:browser` },
  source: { v: 'starter', hlc: `${now}:0000:browser` },
  addedAt: { v: now, hlc: `${now}:0000:browser` },
  reps: { v: 4, hlc: `${now}:0000:browser` },
}

describe.skipIf(!testUrl)('browser OAuth HTTP flow with shared durable sync', () => {
  let admin: Pool
  let app: INestApplication
  let auth: AuthService
  let base: string
  const schema = `oauth_http_${randomUUID().replaceAll('-', '')}`

  beforeAll(async () => {
    admin = new Pool({ connectionString: testUrl })
    await admin.query(`CREATE SCHEMA ${schema}`)
    const url = new URL(testUrl!)
    url.searchParams.set('options', `-csearch_path=${schema}`)
    vi.stubEnv('DATABASE_URL', url.toString())
    vi.stubEnv('AUTH_ENABLED', 'true')
    vi.stubEnv('AUTH_PRIVATE_KEY_PEM', key)
    vi.stubEnv('AUTH_ISSUER', 'https://api.example.test')
    const settings: AuthSettings = {
      databaseUrl: url.toString(),
      publicUrl: 'https://api.example.test',
      redirects: ['loro://account'],
      signingKey: 'test-key-that-is-longer-than-32-bytes',
      googleClientId: 'google',
      googleClientSecret: 'secret',
      appleClientId: 'apple',
      appleTeamId: 'team',
      appleKeyId: 'key',
      applePrivateKey: 'test',
    }
    const database = new PostgresDatabase()
    auth = new AuthService(database, { now: () => now })
    const flow = new OAuthFlowService(
      settings,
      database,
      {
        authorizationUrl: (provider, state) =>
          `https://provider.example/${provider}?state=${state}`,
        exchange: (provider) => Promise.resolve({ subject: 'person', provider }),
      },
      auth,
      { now: () => now },
    )
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DATABASE)
      .useValue(database)
      .overrideProvider(AuthService)
      .useValue(auth)
      .overrideProvider(SERVER_CLOCK)
      .useValue({ now: () => now })
      .overrideProvider(AUTH_RUNTIME)
      .useValue(flow)
      .compile()
    app = module.createNestApplication()
    app.setGlobalPrefix('v1')
    app.useGlobalFilters(new ProblemDetailsFilter())
    await app.listen(0, '127.0.0.1')
    base = await app.getUrl()
  })
  afterAll(async () => {
    await app.close()
    await admin.query(`DROP SCHEMA ${schema} CASCADE`)
    await admin.end()
    vi.unstubAllEnvs()
  })

  const post = (
    path: string,
    body: unknown,
    session?: Pick<SignInResponse, 'access_token' | 'device_id'>,
  ) =>
    fetch(`${base}/v1${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session
          ? { Authorization: `Bearer ${session.access_token}`, 'X-Loro-Device': session.device_id }
          : {}),
      },
      body: JSON.stringify(body),
    })
  async function handoff(provider: OAuthProvider) {
    const verifier = secret()
    const start = await post(`/auth/${provider}/start`, {
      redirect_uri: 'loro://account',
      code_challenge: hash(verifier),
    })
    expect(start.status).toBe(200)
    expect(start.headers.get('cache-control')).toBe('no-store')
    const started = (await start.json()) as { state: string }
    const params = new URLSearchParams({ state: started.state, code: 'provider-code' })
    const callback = await fetch(
      `${base}/v1/auth/${provider}/callback${provider === 'google' ? '?' + params.toString() : ''}`,
      {
        redirect: 'manual',
        ...(provider === 'apple'
          ? {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: params,
            }
          : {}),
      },
    )
    expect(callback.status).toBe(303)
    expect(callback.headers.get('cache-control')).toBe('no-store')
    expect(callback.headers.get('referrer-policy')).toBe('no-referrer')
    const location = new URL(callback.headers.get('location') ?? '')
    expect(`${location.protocol}//${location.host}${location.pathname}`).toBe('loro://account')
    expect(location.searchParams.get('state')).toBe(started.state)
    return {
      ticket: location.searchParams.get('ticket'),
      code_verifier: verifier,
      device,
      anon_id: id(2),
    }
  }

  it('lists configured browser providers without exposing configuration', async () => {
    const response = await fetch(`${base}/v1/auth/providers`)
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toEqual({ providers: ['google', 'apple'] })
  })

  it.each(['google', 'apple'] as const)(
    'uses %s callback, unified sign-in, sync, refresh and logout over HTTP',
    async (provider) => {
      const input = await handoff(provider)
      const exchange = await post('/auth/exchange', input)
      expect(exchange.status).toBe(200)
      expect(exchange.headers.get('cache-control')).toBe('no-store')
      const session = SignInResponseSchema.parse(await exchange.json())
      expect(await auth.authenticate(session.access_token)).toMatchObject({
        userId: session.user.id,
        deviceId: session.device_id,
      })
      const me = await fetch(`${base}/v1/auth/me`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      expect(me.status).toBe(200)
      expect(await me.json()).toEqual(session.user)
      const sharedMe = await fetch(`${base}/v1/me`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      expect(await sharedMe.json()).toEqual({ user: session.user, device_id: session.device_id })
      expect((await post('/auth/exchange', input)).status).toBe(401)
      const initial = await post('/sync/pull', { since: null }, session)
      expect(initial.status).toBe(200)
      expect(PullResponseSchema.parse(await initial.json()).changes).toEqual([])
      const push = await post(
        '/sync/push',
        {
          client_hlc: `${now}:0000:browser`,
          ops: [{ seq: 1, entity: 'user_phrase', entity_id: id(3), op: 'upsert', fields }],
        },
        session,
      )
      expect(push.status).toBe(200)
      expect(PushResponseSchema.parse(await push.json()).accepted).toEqual([1])
      const pull = await post('/sync/pull', { since: null }, session)
      expect(pull.status).toBe(200)
      expect(PullResponseSchema.parse(await pull.json()).changes).toMatchObject([
        { entity_id: id(3), fields: { reps: { v: 4 } } },
      ])
      expect(
        (await post('/sync/pull', { since: null }, { ...session, device_id: id(99) })).status,
      ).toBe(403)
      const refresh = await post('/auth/refresh', { refresh_token: session.refresh_token })
      expect(refresh.status).toBe(200)
      const next = TokenResponseSchema.parse(await refresh.json())
      const rotated = { ...session, ...next }
      expect((await post('/sync/pull', { since: null }, rotated)).status).toBe(200)
      expect((await post('/auth/logout', { refresh_token: next.refresh_token })).status).toBe(204)
      expect((await post('/sync/pull', { since: null }, rotated)).status).toBe(401)
      expect((await post('/auth/refresh', { refresh_token: next.refresh_token })).status).toBe(401)
    },
  )

  it('rejects malformed inputs and anonymous access while keeping public content available', async () => {
    expect(
      (
        await post('/auth/google/start', {
          redirect_uri: 'https://evil.example',
          code_challenge: secret(),
        })
      ).status,
    ).toBe(422)
    expect((await post('/auth/exchange', { ticket: 'x', code_verifier: 'bad' })).status).toBe(422)
    expect((await fetch(`${base}/v1/auth/me`)).status).toBe(401)
    expect((await post('/sync/pull', { since: null })).status).toBe(401)
    expect((await post('/SYNC/pull', { since: null })).status).toBe(401)
    expect((await fetch(`${base}/v1/content/manifest`)).status).toBe(200)
    const input = await handoff('google')
    expect(
      (await post('/auth/exchange', { ticket: input.ticket, code_verifier: input.code_verifier }))
        .status,
    ).toBe(422)
    expect((await post('/auth/exchange', input)).status).toBe(200)
  })
})
