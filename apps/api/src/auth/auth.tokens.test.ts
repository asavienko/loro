import { generateKeyPairSync } from 'node:crypto'
import { decodeJwt, SignJWT } from 'jose'
import { describe, expect, it } from 'vitest'
import { AccessTokens, equalHash, keyedHash, newRefreshToken, tokenHash } from './auth.tokens.js'

const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
const settings = {
  privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  issuer: 'https://api.loro.test',
  audience: 'loro-mobile',
  keyId: 'test',
}
const now = 1_800_000_000_000
const principal = { userId: 'account-a', deviceId: 'device-a', sessionId: 'session-a' }

describe('ES256 access tokens', () => {
  it('signs verified account, installation and family claims for fifteen minutes', async () => {
    const tokens = new AccessTokens(settings)
    const token = await tokens.issue(principal, now)
    expect(await tokens.verify(token, now)).toEqual(principal)
    expect(decodeJwt(token)).toMatchObject({
      exp: now / 1_000 + 900,
      iat: now / 1_000,
      ver: 1,
      plan: 'free',
    })
    await expect(tokens.verify(token, now + 931_000)).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    })
  })

  it('rejects another signing key, issuer, audience and algorithm', async () => {
    const tokens = new AccessTokens(settings)
    const token = await tokens.issue(principal, now)
    const secondKey = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
      .privateKey.export({ type: 'pkcs8', format: 'pem' })
      .toString()
    await expect(
      new AccessTokens({ ...settings, privateKeyPem: secondKey }).verify(token, now),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' })
    await expect(
      new AccessTokens({ ...settings, issuer: 'other' }).verify(token, now),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' })
    await expect(
      new AccessTokens({ ...settings, audience: 'other' }).verify(token, now),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' })
    const forged = await new SignJWT({
      sub: 'account-a',
      sid: 'session-a',
      device_id: 'device-a',
      ver: 1,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .sign(new Uint8Array(32))
    await expect(tokens.verify(forged, now)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' })
  })

  it('fails closed when no signing key is configured', () => {
    expect(() => new AccessTokens({ ...settings, privateKeyPem: undefined })).toThrow()
    expect(() => new AccessTokens({ ...settings, privateKeyPem: 'not a key' })).toThrow()
    const sec1 = privateKey.export({ type: 'sec1', format: 'pem' }).toString()
    expect(() => new AccessTokens({ ...settings, privateKeyPem: sec1 })).toThrow()
  })
})

describe('stored credential digests', () => {
  it('uses random 256-bit bearer tokens and stores only a digest', () => {
    const first = newRefreshToken()
    const second = newRefreshToken()
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(first).not.toBe(second)
    expect(tokenHash(first)).toHaveLength(64)
    expect(tokenHash(first)).not.toBe(first)
  })

  it('binds low-entropy codes to a server key and challenge nonce', () => {
    const hash = keyedHash('server-key', 'nonce-a:123456')
    expect(equalHash(hash, keyedHash('server-key', 'nonce-a:123456'))).toBe(true)
    expect(equalHash(hash, keyedHash('server-key', 'nonce-b:123456'))).toBe(false)
    expect(equalHash(hash, keyedHash('other-key', 'nonce-a:123456'))).toBe(false)
  })
})
