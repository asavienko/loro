import { afterEach, describe, expect, it, vi } from 'vitest'
import { anonymousPrincipal, isGetLeafPath, requestAddress } from './http.js'

describe('isGetLeafPath', () => {
  it('accepts the exact leaf and a versioned prefix', () => {
    expect(isGetLeafPath({ method: 'GET', path: '/tts/status' }, 'tts/status')).toBe(true)
    expect(isGetLeafPath({ method: 'GET', path: '/v1/music/status' }, 'music/status')).toBe(true)
  })

  it('rejects a bare leaf, another method, or a query-only match', () => {
    expect(isGetLeafPath({ method: 'GET', path: '/status' }, 'tts/status')).toBe(false)
    expect(isGetLeafPath({ method: 'POST', path: '/tts/status' }, 'tts/status')).toBe(false)
    expect(isGetLeafPath({ method: 'GET', url: '/tts/status?ready=1' }, 'tts/status')).toBe(true)
  })
})

describe('anonymousPrincipal', () => {
  it('scopes the user id to the transport peer', () => {
    expect(anonymousPrincipal('203.0.113.4')).toEqual({
      userId: 'anon:203.0.113.4',
      deviceId: 'anonymous',
      sessionId: 'anonymous',
    })
  })
})

describe('requestAddress', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  const behindNginx = (peer: string, realIp?: string | string[]) => ({
    socket: { remoteAddress: peer },
    headers: realIp === undefined ? {} : { 'x-real-ip': realIp },
  })

  it('prefers the socket peer over request.ip', () => {
    expect(requestAddress({ ip: '203.0.113.4', socket: { remoteAddress: '198.51.100.8' } })).toBe(
      '198.51.100.8',
    )
    expect(requestAddress({})).toBe('unknown')
  })

  it('ignores X-Real-IP unless TRUST_PROXY says the API is behind the proxy', () => {
    vi.stubEnv('TRUST_PROXY', '')
    expect(requestAddress(behindNginx('172.17.0.1', '203.0.113.4'))).toBe('172.17.0.1')
    vi.stubEnv('TRUST_PROXY', 'true')
    expect(requestAddress(behindNginx('172.17.0.1', '203.0.113.4'))).toBe('172.17.0.1')
    vi.stubEnv('TRUST_PROXY', '1')
    expect(requestAddress(behindNginx('172.17.0.1', '203.0.113.4'))).toBe('203.0.113.4')
  })

  it('takes the proxy’s X-Real-IP from a loopback or Docker-bridge peer', () => {
    for (const peer of ['127.0.0.1', '::1', '172.17.0.1', '::ffff:172.18.0.1', '192.168.16.1'])
      expect(requestAddress(behindNginx(peer, '203.0.113.4'), true), peer).toBe('203.0.113.4')
    expect(requestAddress(behindNginx('10.0.0.5', '2001:db8::7'), true)).toBe('2001:db8::7')
  })

  it('never takes it from a public peer, or when it isn’t one address', () => {
    for (const peer of ['198.51.100.8', '::ffff:198.51.100.8', '2001:db8::1', '172.32.0.1'])
      expect(requestAddress(behindNginx(peer, '203.0.113.4'), true), peer).toBe(peer)
    for (const realIp of ['', 'evil', '203.0.113.4, 198.51.100.1', ['203.0.113.4', '1.2.3.4']])
      expect(requestAddress(behindNginx('172.17.0.1', realIp), true)).toBe('172.17.0.1')
    expect(requestAddress(behindNginx('172.17.0.1'), true)).toBe('172.17.0.1')
  })
})
