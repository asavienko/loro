import { Test } from '@nestjs/testing'
import type { INestApplication } from '@nestjs/common'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { LoroError } from '../common/errors.js'
import { ProblemDetailsFilter } from '../common/problem-filter.js'
import { AuthController, MeController } from './auth.controller.js'
import { AuthGuard } from './auth.guard.js'
import { AuthService } from './auth.service.js'

const principal = { userId: 'account-a', deviceId: 'device-a', sessionId: 'session-a' }
const auth = {
  capabilities: () => ({ google: false, apple: false, email: true }),
  authenticate: vi.fn((token: string) => {
    if (token !== 'valid-access') return Promise.reject(new LoroError('UNAUTHENTICATED'))
    return Promise.resolve(principal)
  }),
  requestCode: vi.fn(() => Promise.resolve({ status: 'accepted' as const })),
  verifyCode: vi.fn(() => Promise.resolve({ verified: true })),
  signIn: vi.fn(),
  claim: vi.fn(() =>
    Promise.resolve({ performed: false, mode: null, claim_id: 'claim-a', upload_required: true }),
  ),
  logout: vi.fn(() => Promise.resolve()),
  me: vi.fn(() =>
    Promise.resolve({ user: { id: 'account-a', created_at: 1 }, device_id: 'device-a' }),
  ),
}
const rowId = '0197f2a0-0000-7000-8000-000000000001'
const headers = { 'Content-Type': 'application/json' }
let app: INestApplication
let base: string

beforeAll(async () => {
  const module = await Test.createTestingModule({
    controllers: [AuthController, MeController],
    providers: [AuthGuard, { provide: AuthService, useValue: auth }],
  }).compile()
  app = module.createNestApplication()
  app.setGlobalPrefix('v1')
  app.useGlobalFilters(new ProblemDetailsFilter())
  await app.listen(0, '127.0.0.1')
  base = `${await app.getUrl()}/v1`
})
beforeEach(() => {
  vi.clearAllMocks()
})
afterAll(async () => {
  await app.close()
})

describe('authentication HTTP boundaries', () => {
  it('rejects missing bearer proof before consulting sessions', async () => {
    const response = await fetch(`${base}/me`)
    expect(response.status).toBe(401)
    expect(await response.json()).toMatchObject({ code: 'UNAUTHENTICATED' })
    expect(auth.authenticate).not.toHaveBeenCalled()
  })

  it('rejects a device header belonging to another installation', async () => {
    const response = await fetch(`${base}/me`, {
      headers: { Authorization: 'Bearer valid-access', 'X-Loro-Device': 'device-b' },
    })
    expect(response.status).toBe(403)
    expect(auth.me).not.toHaveBeenCalled()
  })

  it('returns the verified principal and excludes account responses from caches', async () => {
    const response = await fetch(`${base}/me`, {
      headers: { Authorization: 'Bearer valid-access' },
    })
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(auth.me).toHaveBeenCalledWith(principal)
  })

  it('validates email and anonymous IDs through the shared schemas', async () => {
    const badEmail = await fetch(`${base}/auth/magic-link`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ email: 'invalid' }),
    })
    expect(badEmail.status).toBe(422)
    expect(auth.requestCode).not.toHaveBeenCalled()
    const invalidIdentity = await fetch(`${base}/auth/google`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        identity_token: 'proof',
        anon_id: 'f14450ac-9022-4a1f-99b8-551b4fcc1c8a',
        device: { installation_id: rowId, platform: 'web', app_version: '1.0.0' },
      }),
    })
    expect(invalidIdentity.status).toBe(422)
    expect(auth.signIn).not.toHaveBeenCalled()
  })

  it('uses the transport peer for rate limiting and the canonical email verification path', async () => {
    const response = await fetch(`${base}/auth/magic-link`, {
      method: 'POST',
      headers: { ...headers, 'X-Forwarded-For': 'attacker-selected-address' },
      body: JSON.stringify({ email: 'learner@example.test' }),
    })
    expect(response.status).toBe(202)
    expect(auth.requestCode).toHaveBeenCalledWith('learner@example.test', '127.0.0.1')
    const verified = await fetch(`${base}/auth/magic-link/verify`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email: 'learner@example.test',
        code: '123456',
        anon_id: rowId,
        device: { installation_id: rowId, platform: 'web', app_version: '1.0.0' },
      }),
    })
    expect(verified.status).toBe(200)
    expect(auth.verifyCode).toHaveBeenCalledOnce()
  })

  it('requires matching claim device and request headers, and revokes the verified session on logout', async () => {
    const body = JSON.stringify({ anon_id: rowId, device_id: 'device-a', request_id: rowId })
    const authorization = {
      ...headers,
      Authorization: 'Bearer valid-access',
      'X-Loro-Device': 'device-a',
    }
    const missingKey = await fetch(`${base}/auth/claim`, {
      method: 'POST',
      headers: authorization,
      body,
    })
    expect(missingKey.status).toBe(422)
    expect(auth.claim).not.toHaveBeenCalled()
    const valid = await fetch(`${base}/auth/claim`, {
      method: 'POST',
      headers: { ...authorization, 'Idempotency-Key': rowId },
      body,
    })
    expect(valid.status).toBe(200)
    expect(auth.claim).toHaveBeenCalledWith(principal, {
      anon_id: rowId,
      device_id: 'device-a',
      request_id: rowId,
    })
    const logout = await fetch(`${base}/auth/logout`, { method: 'POST', headers: authorization })
    expect(logout.status).toBe(204)
    expect(auth.logout).toHaveBeenCalledWith(principal)
  })
})
