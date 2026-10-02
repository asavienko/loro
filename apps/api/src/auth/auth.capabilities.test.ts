import { generateKeyPairSync } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { config, type SessionAuthSettings } from '../common/config.js'
import type { SqlDatabase } from '../database/database.js'
import { AuthService } from './auth.service.js'

const key = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
  .privateKey.export({ type: 'pkcs8', format: 'pem' })
  .toString()

const base: SessionAuthSettings = {
  enabled: undefined,
  signingKey: undefined,
  privateKeyPem: key,
  issuer: 'https://loro.test',
  audience: 'loro-test',
  keyId: 'test',
  emailHashKey: 'test-email-hash-key-with-at-least-32-characters',
  magicDeliveryUrl: undefined,
  magicDeliveryToken: undefined,
  emailFrom: undefined,
  googleClientIds: [],
  appleClientIds: [],
}

function emailOffered(settings: Partial<SessionAuthSettings>): boolean {
  vi.spyOn(config, 'sessionAuthSettings').mockReturnValue({ ...base, ...settings })
  const clock = { now: () => 0 }
  return new AuthService({} as SqlDatabase, clock).capabilities().email
}

describe('email sign-in capability', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('is offered through SES only with a sender, and needs no webhook bearer', () => {
    expect(emailOffered({ magicDeliveryUrl: 'ses', emailFrom: 'Loro <codes@example.test>' })).toBe(
      true,
    )
    expect(emailOffered({ magicDeliveryUrl: 'ses' })).toBe(false)
  })

  it('still needs the bearer for a webhook or the local inbox', () => {
    expect(emailOffered({ magicDeliveryUrl: 'https://delivery.example.test/send' })).toBe(false)
    expect(
      emailOffered({
        magicDeliveryUrl: 'https://delivery.example.test/send',
        magicDeliveryToken: 't',
      }),
    ).toBe(true)
    expect(emailOffered({ magicDeliveryUrl: 'inbox:local', magicDeliveryToken: 't' })).toBe(true)
  })
})
