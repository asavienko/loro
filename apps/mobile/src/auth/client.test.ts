import { describe, expect, it, vi } from 'vitest'
import { AccountClient, type AuthPorts } from './client'
const verifier = 'v'.repeat(43),
  ticket = 't'.repeat(43),
  state = 's'.repeat(43)
const session = {
  access_token: 'signed-token',
  refresh_token: 'r'.repeat(43),
  expires_in: 900,
  user: { id: 'e72087c7-5015-492b-8c23-ad8b54aff305', provider: 'google' },
}
function setup() {
  const request = vi.fn((path: string): Promise<unknown> =>
    Promise.resolve(
      path.endsWith('/start')
        ? { authorization_url: 'https://accounts.google.com/auth', state }
        : session,
    ),
  )
  const ports: AuthPorts = {
    request,
    read: vi.fn(() => Promise.resolve(null)),
    write: vi.fn(() => Promise.resolve(undefined)),
    random: () => verifier,
    challenge: () => Promise.resolve('c'.repeat(43)),
    authorize: vi.fn(() => Promise.resolve(`loro://account?ticket=${ticket}&state=${state}`)),
    redirect: 'loro://account',
  }
  return { ports, request, client: new AccountClient(ports) }
}
describe('account lifecycle', () => {
  it('exchanges only a matching callback and stores only refresh securely', async () => {
    const { client, ports, request } = setup()
    expect(await client.signIn('google')).toBe('signedIn')
    expect(request).toHaveBeenLastCalledWith('/auth/exchange', { ticket, code_verifier: verifier })
    expect(ports.write).toHaveBeenCalledWith(session.refresh_token)
    expect(client.session?.user).toEqual(session.user)
  })
  it.each([
    null,
    'loro://account?error=denied',
    'loro://account?state=wrong&ticket=t',
    'https://evil.example?state=' + state,
  ])('handles cancelled/mismatched callback %s', async (callback) => {
    const { client, ports, request } = setup()
    ports.authorize = () => Promise.resolve(callback)
    if (callback === null) expect(await client.signIn('apple')).toBe('cancelled')
    else await expect(client.signIn('apple')).rejects.toThrow()
    expect(request).toHaveBeenCalledTimes(1)
    expect(ports.write).not.toHaveBeenCalled()
  })
  it('single-flights refresh, erases consumed credential before network, and never retries uncertain refresh', async () => {
    const { client, ports, request } = setup()
    await client.signIn('google')
    request.mockImplementation(() => {
      expect(ports.write).toHaveBeenLastCalledWith(null)
      return Promise.reject(new Error('offline'))
    })
    const results = await Promise.allSettled([client.refresh(), client.refresh()])
    expect(results.every((r) => r.status === 'rejected')).toBe(true)
    expect(request.mock.calls.filter(([path]) => path === '/auth/refresh')).toHaveLength(1)
    expect(client.session).toBeNull()
    await client.refresh()
    expect(request.mock.calls.filter(([path]) => path === '/auth/refresh')).toHaveLength(1)
  })
  it('signs out locally even offline and reports unconfirmed revocation', async () => {
    const { client, ports, request } = setup()
    await client.signIn('google')
    request.mockRejectedValue(new Error('offline'))
    expect(await client.signOut()).toBe(false)
    expect(client.session).toBeNull()
    expect(ports.write).toHaveBeenLastCalledWith(null)
  })
  it('does not accept a session if secure storage fails', async () => {
    const { client, ports, request } = setup()
    ports.write = () => Promise.reject(new Error('keychain locked'))
    await expect(client.signIn('google')).rejects.toThrow()
    expect(client.session).toBeNull()
    expect(request).toHaveBeenLastCalledWith('/auth/logout', {
      refresh_token: session.refresh_token,
    })
  })
  it('restores by rotating the saved refresh instead of trusting local identity data', async () => {
    const { client, ports, request } = setup()
    ports.read = () => Promise.resolve(session.refresh_token)
    await client.restore()
    expect(request).toHaveBeenCalledWith('/auth/refresh', { refresh_token: session.refresh_token })
    expect(client.session?.user).toEqual(session.user)
  })
  it('single-flights restore when Account mounts twice', async () => {
    const { client, ports, request } = setup()
    ports.read = () => Promise.resolve(session.refresh_token)
    await Promise.all([client.restore(), client.restore()])
    expect(request.mock.calls.filter(([path]) => path === '/auth/refresh')).toHaveLength(1)
  })
})
