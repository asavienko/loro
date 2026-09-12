import { describe, expect, it } from 'vitest'
import {
  isAllowedAuthRedirect,
  isAllowedMagicDeliveryUrl,
  LOCAL_INBOX_DELIVERY,
} from './settings.js'

describe('isAllowedAuthRedirect', () => {
  it('allows only the two registered native application callbacks', () => {
    expect(isAllowedAuthRedirect('loro://account')).toBe(true)
    expect(isAllowedAuthRedirect('loro-dev://account')).toBe(true)
    expect(isAllowedAuthRedirect('loro-other://account')).toBe(false)
  })

  it('keeps callback URLs exact', () => {
    expect(isAllowedAuthRedirect('loro-dev://account?ticket=one')).toBe(false)
    expect(isAllowedAuthRedirect('https://app.example.test/account')).toBe(true)
    expect(isAllowedAuthRedirect('https://app.example.test/account#fragment')).toBe(false)
  })

  it('allows HTTPS delivery and loopback HTTP only in development', () => {
    expect(isAllowedMagicDeliveryUrl('https://delivery.example.test/send')).toBe(true)
    expect(isAllowedMagicDeliveryUrl('http://127.0.0.1:8787/send')).toBe(true)
    expect(isAllowedMagicDeliveryUrl('http://127.0.0.1:8787/send', true)).toBe(false)
    expect(isAllowedMagicDeliveryUrl('http://evil.example/send')).toBe(false)
    expect(isAllowedMagicDeliveryUrl('https://user:pass@delivery.example.test/send')).toBe(false)
    expect(isAllowedMagicDeliveryUrl(LOCAL_INBOX_DELIVERY)).toBe(true)
    expect(isAllowedMagicDeliveryUrl(LOCAL_INBOX_DELIVERY, true)).toBe(true)
    expect(isAllowedMagicDeliveryUrl('inbox:remote')).toBe(false)
  })

  it('allows loopback HTTP for local web sign-in', () => {
    expect(isAllowedAuthRedirect('http://localhost:8081/account')).toBe(true)
    expect(isAllowedAuthRedirect('http://127.0.0.1:8081/account')).toBe(true)
    expect(isAllowedAuthRedirect('http://[::1]:8081/account')).toBe(true)
    expect(isAllowedAuthRedirect('http://localhost:8081/account?ticket=one')).toBe(false)
    expect(isAllowedAuthRedirect('http://evil.example/account')).toBe(false)
  })
})
