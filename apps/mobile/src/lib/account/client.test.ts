import { describe, expect, it, vi } from 'vitest'
import { AccountClient, type CredentialVault } from './client'
const installation = '01900000-0000-7000-8000-000000000001'
const signedIn = {
  access_token: 'access',
  refresh_token: 'refresh',
  expires_in: 900,
  device_id: 'device-1',
  user: { id: 'user-1', created_at: 100 },
  claim: { performed: true, mode: 'bind', claim_id: 'claim-1', upload_required: true },
}
function setup() {
  let saved: string | null = null
  let now = 1000
  const vault: CredentialVault = {
    read: () => Promise.resolve(saved),
    write: (value) => {
      saved = value
      return Promise.resolve()
    },
    clear: () => {
      saved = null
      return Promise.resolve()
    },
  }
  const fetch = vi.fn<typeof globalThis.fetch>()
  const bindAccount = vi.fn<(id: string) => void>()
  const deps = {
    baseUrl: 'https://api.example/v1',
    device: { installation_id: installation, platform: 'web' as const, app_version: '0.0.0' },
    anonId: installation,
    vault,
    now: () => now,
    bindAccount,
    fetch,
  }
  const client = new AccountClient(deps)
  return {
    client,
    deps,
    vault,
    fetch,
    bindAccount,
    saved: () => saved,
    advance: () => {
      now += 900_000
    },
  }
}
const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 })
describe('anonymous-first account lifecycle', () => {
  it('starts without any network request and requests a code without exposing existence', async () => {
    const { client, fetch } = setup()
    expect(client.getSnapshot().session).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
    fetch.mockResolvedValue(ok({ status: 'accepted' }))
    await client.requestCode(' learner@example.com ')
    expect(client.getSnapshot().status).toBe('code-sent')
    expect(fetch.mock.calls[0]?.[1]?.body).toBe(JSON.stringify({ email: 'learner@example.com' }))
  })
  it('stores refresh credentials before publishing a verified account', async () => {
    const { client, fetch, saved, bindAccount } = setup()
    fetch.mockResolvedValue(ok(signedIn))
    await client.verifyCode('learner@example.com', '123456')
    expect(client.getSnapshot().session?.accountId).toBe('user-1')
    expect(bindAccount).toHaveBeenCalledWith('user-1')
    expect(saved()).toContain('refresh')
    expect(saved()).not.toContain('access_token')
    expect(await client.getAccessToken()).toBe('access')
  })
  it('retains offline account identity after native credential restore', async () => {
    const { client, deps, fetch } = setup()
    fetch.mockResolvedValue(ok(signedIn))
    await client.verifyCode('learner@example.com', '123456')
    const relaunched = new AccountClient(deps)
    await relaunched.restore()
    expect(relaunched.getSnapshot().session?.accountId).toBe('user-1')
    expect(fetch).toHaveBeenCalledTimes(1)
  })
  it('rejects an account switch before exposing credentials or uploading data', async () => {
    const { client, fetch, bindAccount, saved } = setup()
    bindAccount.mockImplementation(() => {
      throw new Error('different owner')
    })
    fetch.mockResolvedValue(ok(signedIn))
    await client.verifyCode('learner@example.com', '123456')
    expect(client.getSnapshot().error).toBe('account-mismatch')
    expect(client.getSnapshot().session).toBeNull()
    expect(saved()).toBeNull()
  })
  it('does not reuse a token after an ambiguous refresh failure', async () => {
    const { client, fetch, saved, advance } = setup()
    fetch.mockResolvedValueOnce(ok(signedIn)).mockRejectedValueOnce(new Error('offline'))
    await client.verifyCode('learner@example.com', '123456')
    advance()
    expect(await client.getAccessToken()).toBeNull()
    expect(await client.getAccessToken()).toBeNull()
    expect(saved()).toBeNull()
    expect(fetch).toHaveBeenCalledTimes(2)
  })
  it('serializes concurrent refresh requests', async () => {
    const { client, fetch, advance } = setup()
    fetch
      .mockResolvedValueOnce(ok(signedIn))
      .mockResolvedValueOnce(
        ok({ access_token: 'next', refresh_token: 'rotated', expires_in: 900 }),
      )
    await client.verifyCode('learner@example.com', '123456')
    advance()
    expect(await Promise.all([client.getAccessToken(), client.getAccessToken()])).toEqual([
      'next',
      'next',
    ])
    expect(fetch).toHaveBeenCalledTimes(2)
  })
  it('ignores a sign-in result arriving after sign-out', async () => {
    const { client, fetch, saved } = setup()
    let finish!: (response: Response) => void
    fetch.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    const pending = client.verifyCode('learner@example.com', '123456')
    await client.signOut()
    finish(ok(signedIn))
    await pending
    expect(client.getSnapshot().session).toBeNull()
    expect(saved()).toBeNull()
  })
  it('clears stale keychain credentials belonging to a removed installation', async () => {
    const { deps, vault } = setup()
    await vault.write(
      JSON.stringify({
        installationId: 'old',
        accountId: 'user',
        deviceId: 'device',
        refreshToken: 'old-secret',
      }),
    )
    const client = new AccountClient(deps)
    await client.restore()
    expect(await vault.read()).toBeNull()
    expect(client.getSnapshot().session).toBeNull()
  })
  it('never follows credential-post redirects', async () => {
    const { client, fetch } = setup()
    fetch.mockResolvedValue(ok({ status: 'accepted' }))
    await client.requestCode('learner@example.com')
    expect(fetch.mock.calls[0]?.[1]).toMatchObject({
      redirect: 'error',
      credentials: 'omit',
      cache: 'no-store',
    })
  })
  it('revokes the device session after clearing local sign-in', async () => {
    const { client, fetch, saved } = setup()
    fetch
      .mockResolvedValueOnce(ok(signedIn))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    await client.verifyCode('learner@example.com', '123456')
    await client.signOut()
    expect(client.getSnapshot().session).toBeNull()
    expect(saved()).toBeNull()
    expect(fetch.mock.calls[1]?.[0]).toBe('https://api.example/v1/auth/logout')
    expect(fetch.mock.calls[1]?.[1]?.headers).toMatchObject({
      Authorization: 'Bearer access',
      'X-Loro-Device': 'device-1',
    })
  })
  it('keeps restored credentials while offline and refreshes after reconnection', async () => {
    const { client, deps, fetch, saved } = setup()
    fetch.mockResolvedValueOnce(ok(signedIn))
    await client.verifyCode('learner@example.com', '123456')
    let online = false
    const restored = new AccountClient({ ...deps, isOnline: () => Promise.resolve(online) })
    await restored.restore()
    expect(await restored.getAccessToken()).toBeNull()
    expect(restored.getSnapshot().session?.accountId).toBe('user-1')
    expect(saved()).toContain('refresh')
    expect(fetch).toHaveBeenCalledTimes(1)
    online = true
    fetch.mockResolvedValueOnce(
      ok({ access_token: 'next', refresh_token: 'rotated', expires_in: 900 }),
    )
    expect(await restored.getAccessToken()).toBe('next')
  })
})
