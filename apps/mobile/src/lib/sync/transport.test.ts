import { describe, expect, it, vi } from 'vitest'
import { createHttpSyncTransport } from './transport'
import type { SyncSession } from './types'

const session: SyncSession = { accountId: 'account1', deviceId: 'device1' }
const body = { client_hlc: '1000:0001:device1', ops: [] }
const result = {
  accepted: [],
  rejected: [],
  conflicts: [],
  server_hlc: '2000:0000:server',
  server_time: 2000,
}

describe('authenticated sync transport', () => {
  it('sends only versioned schemas over a bearer-bound nonredirecting request', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(result)))
    const transport = createHttpSyncTransport({
      baseUrl: 'https://example.test/v1',
      getAccessToken: () => Promise.resolve('access'),
      getSession: () => session,
      fetch: fetcher,
    })
    expect(await transport.push(body, session)).toEqual(result)
    expect(fetcher).toHaveBeenCalledWith(
      'https://example.test/v1/sync/push',
      expect.objectContaining({
        redirect: 'error',
        credentials: 'omit',
        headers: expect.objectContaining({
          Authorization: 'Bearer access',
          'X-Loro-Device': 'device1',
        }),
      }),
    )
  })
  it('does not send old-account payloads after credential acquisition switches account', async () => {
    let current = session
    const fetcher = vi.fn<typeof fetch>()
    const transport = createHttpSyncTransport({
      baseUrl: 'https://example.test/v1',
      getAccessToken: () => {
        current = { ...session, accountId: 'account2' }
        return Promise.resolve('new-account-token')
      },
      getSession: () => current,
      fetch: fetcher,
    })
    await expect(transport.push(body, session)).rejects.toThrow('ACCOUNT_CHANGED')
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('retains structured retry hints and rejects malformed successful responses', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: 'RATE_LIMITED' }), {
          status: 429,
          headers: { 'Retry-After': '30' },
        }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ accepted: [1] })))
    const transport = createHttpSyncTransport({
      baseUrl: 'https://example.test/v1',
      getAccessToken: () => Promise.resolve('access'),
      getSession: () => session,
      fetch: fetcher,
    })
    await expect(transport.push(body, session)).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      retryAfterMs: 30000,
    })
    await expect(transport.push(body, session)).rejects.toThrow()
  })
  it('permits local development HTTP and refuses insecure remote credentials', () => {
    const options = { getAccessToken: () => Promise.resolve('access'), getSession: () => session }
    expect(() =>
      createHttpSyncTransport({ ...options, baseUrl: 'http://localhost:3000/v1' }),
    ).not.toThrow()
    expect(() =>
      createHttpSyncTransport({ ...options, baseUrl: 'http://example.test/v1' }),
    ).toThrow('INSECURE_TRANSPORT')
  })
})
