import { Test } from '@nestjs/testing'
import type { INestApplication } from '@nestjs/common'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { newDb } from 'pg-mem'
import type { Pool } from 'pg'
import { AppModule } from '../app.module.js'
import { ProblemDetailsFilter } from '../common/problem-filter.js'
import { AUTH_RUNTIME } from './runtime.js'
import { AuthRepository } from './repository.js'
import { AuthService, hash, secret } from './service.js'
import type { AuthSettings } from './settings.js'
import { OAuthSessionSchema } from '@loro/core/api/oauth'
let app: INestApplication, base: string
beforeAll(async () => {
  const adapter = newDb().adapters.createPg()
  const repository = new AuthRepository(new (adapter.Pool as typeof Pool)())
  const settings: AuthSettings = {
    databaseUrl: '',
    publicUrl: 'https://api.example.com',
    redirects: ['loro://account'],
    signingKey: 'test-key-that-is-longer-than-32-bytes',
    googleClientId: 'google',
    googleClientSecret: 'secret',
    appleClientId: 'apple',
    appleTeamId: 'team',
    appleKeyId: 'key',
    applePrivateKey: 'test',
  }
  const auth = new AuthService(
    settings,
    repository,
    {
      authorizationUrl: (_, state) => `https://provider.example?state=${state}`,
      exchange: (provider) => Promise.resolve({ subject: 'person', provider }),
    },
    { now: () => 1_788_000_000_000 },
  )
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(AUTH_RUNTIME)
    .useValue(auth)
    .compile()
  app = module.createNestApplication()
  app.setGlobalPrefix('v1')
  app.useGlobalFilters(new ProblemDetailsFilter())
  await app.listen(0)
  base = await app.getUrl()
})
afterAll(async () => {
  await app.close()
})
const post = (path: string, body: unknown) =>
  fetch(`${base}/v1${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
it.each(['google', 'apple'])(
  'serves the complete %s sign-up/session/logout flow over HTTP',
  async (provider) => {
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
    const location = new URL(callback.headers.get('location') ?? '')
    const exchange = await post('/auth/exchange', {
      ticket: location.searchParams.get('ticket'),
      code_verifier: verifier,
    })
    expect(exchange.status).toBe(200)
    const session = OAuthSessionSchema.parse(await exchange.json())
    const me = await fetch(`${base}/v1/auth/me`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    expect(await me.json()).toEqual(session.user)
    const refresh = await post('/auth/refresh', { refresh_token: session.refresh_token })
    const next = OAuthSessionSchema.parse(await refresh.json())
    expect((await post('/auth/logout', { refresh_token: next.refresh_token })).status).toBe(204)
    expect((await post('/auth/refresh', { refresh_token: next.refresh_token })).status).toBe(401)
  },
)
it('fails invalid inputs and keeps legacy shared data routes inaccessible when accounts are enabled', async () => {
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
  expect((await post('/sync/pull', {})).status).toBe(503)
  expect((await post('/SYNC/pull', {})).status).toBe(503)
  expect((await post('/ai/scene', {})).status).toBe(503)
  expect((await fetch(`${base}/v1/content/manifest`)).status).toBe(200)
})
