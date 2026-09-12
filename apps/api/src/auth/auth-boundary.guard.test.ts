import { describe, expect, it, vi } from 'vitest'
import type { Reflector } from '@nestjs/core'
import type { ExecutionContext } from '@nestjs/common'
import { LoroError } from '../common/errors.js'
import { ACCOUNT_ISOLATION_PENDING } from '../common/account-isolation.js'
import { AuthBoundaryGuard } from './auth-boundary.guard.js'

function unmarkedHandler(): boolean {
  return true
}

function context(): ExecutionContext {
  return {
    getClass: () => unmarkedHandler,
    getHandler: () => unmarkedHandler,
    switchToHttp: () => ({ getRequest: () => ({}) }),
  } as unknown as ExecutionContext
}

describe('AuthBoundaryGuard', () => {
  it('allows unmarked routes while the session engine is on', () => {
    vi.stubEnv('AUTH_SIGNING_KEY', 'test-key-that-is-longer-than-32-bytes')
    const reflector = { getAllAndOverride: vi.fn(() => undefined) }
    const guard = new AuthBoundaryGuard(reflector as unknown as Reflector)
    expect(guard.canActivate(context())).toBe(true)
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ACCOUNT_ISOLATION_PENDING, [
      expect.any(Function),
      expect.any(Function),
    ])
    vi.unstubAllEnvs()
  })

  it('throws the isolation problem only for marked handlers', () => {
    vi.stubEnv('AUTH_SIGNING_KEY', 'test-key-that-is-longer-than-32-bytes')
    const reflector = { getAllAndOverride: vi.fn(() => true) }
    const guard = new AuthBoundaryGuard(reflector as unknown as Reflector)
    expect(() => guard.canActivate(context())).toThrow(LoroError)
    try {
      guard.canActivate(context())
    } catch (error) {
      expect(error).toMatchObject({
        code: 'PROVIDER_UNAVAILABLE',
        message: 'This service is awaiting account isolation.',
      })
    }
    vi.unstubAllEnvs()
  })

  it('does not consult metadata when auth is explicitly off', () => {
    vi.stubEnv('AUTH_ENABLED', 'false')
    vi.stubEnv('AUTH_SIGNING_KEY', 'test-key-that-is-longer-than-32-bytes')
    const reflector = { getAllAndOverride: vi.fn(() => true) }
    const guard = new AuthBoundaryGuard(reflector as unknown as Reflector)
    expect(guard.canActivate(context())).toBe(true)
    expect(reflector.getAllAndOverride).not.toHaveBeenCalled()
    vi.unstubAllEnvs()
  })
})
