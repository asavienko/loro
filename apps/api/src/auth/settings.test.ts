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
})
