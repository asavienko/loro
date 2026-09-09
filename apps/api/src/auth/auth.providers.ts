import { jwtVerify } from 'jose'
import { LoroError } from '../common/errors.js'
import { IDENTITY_ISSUERS, identityJwks } from './jwks.js'

export type IdentityProvider = 'apple' | 'google'

/** Fixed public key URLs; a user-supplied JWT never chooses a network destination. */
const providers = {
  google: {
    issuer: IDENTITY_ISSUERS.google,
    keys: identityJwks('google'),
  },
  apple: {
    issuer: IDENTITY_ISSUERS.apple,
    keys: identityJwks('apple'),
  },
} as const

export async function verifyIdentityToken(
  provider: IdentityProvider,
  token: string,
  audiences: string[],
  now: number,
): Promise<string> {
  if (audiences.length === 0) throw new LoroError('PROVIDER_UNAVAILABLE')
  try {
    const definition = providers[provider]
    const { payload } = await jwtVerify(token, definition.keys, {
      issuer: [...definition.issuer],
      audience: audiences,
      algorithms: ['RS256'],
      requiredClaims: ['sub', 'exp', 'iat'],
      currentDate: new Date(now),
      clockTolerance: 30,
    })
    if (!payload.sub || payload.sub.length > 512) throw new Error('Invalid subject')
    // For Google hybrid/multiple-audience tokens the authorized presenter must
    // also be ours; accepting only an aud match would permit a different client.
    if (
      payload['azp'] !== undefined &&
      (typeof payload['azp'] !== 'string' || !audiences.includes(payload['azp']))
    ) {
      throw new Error('Invalid authorized party')
    }
    return payload.sub
  } catch {
    throw new LoroError('UNAUTHENTICATED')
  }
}
