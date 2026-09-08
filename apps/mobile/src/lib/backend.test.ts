import { describe, expect, it, vi } from 'vitest'
import { checkBackend, configuredApiUrl, requestWithTimeout } from './backend'

describe('backend connection', () => {
  it('works without AbortSignal.timeout on the native runtime', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => {
      throw new Error('not available on RN 0.81')
    })
    try {
      const request = vi
        .fn<typeof fetch>()
        .mockResolvedValue(Response.json({ status: 'ok', checks: { content: 'ok', merge: 'ok' } }))
      expect(await checkBackend('https://api.test/v1', request)).toBe('connected')
    } finally {
      timeout.mockRestore()
    }
  })
  it('aborts a stalled native request and clears its timer', async () => {
    vi.useFakeTimers()
    try {
      const request = vi.fn<typeof fetch>(
        (_url, init) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => {
              reject(new Error('aborted'))
            })
          }),
      )
      const pending = expect(
        requestWithTimeout('https://api.test/v1', {}, request, 100),
      ).rejects.toThrow('aborted')
      await vi.advanceTimersByTimeAsync(100)
      await pending
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })
  it.each([
    'http://api.test/v1',
    'https://user:secret@api.test/v1',
    'https://api.test',
    'https://api.test/v1?key=secret',
    'https://api.test/v1#secret',
    'invalid',
    undefined,
  ])('rejects unusable API configuration %s', (url) => {
    expect(configuredApiUrl(url)).toBeUndefined()
  })
  it('normalizes the versioned HTTPS endpoint', () => {
    expect(configuredApiUrl('https://api.test/v1/')).toBe('https://api.test/v1')
  })
  it('does not send a request without configuration', async () => {
    const request = vi.fn<typeof fetch>()
    expect(await checkBackend(undefined, request)).toBe('unconfigured')
    expect(request).not.toHaveBeenCalled()
  })
  it.each([
    [{ status: 'ok', checks: { content: 'ok', merge: 'ok' } }, 200, 'connected'],
    [{ status: 'degraded', checks: { content: 'ok', merge: 'unavailable' } }, 200, 'unavailable'],
    [{ status: 'ok' }, 200, 'unavailable'],
    [{ status: 'ok', checks: { content: 'ok', merge: 'ok' } }, 503, 'unavailable'],
  ] as const)(
    'validates readiness rather than only HTTP status',
    async (body, status, expected) => {
      const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json(body, { status }))
      expect(await checkBackend('https://api.test/v1', request)).toBe(expected)
    },
  )
  it('degrades on network failure without affecting local practice', async () => {
    const request = vi.fn<typeof fetch>().mockRejectedValue(new Error('offline'))
    expect(await checkBackend('https://api.test/v1', request)).toBe('unavailable')
  })
})
