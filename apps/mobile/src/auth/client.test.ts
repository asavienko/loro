import { describe, expect, it, vi } from 'vitest'
import { authorizeProvider, type AuthPorts } from './client'
const verifier = 'v'.repeat(43),
  ticket = 't'.repeat(43),
  state = 's'.repeat(43)
function setup() {
  const request = vi.fn(() =>
    Promise.resolve({ authorization_url: 'https://accounts.google.com/auth', state }),
  )
  const ports: AuthPorts = {
    request,
    random: () => verifier,
    challenge: () => Promise.resolve('c'.repeat(43)),
    authorize: vi.fn(() => Promise.resolve(`loro://account?ticket=${ticket}&state=${state}`)),
    redirect: 'loro://account',
    isCurrent: () => true,
  }
  return { ports, request }
}
describe('provider authorization proof', () => {
  it('returns an exchange proof only after matching PKCE state and redirect', async () => {
    const { ports, request } = setup()
    expect(await authorizeProvider('google', ports)).toEqual({ ticket, code_verifier: verifier })
    expect(request).toHaveBeenCalledWith('/auth/google/start', {
      redirect_uri: 'loro://account',
      code_challenge: 'c'.repeat(43),
    })
  })
  it.each([
    null,
    'loro://account?error=denied',
    'loro://account?state=wrong&ticket=t',
    `https://evil.example?state=${state}`,
    `loro://other?state=${state}&ticket=${ticket}`,
  ])('handles cancelled or mismatched callback %s', async (callback) => {
    const { ports, request } = setup()
    ports.authorize = () => Promise.resolve(callback)
    if (callback === null) expect(await authorizeProvider('apple', ports)).toBeNull()
    else await expect(authorizeProvider('apple', ports)).rejects.toThrow()
    expect(request).toHaveBeenCalledTimes(1)
  })
  it('does not open the provider browser after sign-out invalidates a pending start', async () => {
    const { ports } = setup()
    ports.isCurrent = () => false
    expect(await authorizeProvider('google', ports)).toBeNull()
    expect(ports.authorize).not.toHaveBeenCalled()
  })
})
