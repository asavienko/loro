import {
  MAX_SYNC_BYTES,
  PullRequestSchema,
  PullResponseSchema,
  PushRequestSchema,
  PushResponseSchema,
} from '@loro/core/api/sync'
import { SyncError, type SyncSession, type SyncTransport } from './types'
import { utf8ByteLength } from './codec'

export function createHttpSyncTransport(options: {
  baseUrl: string
  getAccessToken: () => Promise<string | null>
  getSession: () => SyncSession | null
  fetch?: typeof globalThis.fetch
}): SyncTransport {
  const url = new URL(options.baseUrl)
  if (
    url.protocol !== 'https:' &&
    !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname))
  ) {
    throw new SyncError('INSECURE_TRANSPORT')
  }
  if (url.username || url.password || url.search || url.hash)
    throw new SyncError('INVALID_BASE_URL')
  const fetcher = options.fetch ?? globalThis.fetch
  async function post(path: string, body: unknown, session: SyncSession): Promise<unknown> {
    const token = await options.getAccessToken()
    if (!token) throw new SyncError('UNAUTHENTICATED')
    const current = options.getSession()
    if (current?.accountId !== session.accountId || current.deviceId !== session.deviceId) {
      throw new SyncError('ACCOUNT_CHANGED')
    }
    const serialized = JSON.stringify(body)
    if (utf8ByteLength(serialized) > MAX_SYNC_BYTES) throw new SyncError('PAYLOAD_TOO_LARGE')
    const controller = new AbortController()
    const timer = setTimeout(() => {
      controller.abort()
    }, 20_000)
    try {
      const response = await fetcher(`${options.baseUrl.replace(/\/$/, '')}/sync/${path}`, {
        method: 'POST',
        redirect: 'error',
        credentials: 'omit',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Loro-App': '0.0.0+1',
          'X-Loro-Device': session.deviceId,
        },
        body: serialized,
      })
      const payload: unknown = await response.json()
      if (!response.ok) {
        const code =
          payload &&
          typeof payload === 'object' &&
          'code' in payload &&
          typeof payload.code === 'string'
            ? payload.code
            : response.status === 401
              ? 'UNAUTHENTICATED'
              : `HTTP_${response.status}`
        const retry = Number(response.headers.get('Retry-After'))
        throw new SyncError(code, Number.isFinite(retry) && retry > 0 ? retry * 1000 : 0)
      }
      return payload
    } finally {
      clearTimeout(timer)
    }
  }
  return {
    push: async (request, session) =>
      PushResponseSchema.parse(await post('push', PushRequestSchema.parse(request), session)),
    pull: async (request, session) =>
      PullResponseSchema.parse(await post('pull', PullRequestSchema.parse(request), session)),
  }
}
