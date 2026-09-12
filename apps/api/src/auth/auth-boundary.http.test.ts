/** F-03: account isolation closes every AI spend route, not just /ai/scene. */
import { generateKeyPairSync } from 'node:crypto'
import type { INestApplication } from '@nestjs/common'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { ProblemSchema } from '@loro/core/api/current'
import { PROBLEM_MEDIA_TYPE } from '../common/errors.js'
import { createTestApp } from '../testing/create-test-app.js'

const key = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
  .privateKey.export({ type: 'pkcs8', format: 'pem' })
  .toString()

const isolated = {
  type: 'https://loro.app/errors/provider-unavailable',
  title: 'Upstream provider unavailable',
  status: 503,
  detail: 'This service is awaiting account isolation.',
  code: 'PROVIDER_UNAVAILABLE',
} as const

const suggestBody = {
  target_locale: 'es-ES',
  native_language: 'en',
  query: 'pharmacy',
}

describe('AI spend routes when the session engine is on', () => {
  let app: INestApplication
  let base: string

  beforeAll(async () => {
    vi.stubEnv('AUTH_PRIVATE_KEY_PEM', key)
    const started = await createTestApp()
    app = started.app
    base = started.base
  })

  afterAll(async () => {
    await app.close()
    vi.unstubAllEnvs()
  })

  const post = (path: string, body: unknown) =>
    fetch(`${base}/v1${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })

  it.each([
    ['/ai/scene', { theme: 'Hotel' }],
    ['/phrases/suggest', suggestBody],
  ] as const)('fails closed on %s with the same RFC 9457 problem', async (path, body) => {
    const response = await post(path, body)
    expect(response.status).toBe(503)
    expect(response.headers.get('content-type')).toContain(PROBLEM_MEDIA_TYPE)
    const problem = ProblemSchema.parse(await response.json())
    expect(problem).toMatchObject(isolated)
  })

  it('does not close health while AI spend is isolated', async () => {
    const response = await fetch(`${base}/v1/health`)
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ status: 'ok' })
  })
})
