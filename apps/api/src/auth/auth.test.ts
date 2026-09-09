/** F-01/F-02/F-04: browser OAuth handoff uses the durable shared account/session engine. */
import { generateKeyPairSync } from 'node:crypto'
import type { Pool } from 'pg'
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { SignInResponseSchema, type DeviceRegistration } from '@loro/core/api/target'
import type { OAuthProvider } from '@loro/core/api/oauth'
import { PostgresDatabase } from '../database/database.js'
import { AuthService } from './auth.service.js'
import { tokenHash } from './auth.tokens.js'
import { OAuthFlowService, hash, secret } from './oauth-flow.service.js'
import type { AuthSettings } from './settings.js'
import type { OAuthIdentity } from './provider.js'

import {
  LORO_TEST_DATABASE_URL,
  connectAdmin,
  createSearchPathSchema,
  describePostgres,
  dropIsolatedSchema,
  isolatedSchemaName,
} from '../testing/postgres-schema.js'

const testUrl = LORO_TEST_DATABASE_URL
const key = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
  .privateKey.export({ type: 'pkcs8', format: 'pem' })
  .toString()
const installationId = '0197f2a0-0000-7000-8000-000000000001'
const anonId = '0197f2a0-0000-7000-8000-000000000002'
const device: DeviceRegistration = {
  installation_id: installationId,
  platform: 'web',
  app_version: '1.0.0+1',
}
const settings: AuthSettings = {
  databaseUrl: '',
  publicUrl: 'https://api.example.test',
  redirects: ['loro://account'],
  signingKey: 'test-signing-key-with-at-least-32-bytes',
  googleClientId: 'google-client',
  googleClientSecret: 'google-secret',
  appleClientId: 'apple-client',
  appleTeamId: 'team',
  appleKeyId: 'key',
  applePrivateKey: 'test-only',
}

