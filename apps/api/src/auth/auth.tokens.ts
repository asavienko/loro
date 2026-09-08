import { createHash, createHmac, createPublicKey, randomBytes, timingSafeEqual } from 'node:crypto'
import { importPKCS8, importSPKI, jwtVerify, SignJWT } from 'jose'
import { LoroError } from '../common/errors.js'

export const ACCESS_SECONDS = 900
export const REFRESH_MILLISECONDS = 90 * 24 * 60 * 60 * 1_000
export const CODE_MILLISECONDS = 10 * 60 * 1_000
export const MAX_CODE_ATTEMPTS = 5

export interface AuthPrincipal {
  userId: string
  deviceId: string
  sessionId: string
}

export interface TokenSettings {
  privateKeyPem: string | undefined
  issuer: string
  audience: string
  keyId: string
}

/** 256 bits of entropy; SHA-256 stores no reusable bearer credential. */
export function newRefreshToken(): string {
  return randomBytes(32).toString('base64url')
}

export function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function keyedHash(secret: string, value: string): string {
  return createHmac('sha256', secret).update(value).digest('hex')
}

export function equalHash(actual: string, expected: string): boolean {
  const left = Buffer.from(actual, 'hex')
  const right = Buffer.from(expected, 'hex')
  return left.length === right.length && timingSafeEqual(left, right)
}

export class AccessTokens {
  private readonly signingKey: ReturnType<typeof importPKCS8>
  private readonly verificationKey: ReturnType<typeof importSPKI>

  constructor(private readonly settings: TokenSettings) {
    if (!settings.privateKeyPem?.startsWith('-----BEGIN PRIVATE KEY-----'))
      throw new LoroError('PROVIDER_UNAVAILABLE')
    try {
      const key = createPublicKey(settings.privateKeyPem)
      if (key.asymmetricKeyType !== 'ec' || key.asymmetricKeyDetails?.namedCurve !== 'prime256v1') {
        throw new Error('ES256 key required')
      }
      this.signingKey = importPKCS8(settings.privateKeyPem, 'ES256')
      this.verificationKey = importSPKI(
        key.export({ type: 'spki', format: 'pem' }).toString(),
        'ES256',
      )
    } catch {
      throw new LoroError('PROVIDER_UNAVAILABLE')
    }
  }

  async issue(principal: AuthPrincipal, now: number): Promise<string> {
    const seconds = Math.floor(now / 1_000)
    return new SignJWT({
      device_id: principal.deviceId,
      sid: principal.sessionId,
      plan: 'free',
      ver: 1,
    })
      .setProtectedHeader({ alg: 'ES256', kid: this.settings.keyId, typ: 'JWT' })
      .setSubject(principal.userId)
      .setIssuer(this.settings.issuer)
      .setAudience(this.settings.audience)
      .setIssuedAt(seconds)
      .setExpirationTime(seconds + ACCESS_SECONDS)
      .sign(await this.signingKey)
  }

  async verify(token: string, now: number): Promise<AuthPrincipal> {
    try {
      const { payload } = await jwtVerify(token, await this.verificationKey, {
        issuer: this.settings.issuer,
        audience: this.settings.audience,
        algorithms: ['ES256'],
        typ: 'JWT',
        currentDate: new Date(now),
        clockTolerance: 30,
        requiredClaims: ['sub', 'exp', 'iat', 'sid', 'device_id', 'ver'],
      })
      if (
        typeof payload.sub !== 'string' ||
        typeof payload['device_id'] !== 'string' ||
        typeof payload['sid'] !== 'string' ||
        payload['ver'] !== 1
      ) {
        throw new Error('Invalid claims')
      }
      return { userId: payload.sub, deviceId: payload['device_id'], sessionId: payload['sid'] }
    } catch {
      throw new LoroError('UNAUTHENTICATED')
    }
  }
}
