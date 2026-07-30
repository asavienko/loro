import { describe, expect, it } from 'vitest'
import { resolveDevToolsAvailability } from './gate'

describe('developer-tools gate', () => {
  it('enables developer surfaces in development builds', () => {
    expect(resolveDevToolsAvailability({ isDevelopmentBuild: true })).toBe('available')
  })

  it('makes developer surfaces unavailable in production builds', () => {
    expect(resolveDevToolsAvailability({ isDevelopmentBuild: false })).toBe('unavailable')
  })
})