describePostgres('browser OAuth with durable shared accounts', () => {
  let admin: Pool
  let database: PostgresDatabase
  let service: OAuthFlowService
  let auth: AuthService
  let now: number
  let schema: string
  const providerExchange = vi.fn<OAuthIdentity['exchange']>((provider, code) =>
    code === 'invalid'
      ? Promise.reject(new Error('provider-private-detail'))
      : Promise.resolve({ provider, subject: code }),
  )
  const provider: OAuthIdentity = {
    authorizationUrl: (p, state, nonce, challenge) =>
      `https://provider.example/${p}?${new URLSearchParams({ state, nonce, code_challenge: challenge }).toString()}`,
    exchange: providerExchange,
  }
  const rebuild = () => {
    database = new PostgresDatabase()
    auth = new AuthService(database, { now: () => now })
    service = new OAuthFlowService(settings, database, provider, auth, { now: () => now })
  }

  beforeAll(() => {
    admin = connectAdmin(testUrl)
  })
  beforeEach(async () => {
    now = 1_800_000_000_000
    schema = isolatedSchemaName('oauth_service')
    vi.stubEnv('DATABASE_URL', await createSearchPathSchema(admin, schema, testUrl))
    vi.stubEnv('AUTH_ENABLED', 'true')
    vi.stubEnv('AUTH_PRIVATE_KEY_PEM', key)
    vi.stubEnv('AUTH_ISSUER', settings.publicUrl)
    providerExchange.mockClear()
    rebuild()
  })
  afterEach(async () => {
    await database.onModuleDestroy()
    await dropIsolatedSchema(admin, schema)
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })
  afterAll(async () => {
    await admin.end()
  })

  async function grant(p: OAuthProvider = 'google', subject = 'person') {
    const verifier = secret()
    const start = await service.start(p, 'loro://account', hash(verifier))
    const callback = new URL(await service.callback(p, start.state, subject))
    return { verifier, start, callback, ticket: callback.searchParams.get('ticket') ?? '' }
  }
  async function signIn(p: OAuthProvider = 'google', subject = 'person') {
    const g = await grant(p, subject)
    return SignInResponseSchema.parse(await service.exchange(g.ticket, g.verifier, device, anonId))
  }

  it('reuses verified provider identities and device registrations across reconnects', async () => {
    const first = await signIn()
    const repeated = await signIn()
    const apple = await signIn('apple')
    expect(repeated.user.id).toBe(first.user.id)
    expect(repeated.device_id).toBe(first.device_id)
    expect(apple.user.id).not.toBe(first.user.id)
    expect(first.claim).toMatchObject({ performed: false, upload_required: true })
    await database.onModuleDestroy()
    rebuild()
    expect(await auth.authenticate(first.access_token)).toMatchObject({
      userId: first.user.id,
      deviceId: first.device_id,
    })
    const rotated = await auth.refresh(first.refresh_token, 'reconnect')
    expect(await auth.authenticate(rotated.access_token)).toMatchObject({ userId: first.user.id })
  })

  it('preserves nonce and backend PKCE independently from the app verifier', async () => {
    const verifier = secret()
    const started = await service.start('google', 'loro://account', hash(verifier))
    const authorization = new URL(started.authorization_url)
    const saved = (
      await database.query<{ hash: string; nonce: string; verifier: string; challenge: string }>(
        'SELECT hash,nonce,verifier,challenge FROM oauth_attempts',
      )
    ).rows[0]!
    expect(saved.hash).toBe(hash(started.state))
    expect(JSON.stringify(saved)).not.toContain(started.state)
    expect(saved.challenge).toBe(hash(verifier))
    expect(saved.verifier).not.toBe(verifier)
    expect(authorization.searchParams.get('nonce')).toBe(saved.nonce)
    expect(authorization.searchParams.get('code_challenge')).toBe(hash(saved.verifier))
    await service.callback('google', started.state, 'person')
    expect(providerExchange).toHaveBeenCalledExactlyOnceWith(
      'google',
      'person',
      saved.nonce,
      saved.verifier,
      now,
    )
  })

  it('rejects unregistered redirects, swapped providers, expired state and state replay', async () => {
    await expect(
      service.start('google', 'https://evil.example/account', secret()),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' })
    const started = await service.start('google', 'loro://account', secret())
    await expect(service.callback('apple', started.state, 'person')).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    })
    await service.callback('google', started.state, 'person')
    await expect(service.callback('google', started.state, 'person')).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    })
    const late = await service.start('apple', 'loro://account', secret())
    now += 300_000
    await expect(service.callback('apple', late.state, 'person')).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    })
  })

  it('requires the app verifier before creating an account and consumes each grant once', async () => {
    const g = await grant()
    expect((await database.query('SELECT id FROM auth_users')).rowCount).toBe(0)
    await expect(service.exchange(g.ticket, secret(), device, anonId)).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    })
    expect((await database.query('SELECT id FROM auth_users')).rowCount).toBe(0)
    const saved = (await database.query<{ hash: string }>('SELECT hash FROM oauth_grants')).rows[0]!
    expect(saved.hash).toBe(hash(g.ticket))
    expect(JSON.stringify(saved)).not.toContain(g.ticket)
    await service.exchange(g.ticket, g.verifier, device, anonId)
    await expect(service.exchange(g.ticket, g.verifier, device, anonId)).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    })
  })

  it('expires handoffs and redirects provider failure or denial without sensitive detail', async () => {
    const g = await grant()
    now += 60_000
    await expect(service.exchange(g.ticket, g.verifier, device, anonId)).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    })
    const failed = await grant('apple', 'invalid')
    expect(failed.callback.searchParams.get('error')).toBe('sign_in_failed')
    expect(failed.callback.searchParams.has('ticket')).toBe(false)
    expect(failed.callback.toString()).not.toContain('provider-private-detail')
    const denied = await service.start('google', 'loro://account', secret())
    const redirect = new URL(await service.callback('google', denied.state))
    expect(redirect.searchParams.get('error')).toBe('sign_in_failed')
    await expect(service.callback('google', denied.state, 'person')).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    })
  })

  it('rolls grant consumption back when shared session creation fails', async () => {
    const g = await grant()
    const interrupted = vi
      .spyOn(auth, 'signInVerified')
      .mockRejectedValueOnce(new Error('interrupted session write'))
    await expect(service.exchange(g.ticket, g.verifier, device, anonId)).rejects.toThrow(
      'interrupted session write',
    )
    expect(
      (await database.query('SELECT hash FROM oauth_grants WHERE hash=$1', [hash(g.ticket)]))
        .rowCount,
    ).toBe(1)
    interrupted.mockRestore()
    expect((await service.exchange(g.ticket, g.verifier, device, anonId)).user.id).toBeTruthy()
  })

  it('serializes a concurrent grant exchange to exactly one shared session', async () => {
    const g = await grant()
    const outcomes = await Promise.allSettled([
      service.exchange(g.ticket, g.verifier, device, anonId),
      service.exchange(g.ticket, g.verifier, device, anonId),
    ])
    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1)
    expect(outcomes.filter((outcome) => outcome.status === 'rejected')).toHaveLength(1)
    expect((await database.query('SELECT id FROM auth_users')).rowCount).toBe(1)
    expect((await database.query('SELECT id FROM auth_sessions')).rowCount).toBe(1)
  })

  it('uses shared refresh family replay revocation and stores only token digests', async () => {
    const session = await signIn()
    const principal = await auth.authenticate(session.access_token)
    const saved = await database.query<{ token_hash: string }>(
      'SELECT token_hash FROM auth_refresh_tokens WHERE session_id=$1',
      [principal.sessionId],
    )
    expect(saved.rows[0]?.token_hash).toBe(tokenHash(session.refresh_token))
    expect(JSON.stringify(saved)).not.toContain(session.refresh_token)
    const next = await auth.refresh(session.refresh_token, 'rotation')
    await expect(auth.refresh(session.refresh_token, 'rotation')).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    })
    await expect(auth.refresh(next.refresh_token, 'rotation')).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    })
    await expect(auth.authenticate(next.access_token)).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    })
  })

  it('sign-out revokes the shared session while another OAuth session keeps working', async () => {
    const first = await signIn()
    const second = await signIn()
    await auth.logout(await auth.authenticate(first.access_token))
    await expect(auth.authenticate(first.access_token)).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    })
    await expect(auth.refresh(first.refresh_token, 'logout')).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    })
    expect(await auth.authenticate(second.access_token)).toMatchObject({ userId: second.user.id })
  })

  it('stores a durable start limit independently of expired attempts and resets its window', async () => {
    for (let count = 0; count < 30; count++) await service.rate('one-address')
    await expect(service.rate('one-address')).rejects.toMatchObject({ code: 'RATE_LIMITED' })
    await database.onModuleDestroy()
    rebuild()
    await expect(service.rate('one-address')).rejects.toMatchObject({ code: 'RATE_LIMITED' })
    await service.rate('another-address')
    now += 900_000
    await service.rate('one-address')
  })
})
