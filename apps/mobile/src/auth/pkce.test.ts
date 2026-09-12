import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { encodeBase64Url, pkceChallenge, randomPopupName, randomVerifier } from './pkce'

describe('pkceChallenge', () => {
  it('matches the API SHA-256 base64url hash', async () => {
    const verifier = 'v'.repeat(43)
    expect(await pkceChallenge(verifier)).toBe(
      createHash('sha256').update(verifier).digest('base64url'),
    )
  })

  it('encodes raw bytes as unpadded base64url', () => {
    expect(encodeBase64Url(Uint8Array.from([0xff, 0xee, 0xdd]))).toBe('_-7d')
  })

  it('mints a verifier and popup name without Expo crypto', () => {
    expect(randomVerifier()).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(randomPopupName().startsWith('loro-sign-in-')).toBe(true)
  })
})
