import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import {
  createLocalJWKSet,
  exportJWK,
  exportPKCS8,
  generateKeyPair,
  SignJWT,
  type JWTPayload,
} from 'jose'
import { OAuthIdentityProvider } from './provider.js'
import type { OAuthDeploymentSettings } from './settings.js'
let rsa: Awaited<ReturnType<typeof generateKeyPair>>
let provider: OAuthIdentityProvider
const now = 1_788_000_000_000
const seconds = Math.floor(now / 1000)
beforeAll(async () => {
  rsa = await generateKeyPair('RS256')
  const apple = await generateKeyPair('ES256', { extractable: true })
  const keys = createLocalJWKSet({
    keys: [{ ...(await exportJWK(rsa.publicKey)), alg: 'RS256', kid: 'test' }],
  })
  const settings: OAuthDeploymentSettings = {
    databaseUrl: '',
    publicUrl: 'https://api.example.com',
    redirects: [],
    signingKey: '',
    googleClientId: 'google',
    googleClientSecret: 'secret',
    appleClientId: 'apple',
    appleTeamId: 'team',
    appleKeyId: 'key',
    applePrivateKey: await exportPKCS8(apple.privateKey),
  }
  provider = new OAuthIdentityProvider(settings, { google: keys, apple: keys })
})
afterEach(() => vi.unstubAllGlobals())
async function token(overrides: JWTPayload = {}) {
  return new SignJWT({
    iss: 'https://accounts.google.com',
    aud: 'google',
    sub: 'subject',
    iat: seconds,
    exp: seconds + 300,
    nonce: 'nonce',
    ...overrides,
  })
    .setProtectedHeader({ alg: 'RS256', kid: 'test' })
    .sign(rsa.privateKey)
}
function response(idToken: string) {
  return vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response(JSON.stringify({ id_token: idToken }), { status: 200 })),
  )
}
describe('provider verification', () => {
  it.each(['google', 'apple'] as const)(
    'verifies %s signed identity and exchanges code with server credentials',
    async (p) => {
      response(await token(p === 'apple' ? { iss: 'https://appleid.apple.com', aud: 'apple' } : {}))
      expect(await provider.exchange(p, 'code', 'nonce', 'verifier', now)).toEqual({
        provider: p,
        subject: 'subject',
      })
      expect(fetch).toHaveBeenCalledWith(
        p === 'google'
          ? 'https://oauth2.googleapis.com/token'
          : 'https://appleid.apple.com/auth/token',
        expect.objectContaining({ method: 'POST' }),
      )
    },
  )
  it.each([
    { iss: 'https://evil.example' },
    { aud: 'other-client' },
    { nonce: 'wrong' },
    { exp: seconds - 60 },
    { sub: '' },
    { azp: 'other-client' },
  ])('rejects invalid claims %j', async (overrides) => {
    response(await token(overrides))
    await expect(provider.exchange('google', 'code', 'nonce', 'verifier', now)).rejects.toThrow()
  })
  it('rejects missing required expiry and forged signatures', async () => {
    const missing = await new SignJWT({
      iss: 'https://accounts.google.com',
      aud: 'google',
      sub: 'subject',
      iat: seconds,
      nonce: 'nonce',
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'test' })
      .sign(rsa.privateKey)
    response(missing)
    await expect(provider.exchange('google', 'code', 'nonce', 'verifier', now)).rejects.toThrow()
    const forged = await token()
    response(forged.slice(0, -12) + 'invalidtoken')
    await expect(provider.exchange('google', 'code', 'nonce', 'verifier', now)).rejects.toThrow()
  })
  it('uses provider-specific callbacks, state, nonce and Google PKCE without client secrets in URLs', () => {
    for (const p of ['google', 'apple'] as const) {
      const url = new URL(provider.authorizationUrl(p, 'state', 'nonce', 'challenge'))
      expect(url.searchParams.get('state')).toBe('state')
      expect(url.searchParams.get('nonce')).toBe('nonce')
      expect(url.searchParams.get('redirect_uri')).toBe(
        `https://api.example.com/v1/auth/${p}/callback`,
      )
      expect(url.searchParams.has('client_secret')).toBe(false)
      expect(url.searchParams.get(p === 'google' ? 'code_challenge_method' : 'response_mode')).toBe(
        p === 'google' ? 'S256' : 'form_post',
      )
    }
  })
})
