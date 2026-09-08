import { generateKeyPair, SignJWT } from 'jose'
import type * as jose from 'jose'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { verifyIdentityToken } from './auth.providers.js'

const { resolveKey } = vi.hoisted(() => ({ resolveKey: vi.fn() }))
vi.mock('jose', async (original) => ({
  ...(await original<typeof jose>()),
  // Only the HTTP key retrieval is replaced. Real RSA signatures and JWT claim
  // validation still run through jose for each ID token below.
  createRemoteJWKSet: () => resolveKey,
}))

const keys = await generateKeyPair('RS256')
const now = 1_800_000_000_000
const audience = 'loro-client'

async function issue(
  issuer = 'https://accounts.google.com',
  aud = audience,
  claims: Record<string, unknown> = {},
  expiresAt = now / 1_000 + 3_600,
) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256', kid: 'provider-test' })
    .setIssuer(issuer)
    .setAudience(aud)
    .setSubject('verified-provider-subject')
    .setIssuedAt(now / 1_000)
    .setExpirationTime(expiresAt)
    .sign(keys.privateKey)
}

describe('provider ID tokens', () => {
  beforeEach(() => {
    resolveKey.mockReset()
    resolveKey.mockResolvedValue(keys.publicKey)
  })

  it('verifies Google and Apple signatures, issuers, audiences and expiry', async () => {
    expect(await verifyIdentityToken('google', await issue(), [audience], now)).toBe(
      'verified-provider-subject',
    )
    expect(
      await verifyIdentityToken('apple', await issue('https://appleid.apple.com'), [audience], now),
    ).toBe('verified-provider-subject')
    await expect(
      verifyIdentityToken('apple', await issue(), [audience], now),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' })
    await expect(
      verifyIdentityToken(
        'google',
        await issue('https://accounts.google.com', 'attacker-client'),
        [audience],
        now,
      ),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' })
    await expect(
      verifyIdentityToken(
        'google',
        await issue(undefined, undefined, {}, now / 1_000 - 31),
        [audience],
        now,
      ),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' })
  })

  it('rejects another authorized presenter and an untrusted signing key', async () => {
    await expect(
      verifyIdentityToken(
        'google',
        await issue(undefined, undefined, { azp: 'attacker-client' }),
        [audience],
        now,
      ),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' })
    resolveKey.mockResolvedValue((await generateKeyPair('RS256')).publicKey)
    await expect(
      verifyIdentityToken('google', await issue(), [audience], now),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' })
  })

  it('fails closed without a configured client and on key-provider outages', async () => {
    await expect(verifyIdentityToken('google', await issue(), [], now)).rejects.toMatchObject({
      code: 'PROVIDER_UNAVAILABLE',
    })
    expect(resolveKey).not.toHaveBeenCalled()
    resolveKey.mockRejectedValue(new Error('Untrusted upstream detail'))
    await expect(
      verifyIdentityToken('google', await issue(), [audience], now),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' })
  })
})
