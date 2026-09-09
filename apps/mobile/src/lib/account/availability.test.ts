import { describe, expect, it } from 'vitest'
import { methodNotice, methodUnavailableHint } from './availability'

const ready = {
  configured: true,
  providerStatus: 'ready' as const,
  capabilityStatus: 'ready' as const,
  providerCount: 2,
  emailAvailable: true,
}

describe('account method availability copy', () => {
  it('explains an unconfigured build once, without promising email', () => {
    expect(
      methodNotice({
        ...ready,
        configured: false,
        providerCount: 0,
        emailAvailable: false,
      }),
    ).toBe('unconfigured')
  })

  it('does not call a loading method unavailable', () => {
    expect(
      methodNotice({
        ...ready,
        providerStatus: 'loading',
        capabilityStatus: 'loading',
        providerCount: 0,
        emailAvailable: false,
      }),
    ).toBe('checking')
    expect(methodUnavailableHint({ busy: false, ready: false, available: false })).toBe(false)
    expect(methodUnavailableHint({ busy: true, ready: true, available: false })).toBe(false)
    expect(methodUnavailableHint({ busy: false, ready: true, available: false })).toBe(true)
  })

  it('keeps a provider outage distinct from every method being down', () => {
    expect(methodNotice({ ...ready, providerCount: 0 })).toBe('providersUnavailable')
    expect(
      methodNotice({
        ...ready,
        providerCount: 0,
        emailAvailable: false,
      }),
    ).toBe('allUnavailable')
  })

  it('prefers a discovery error over an empty-method summary', () => {
    expect(
      methodNotice({
        ...ready,
        providerStatus: 'error',
        providerCount: 0,
        emailAvailable: false,
      }),
    ).toBe('discoveryError')
  })
})
