/** Real PostgreSQL transaction/replay tests; set LORO_TEST_DATABASE_URL to an isolated server. */
import { generateKeyPairSync, randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MagicVerifyRequest } from '@loro/core/api/target'
import { config } from '../common/config.js'
import type { SqlConnection, SqlDatabase, SqlResult } from '../database/database.js'
import { AUTH_MIGRATION_SQL } from './auth.schema.js'
import { AuthService } from './auth.service.js'
import { CODE_MILLISECONDS, MAX_CODE_ATTEMPTS } from './auth.tokens.js'

const testUrl = process.env['LORO_TEST_DATABASE_URL']
const suite = describe.skipIf(!testUrl)
const key = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
  .privateKey.export({ type: 'pkcs8', format: 'pem' })
  .toString()
const settings = {
  privateKeyPem: key,
  issuer: 'https://loro.test',
  audience: 'loro-test',
  keyId: 'test',
  emailHashKey: 'test-email-hash-key-with-at-least-32-characters',
  magicDeliveryUrl: 'https://delivery.example.test/send',
  magicDeliveryToken: 'test-delivery-only',
  googleClientIds: [],
  appleClientIds: [],
}

suite('durable authentication with PostgreSQL', () => {
  let admin: Pool
  let pool: Pool
  let database: SqlDatabase
  let auth: AuthService
  let now: number
  let schema: string
  let address: string
  const deliveries = new Map<string, string>()

  beforeAll(async () => {
    schema = `auth_test_${randomUUID().replaceAll('-', '')}`
    admin = new Pool({ connectionString: testUrl })
    // The only identifier interpolation is a locally generated hexadecimal name.
    await admin.query(`CREATE SCHEMA ${schema}`)
    pool = new Pool({ connectionString: testUrl, options: `-c search_path=${schema}` })
    await pool.query(AUTH_MIGRATION_SQL)
    database = {
      async query<T>(sql: string, values?: readonly unknown[]): Promise<SqlResult<T>> {
        const result = await pool.query(sql, values ? [...values] : undefined)
        return { rows: result.rows as T[], rowCount: result.rowCount }
      },
      async transaction<T>(work: (connection: SqlConnection) => Promise<T>) {
        const client = await pool.connect()
        try {
          await client.query('BEGIN')
          const result = await work({
            async query<R>(sql: string, values?: readonly unknown[]): Promise<SqlResult<R>> {
              const response = await client.query(sql, values ? [...values] : undefined)
              return { rows: response.rows as R[], rowCount: response.rowCount }
            },
          })
          await client.query('COMMIT')
          return result
        } catch (error) {
          await client.query('ROLLBACK')
          throw error
        } finally {
          client.release()
        }
      },
      async ready() {
        await pool.query('SELECT 1')
        return true
      },
    }
  })

  beforeEach(() => {
    now = 1_800_000_000_000
    address = randomUUID()
    deliveries.clear()
    vi.spyOn(config, 'authSettings').mockReturnValue(settings)
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, request: RequestInit) => {
        if (typeof request.body !== 'string') throw new Error('Expected JSON body')
        const body: unknown = JSON.parse(request.body)
        if (!body || typeof body !== 'object' || !('email' in body) || !('code' in body))
          throw new Error('Bad delivery body')
        deliveries.set(String(body.email), String(body.code))
        return Promise.resolve(new Response(null, { status: 202 }))
      }),
    )
    auth = new AuthService(database, { now: () => now })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })
  afterAll(async () => {
    await pool.end()
    await admin.query(`DROP SCHEMA ${schema} CASCADE`)
    await admin.end()
  })

  async function signIn(
    email = `${randomUUID()}@example.test`,
    installation = randomUUID(),
    anonId = randomUUID(),
  ) {
    expect(await auth.requestCode(email, address)).toEqual({ status: 'accepted' })
    const input: MagicVerifyRequest = {
      email,
      code: deliveries.get(email)!,
      anon_id: anonId,
      device: { installation_id: installation, platform: 'web', app_version: 'test' },
    }
    return { result: await auth.verifyCode(input, address), input }
  }

  it('signs in, survives service restart, and stores no raw refresh token or email', async () => {
    const { result, input } = await signIn()
    const restarted = new AuthService(database, { now: () => now })
    const principal = await restarted.authenticate(result.access_token)
    expect(principal.userId).toBe(result.user.id)
    expect(principal.deviceId).toBe(result.device_id)
    expect(await restarted.me(principal)).toEqual({
      user: result.user,
      device_id: result.device_id,
    })
    const rows = await database.query('SELECT * FROM auth_refresh_tokens WHERE session_id=$1', [
      principal.sessionId,
    ])
    expect(JSON.stringify(rows)).not.toContain(result.refresh_token)
    const identities = await database.query('SELECT * FROM auth_identities WHERE user_id=$1', [
      result.user.id,
    ])
    expect(JSON.stringify(identities)).not.toContain(input.email)
    await expect(auth.verifyCode(input, address)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' })
  })

  it('keeps accounts isolated even when another learner supplies the same installation and anonymous IDs', async () => {
    const installation = randomUUID()
    const anonymousId = randomUUID()
    const first = await signIn(`${randomUUID()}@example.test`, installation, anonymousId)
    const second = await signIn(`${randomUUID()}@example.test`, installation, anonymousId)
    expect(second.result.user.id).not.toBe(first.result.user.id)
    expect(second.result.device_id).not.toBe(first.result.device_id)
    expect(first.result.claim).toMatchObject({ performed: false, upload_required: true })
    const principal = await auth.authenticate(first.result.access_token)
    await expect(
      auth.claim(principal, {
        anon_id: anonymousId,
        device_id: second.result.device_id,
        request_id: randomUUID(),
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('rotates refresh tokens and commits whole-family revocation when an old token is replayed', async () => {
    const { result } = await signIn()
    const rotated = await auth.refresh(result.refresh_token, address)
    expect(rotated.refresh_token).not.toBe(result.refresh_token)
    await expect(auth.authenticate(rotated.access_token)).resolves.toMatchObject({
      userId: result.user.id,
    })
    await expect(auth.refresh(result.refresh_token, address)).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    })
    await expect(auth.refresh(rotated.refresh_token, address)).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    })
    await expect(auth.authenticate(result.access_token)).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    })
    await expect(auth.authenticate(rotated.access_token)).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    })
  })

  it('serializes simultaneous refreshes and revokes the surviving token on reuse', async () => {
    const { result } = await signIn()
    const attempts = await Promise.allSettled([
      auth.refresh(result.refresh_token, address),
      auth.refresh(result.refresh_token, address),
    ])
    expect(attempts.filter((entry) => entry.status === 'fulfilled')).toHaveLength(1)
    expect(attempts.filter((entry) => entry.status === 'rejected')).toHaveLength(1)
    const succeeded = attempts.find((entry) => entry.status === 'fulfilled')
    if (succeeded?.status !== 'fulfilled') throw new Error('Expected one rotation')
    await expect(auth.authenticate(succeeded.value.access_token)).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    })
  })

  it('commits failed code attempts and blocks the correct code after five guesses', async () => {
    const email = `${randomUUID()}@example.test`
    await auth.requestCode(email, address)
    const input = {
      email,
      code: deliveries.get(email)!,
      anon_id: randomUUID(),
      device: { installation_id: randomUUID(), platform: 'web' as const, app_version: 'test' },
    }
    const wrong = input.code === '000000' ? '000001' : '000000'
    for (let count = 0; count < MAX_CODE_ATTEMPTS; count += 1) {
      await expect(auth.verifyCode({ ...input, code: wrong }, address)).rejects.toMatchObject({
        code: 'UNAUTHENTICATED',
      })
    }
    const restarted = new AuthService(database, { now: () => now })
    await expect(restarted.verifyCode(input, address)).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    })
  })

  it('expires codes after ten minutes', async () => {
    const email = `${randomUUID()}@example.test`
    await auth.requestCode(email, address)
    now += CODE_MILLISECONDS
    await expect(
      auth.verifyCode(
        {
          email,
          code: deliveries.get(email)!,
          anon_id: randomUUID(),
          device: { installation_id: randomUUID(), platform: 'web', app_version: 'test' },
        },
        address,
      ),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' })
  })

  it('revokes sign-out immediately while retaining the account and claim record', async () => {
    const { result } = await signIn()
    const principal = await auth.authenticate(result.access_token)
    await auth.logout(principal)
    await expect(auth.authenticate(result.access_token)).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    })
    await expect(auth.refresh(result.refresh_token, address)).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    })
    expect(
      (await database.query('SELECT id FROM auth_users WHERE id=$1', [principal.userId])).rowCount,
    ).toBe(1)
  })

  it('makes claim correlation idempotent without claiming a completed data upload', async () => {
    const { result } = await signIn()
    const principal = await auth.authenticate(result.access_token)
    const input = { anon_id: randomUUID(), device_id: principal.deviceId, request_id: randomUUID() }
    const first = await auth.claim(principal, input)
    expect(await auth.claim(principal, input)).toEqual(first)
    expect(first).toMatchObject({ performed: false, mode: null, upload_required: true })
    await expect(auth.claim(principal, { ...input, anon_id: randomUUID() })).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    })
  })

  it('enforces email delivery limits durably and never follows delivery redirects', async () => {
    const email = `${randomUUID()}@example.test`
    for (let count = 0; count < 5; count += 1) await auth.requestCode(email, address)
    const restarted = new AuthService(database, { now: () => now })
    await expect(restarted.requestCode(email, randomUUID())).rejects.toMatchObject({
      code: 'RATE_LIMITED',
    })
    expect(fetch).toHaveBeenCalledWith(
      settings.magicDeliveryUrl,
      expect.objectContaining({ redirect: 'error' }),
    )
  })
})
