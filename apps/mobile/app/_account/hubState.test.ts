import { describe, expect, it } from 'vitest'
import { appleMethodLabel, googleMethodLabel, resolveHubTone } from './hubState'

describe('resolveHubTone', () => {
  it('prefers connecting, then social-down, then the last outcome', () => {
    expect(
      resolveHubTone({
        busy: true,
        activeProvider: 'google',
        socialUnavailable: true,
        outcome: 'error',
      }),
    ).toBe('connecting')
    expect(
      resolveHubTone({
        busy: false,
        activeProvider: null,
        socialUnavailable: true,
        outcome: 'cancelled',
      }),
    ).toBe('unavailable')
    expect(
      resolveHubTone({
        busy: false,
        activeProvider: null,
        socialUnavailable: false,
        outcome: 'error',
      }),
    ).toBe('error')
    expect(
      resolveHubTone({
        busy: false,
        activeProvider: null,
        socialUnavailable: false,
        outcome: 'cancelled',
      }),
    ).toBe('cancelled')
    expect(
      resolveHubTone({
        busy: false,
        activeProvider: null,
        socialUnavailable: false,
        outcome: 'idle',
      }),
    ).toBe('idle')
  })
})

describe('method labels', () => {
  it('retargets Google and Apple after cancel or error', () => {
    const google = {
      idle: 'Continue with Google',
      cancelled: 'Try again with Google',
      error: 'Retry Google Sign-in',
      connecting: 'Connecting to Google…',
    }
    expect(googleMethodLabel('idle', google)).toBe(google.idle)
    expect(googleMethodLabel('cancelled', google)).toBe(google.cancelled)
    expect(googleMethodLabel('error', google)).toBe(google.error)
    expect(googleMethodLabel('connecting', google)).toBe(google.connecting)
    expect(appleMethodLabel('error', { idle: 'Continue with Apple', error: 'Try with Apple instead' })).toBe(
      'Try with Apple instead',
    )
    expect(appleMethodLabel('idle', { idle: 'Continue with Apple', error: 'Try with Apple instead' })).toBe(
      'Continue with Apple',
    )
  })
})
