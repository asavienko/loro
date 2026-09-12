import { describe, expect, it } from 'vitest'
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
  it('prefers the socket peer over request.ip', () => {
    expect(requestAddress({ ip: '203.0.113.4', socket: { remoteAddress: '198.51.100.8' } })).toBe(
      '198.51.100.8',
    )
    expect(requestAddress({})).toBe('unknown')
  })
})
