import { ReadinessSchema } from '@loro/core/api/current'

export type BackendStatus = 'checking' | 'connected' | 'unavailable' | 'unconfigured'
export function configuredApiUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value) return undefined
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash)
      return undefined
    if (!/^\/v1\/?$/.test(url.pathname)) return undefined
    return `${url.origin}/v1`
  } catch {
    return undefined
  }
}
export const apiUrl = configuredApiUrl(process.env.EXPO_PUBLIC_API_URL)

/** RN 0.81's AbortSignal polyfill has no static timeout method. */
export async function requestWithTimeout(
  url: string,
  options: RequestInit,
  request: typeof fetch = fetch,
  timeoutMs = 15_000,
): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => {
    controller.abort()
  }, timeoutMs)
  try {
    return await request(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

/** Health means this API is reachable, never that sign-in or sync is implemented. */
export async function checkBackend(
  api: string | undefined = apiUrl,
  request: typeof fetch = fetch,
): Promise<Exclude<BackendStatus, 'checking'>> {
  if (!api) return 'unconfigured'
  try {
    const response = await requestWithTimeout(
      `${api}/health/ready`,
      {
        credentials: 'omit',
        cache: 'no-store',
        redirect: 'error',
      },
      request,
      10_000,
    )
    if (!response.ok) return 'unavailable'
    const body = ReadinessSchema.parse(await response.json())
    return body.status === 'ok' && body.checks.content === 'ok' && body.checks.merge === 'ok'
      ? 'connected'
      : 'unavailable'
  } catch {
    return 'unavailable'
  }
}
