import { describe, expect, it } from 'vitest'
import { shouldKeepMountedRoutes } from './persistenceGateState'

describe('persistence recovery', () => {
  it('keeps ready routes mounted while a later write failure is retried', () => {
    expect(shouldKeepMountedRoutes('opening', false)).toBe(false)
    expect(shouldKeepMountedRoutes('ready', true)).toBe(true)
    expect(shouldKeepMountedRoutes('error', true)).toBe(true)
    expect(shouldKeepMountedRoutes('opening', true)).toBe(true)
  })
})
