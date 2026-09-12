import { describe, expect, it } from 'vitest'
import { LoroError } from '../common/errors.js'
import { assertDeviceHeader } from './device-header.js'

const principal = { userId: 'user-a', deviceId: 'device-a', sessionId: 'session-a' }

describe('assertDeviceHeader', () => {
  it('allows a matching or omitted device header', () => {
    expect(() => {
      assertDeviceHeader(principal, undefined)
    }).not.toThrow()
    expect(() => {
      assertDeviceHeader(principal, 'device-a')
    }).not.toThrow()
  })

  it('rejects another installation id', () => {
    expect(() => {
      assertDeviceHeader(principal, 'device-b')
    }).toThrow(LoroError)
  })
})
