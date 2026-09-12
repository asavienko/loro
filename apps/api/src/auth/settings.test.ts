import { describe, expect, it } from 'vitest'
import { isAllowedAuthRedirect } from './settings.js'

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

  it('allows loopback HTTP for local web sign-in', () => {
    expect(isAllowedAuthRedirect('http://localhost:8081/account')).toBe(true)
    expect(isAllowedAuthRedirect('http://127.0.0.1:8081/account')).toBe(true)
    expect(isAllowedAuthRedirect('http://[::1]:8081/account')).toBe(true)
    expect(isAllowedAuthRedirect('http://localhost:8081/account?ticket=one')).toBe(false)
    expect(isAllowedAuthRedirect('http://evil.example/account')).toBe(false)
  })
})
