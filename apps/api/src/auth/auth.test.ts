import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { newDb } from 'pg-mem'
import { Pool } from 'pg'
import { AuthRepository } from './repository.js'
import { AuthService, hash, secret } from './service.js'
import type { AuthSettings } from './settings.js'
import type { IdentityProvider } from './provider.js'
import type { OAuthProvider } from '@loro/core/api/oauth'

const settings: AuthSettings = {
  databaseUrl: '',
  publicUrl: 'https://api.example.com',
  redirects: ['loro://account'],
  signingKey: 'test-signing-key-with-at-least-32-bytes',
  googleClientId: 'google-client',
  googleClientSecret: 'google-secret',
  appleClientId: 'apple-client',
  appleTeamId: 'team',
  appleKeyId: 'key',
  applePrivateKey: 'test-only',
}
let repository: AuthRepository
let service: AuthService
let now: number
const provider: IdentityProvider = {
  authorizationUrl: (p, state, nonce) =>
    `https://provider.example/${p}?state=${state}&nonce=${nonce}`,
  exchange: (p, code) =>
    code === 'invalid'
      ? Promise.reject(new Error('secret must not escape'))
      : Promise.resolve({ provider: p, subject: code }),
}
beforeEach(async () => {
  now = 1_788_000_000_000
  const url = process.env['AUTH_TEST_DATABASE_URL']
  if (url) {
    repository = new AuthRepository(new Pool({ connectionString: url }))
    await repository.pool.query(
      'DROP TABLE IF EXISTS auth_refresh,auth_sessions,auth_grants,auth_attempts,auth_accounts,auth_rates CASCADE',
    )
  } else {
    const adapter = newDb().adapters.createPg()
    repository = new AuthRepository(new (adapter.Pool as typeof Pool)())
  }
  await repository.initialize()
  service = new AuthService(settings, repository, provider, { now: () => now })
})
afterEach(async () => {
  await repository.close()
})
async function grant(p: OAuthProvider = 'google', subject = 'person') {
  const verifier = secret()
  const start = await service.start(p, 'loro://account', hash(verifier))
  const callback = new URL(await service.callback(p, start.state, subject))
  const ticket = callback.searchParams.get('ticket') ?? ''
  return { verifier, start, callback, ticket }
}
async function signIn(p: OAuthProvider = 'google', subject = 'person') {
  const g = await grant(p, subject)
  return service.exchange(g.ticket, g.verifier)
}
describe('durable provider identity and sessions', () => {
  it('creates once, signs in again, and never links different provider subjects', async () => {
    const a = await signIn(),
      b = await signIn(),
      c = await signIn('apple')
    expect(a.user.id).toBe(b.user.id)
    expect(c.user.id).not.toBe(a.user.id)
    expect(await service.principal(a.access_token)).toEqual(a.user)
    const restarted = new AuthService(settings, repository, provider, { now: () => now })
    expect((await restarted.refresh(a.refresh_token)).user).toEqual(a.user)
  })
  it('rejects unregistered redirects, provider-swapped state, expired and replayed state', async () => {
    await expect(service.start('google', 'https://evil.example', secret())).rejects.toThrow()
    const start = await service.start('google', 'loro://account', secret())
    await expect(service.callback('apple', start.state, 'person')).rejects.toThrow()
    await service.callback('google', start.state, 'person')
    await expect(service.callback('google', start.state, 'person')).rejects.toThrow()
    const late = await service.start('apple', 'loro://account', secret())
    now += 300_001
    await expect(service.callback('apple', late.state, 'person')).rejects.toThrow()
  })
  it('requires the app verifier and consumes a handoff once', async () => {
    const g = await grant()
    await expect(service.exchange(g.ticket, secret())).rejects.toThrow()
    await service.exchange(g.ticket, g.verifier)
    await expect(service.exchange(g.ticket, g.verifier)).rejects.toThrow()
  })
  it('expires handoffs and returns only a generic provider error', async () => {
    const g = await grant()
    now += 60_001
    await expect(service.exchange(g.ticket, g.verifier)).rejects.toThrow()
    const failed = await grant('apple', 'invalid')
    expect(failed.callback.searchParams.get('error')).toBe('sign_in_failed')
    expect(failed.callback.searchParams.has('ticket')).toBe(false)
  })
  it('rotates refresh and commits family revocation on replay', async () => {
    const session = await signIn(),
      next = await service.refresh(session.refresh_token)
    expect(next.refresh_token).not.toBe(session.refresh_token)
    await expect(service.refresh(session.refresh_token)).rejects.toThrow()
    await expect(service.refresh(next.refresh_token)).rejects.toThrow()
    await expect(service.principal(next.access_token)).rejects.toThrow()
  })
  it('sign-out revokes only this session and also invalidates its access JWT', async () => {
    const a = await signIn(),
      b = await signIn()
    await service.logout(a.refresh_token)
    await expect(service.principal(a.access_token)).rejects.toThrow()
    await expect(service.refresh(a.refresh_token)).rejects.toThrow()
    expect(await service.principal(b.access_token)).toEqual(b.user)
    await service.logout(a.refresh_token)
  })
  it('rejects modified and expired access, expires refresh families', async () => {
    const s = await signIn()
    await expect(service.principal(s.access_token.slice(0, -8) + 'invalid!')).rejects.toThrow()
    now += 901_000
    await expect(service.principal(s.access_token)).rejects.toThrow()
    now += 30 * 24 * 60 * 60 * 1000
    await expect(service.refresh(s.refresh_token)).rejects.toThrow()
  })
  it('stores hashes instead of refresh/ticket/state secrets and limits starts', async () => {
    const s = await signIn()
    const rows = await repository.pool.query<{ hash: string }>('SELECT hash FROM auth_refresh')
    expect(rows.rows[0]?.hash).toBe(hash(s.refresh_token))
    for (let i = 0; i < 30; i++) await service.rate('one-ip')
    await expect(service.rate('one-ip')).rejects.toThrow()
    await service.rate('another-ip')
    now += 900_001
    await service.rate('one-ip')
  })
  it.skipIf(!process.env['AUTH_TEST_DATABASE_URL'])(
    'serializes concurrent rotation on real PostgreSQL',
    async () => {
      const s = await signIn()
      const outcomes = await Promise.allSettled([
        service.refresh(s.refresh_token),
        service.refresh(s.refresh_token),
      ])
      expect(outcomes.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
      const success = outcomes.find((r) => r.status === 'fulfilled')
      if (success?.status === 'fulfilled')
        await expect(service.refresh(success.value.refresh_token)).rejects.toThrow()
    },
  )
})
