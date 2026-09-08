/** Real PostgreSQL transaction/replay tests; set LORO_TEST_DATABASE_URL to an isolated server. */
import { generateKeyPairSync, randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  SignInResponseSchema,
  RefreshRequestSchema,
  type MagicVerifyRequest,
} from '@loro/core/api/target'
import { config } from '../common/config.js'
import {
  PostgresDatabase,
  type SqlConnection,
  type SqlDatabase,
  type SqlResult,
} from '../database/database.js'
import { AUTH_MIGRATION_SQL } from './auth.schema.js'
import { AuthService } from './auth.service.js'
import {
  CODE_MILLISECONDS,
  MAX_CODE_ATTEMPTS,
  legacyTokenHash,
  newRefreshToken,
} from './auth.tokens.js'

const testUrl = process.env['LORO_TEST_DATABASE_URL']
const suite = describe.skipIf(!testUrl)
const key = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
  .privateKey.export({ type: 'pkcs8', format: 'pem' })
  .toString()
const settings = {
  enabled: undefined,
  signingKey: undefined,
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

suite('upgrade of existing browser authentication data', () => {
  const schema = `auth_upgrade_${randomUUID().replaceAll('-', '')}`
  const accountId = randomUUID()
  const oldSessionIds = [randomUUID(), randomUUID(), randomUUID()]
  const oldTokens = [newRefreshToken(), newRefreshToken(), newRefreshToken()]
  const legacyNow = 1_800_000_000_000
  const legacyExpiry = legacyNow + 7 * 24 * 60 * 60 * 1000
  const browserSettings = {
    ...settings,
    privateKeyPem: undefined,
    signingKey: 'legacy-browser-signing-key-at-least-32-bytes',
    audience: 'loro-mobile',
  }
  const registration = {
    device: {
      installation_id: '0197f2a0-0000-7000-8000-000000000010',
      platform: 'web' as const,
      app_version: '1.0.0+1',
    },
    anon_id: '0197f2a0-0000-7000-8000-000000000011',
  }
  let admin: Pool
  let setup: Pool
  let database: PostgresDatabase
  let auth: AuthService

  beforeAll(async () => {
    admin = new Pool({ connectionString: testUrl })
    await admin.query(`CREATE SCHEMA ${schema}`)
    setup = new Pool({ connectionString: testUrl, options: `-csearch_path=${schema}` })
    // Frozen deployed schema, independent of the new OAuth repository implementation.
    await setup.query(`
      CREATE TABLE auth_accounts(id uuid PRIMARY KEY,provider text NOT NULL,subject text NOT NULL,UNIQUE(provider,subject));
      CREATE TABLE auth_sessions(id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES auth_accounts(id),expires bigint NOT NULL,revoked boolean NOT NULL DEFAULT false);
      CREATE TABLE auth_refresh(hash text PRIMARY KEY,session_id uuid NOT NULL REFERENCES auth_sessions(id),consumed boolean NOT NULL DEFAULT false);
      CREATE TABLE auth_attempts(hash text PRIMARY KEY,provider text NOT NULL,nonce text NOT NULL,verifier text NOT NULL,challenge text NOT NULL,redirect text NOT NULL,expires bigint NOT NULL);
      CREATE TABLE auth_grants(hash text PRIMARY KEY,user_id uuid NOT NULL REFERENCES auth_accounts(id),challenge text NOT NULL,expires bigint NOT NULL);
    `)
    await setup.query('INSERT INTO auth_accounts(id,provider,subject) VALUES($1,$2,$3)', [
      accountId,
      'google',
      'existing-provider-subject',
    ])
    for (let index = 0; index < oldSessionIds.length; index += 1) {
      await setup.query('INSERT INTO auth_sessions(id,user_id,expires) VALUES($1,$2,$3)', [
        oldSessionIds[index],
        accountId,
        legacyExpiry,
      ])
      await setup.query('INSERT INTO auth_refresh(hash,session_id) VALUES($1,$2)', [
        legacyTokenHash(oldTokens[index]!),
        oldSessionIds[index],
      ])
    }
    await setup.query(
      `INSERT INTO auth_attempts(hash,provider,nonce,verifier,challenge,redirect,expires)
      VALUES('pending-attempt','google','nonce','verifier','challenge','loro://account',$1)`,
      [legacyNow + 300000],
    )
    await setup.query(
      `INSERT INTO auth_grants(hash,user_id,challenge,expires) VALUES('pending-grant',$1,'challenge',$2)`,
      [accountId, legacyNow + 60000],
    )
    const scoped = new URL(testUrl!)
    scoped.searchParams.set('options', `-csearch_path=${schema}`)
    vi.stubEnv('DATABASE_URL', scoped.toString())
    database = new PostgresDatabase()
    await database.query('SELECT 1')
  })

  beforeEach(() => {
    vi.spyOn(config, 'authSettings').mockReturnValue(browserSettings)
    auth = new AuthService(database, { now: () => legacyNow })
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })
  afterAll(async () => {
    await database.onModuleDestroy()
    await setup.end()
    await admin.query(`DROP SCHEMA ${schema} CASCADE`)
    await admin.end()
    vi.unstubAllEnvs()
  })

  it('keeps existing account IDs and refresh foreign keys, records unknown creation time, and imports handoffs only once', async () => {
    expect(
      (await database.query('SELECT id,created_at FROM auth_users WHERE id=$1', [accountId])).rows,
    ).toEqual([{ id: accountId, created_at: null }])
    expect(
      (
        await database.query(
          'SELECT provider,subject,user_id FROM auth_identities WHERE user_id=$1',
          [accountId],
        )
      ).rows,
    ).toEqual([{ provider: 'google', subject: 'existing-provider-subject', user_id: accountId }])
    expect(
      (
        await database.query(
          `SELECT r.hash FROM auth_refresh r JOIN auth_sessions_legacy s ON r.session_id=s.id`,
        )
      ).rowCount,
    ).toBe(3)
    expect((await database.query('SELECT hash FROM oauth_attempts')).rows).toEqual([
      { hash: 'pending-attempt' },
    ])
    expect((await database.query('SELECT hash,provider,subject FROM oauth_grants')).rows).toEqual([
      { hash: 'pending-grant', provider: 'google', subject: 'existing-provider-subject' },
    ])
    await database.query('DELETE FROM oauth_attempts')
    await database.query('DELETE FROM oauth_grants')
    await database.query(AUTH_MIGRATION_SQL)
    expect((await database.query('SELECT hash FROM oauth_attempts')).rows).toEqual([])
    expect((await database.query('SELECT hash FROM oauth_grants')).rows).toEqual([])
    expect((await database.query('SELECT hash FROM auth_attempts')).rowCount).toBe(1)
    expect((await database.query('SELECT hash FROM auth_grants')).rowCount).toBe(1)
  })

  it('requires paired registration for old refresh tokens and preserves the remaining old session lifetime', async () => {
    expect(
      RefreshRequestSchema.safeParse({ refresh_token: oldTokens[0], device: registration.device })
        .success,
    ).toBe(false)
    expect(
      RefreshRequestSchema.safeParse({ refresh_token: oldTokens[0], anon_id: registration.anon_id })
        .success,
    ).toBe(false)
    await expect(auth.refresh(oldTokens[0]!, 'upgrade-device')).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    })
    expect(
      (
        await database.query('SELECT consumed FROM auth_refresh WHERE hash=$1', [
          legacyTokenHash(oldTokens[0]!),
        ])
      ).rows,
    ).toEqual([{ consumed: false }])
    const result = SignInResponseSchema.parse(
      await auth.refresh(oldTokens[0]!, 'upgrade-device', registration),
    )
    expect(result.user).toEqual({ id: accountId, created_at: null, provider: 'google' })
    const principal = await auth.authenticate(result.access_token)
    expect(principal).toMatchObject({ userId: accountId, deviceId: result.device_id })
    expect(
      (
        await database.query('SELECT expires_at FROM auth_sessions WHERE id=$1', [
          principal.sessionId,
        ])
      ).rows,
    ).toEqual([{ expires_at: String(legacyExpiry) }])
    const rotation = await auth.refresh(result.refresh_token, 'upgrade-device')
    expect(rotation).not.toHaveProperty('device_id')
    expect(await auth.authenticate(rotation.access_token)).toEqual(principal)
    await auth.revokeRefresh(rotation.refresh_token)
    await expect(auth.authenticate(rotation.access_token)).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    })
  })

  it('commits revocation of an upgraded family when an old credential is replayed or used to sign out', async () => {
    const first = SignInResponseSchema.parse(
      await auth.refresh(oldTokens[1]!, 'replay-device', registration),
    )
    await expect(auth.refresh(oldTokens[1]!, 'replay-device', registration)).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    })
    await expect(auth.authenticate(first.access_token)).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    })
    await expect(auth.refresh(first.refresh_token, 'replay-device')).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    })
    const second = SignInResponseSchema.parse(
      await auth.refresh(oldTokens[2]!, 'logout-device', registration),
    )
    await auth.revokeRefresh(oldTokens[2]!)
    await expect(auth.authenticate(second.access_token)).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    })
  })

  it('honors explicit authentication disablement with configured keys and existing data', async () => {
    vi.mocked(config.authSettings).mockReturnValue({ ...browserSettings, enabled: false })
    expect(auth.capabilities()).toEqual({ google: false, apple: false, email: false })
    await expect(auth.refresh(oldTokens[0]!, 'disabled', registration)).rejects.toMatchObject({
      code: 'PROVIDER_UNAVAILABLE',
    })
    await expect(auth.revokeRefresh(oldTokens[0]!)).rejects.toMatchObject({
      code: 'PROVIDER_UNAVAILABLE',
    })
    await expect(
      database.transaction((connection) =>
        auth.signInVerified(
          connection,
          'google',
          'existing-provider-subject',
          registration.device,
          registration.anon_id,
        ),
      ),
    ).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE' })
  })
})
