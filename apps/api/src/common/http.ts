/**
 * HTTP request helpers shared by guards and controllers.
 *
 * Status-path matching and anonymous principals used to be copied between the
 * music and TTS guards. One helper keeps the leaf test and the `anon:<ip>`
 * identity the same for every anonymous spend path.
 */

export interface RequestPath {
  method?: string
  path?: string
  url?: string
}

export interface AnonymousPrincipal {
  userId: string
  deviceId: string
  sessionId: string
}

/** True only for GET of `/{leaf}` or a prefixed `…/{leaf}`, ignoring query strings. */
export function isGetLeafPath(request: RequestPath, leaf: string): boolean {
  if (request.method?.toUpperCase() !== 'GET') return false
  const raw = `${request.path ?? ''} ${request.url ?? ''}`
  const path = raw.split(/[?#\s]/).find((part) => part.length > 0) ?? ''
  return path === `/${leaf}` || path.endsWith(`/${leaf}`)
}

/** Isolates anonymous spend by transport peer. A presented bearer still wins. */
export function anonymousPrincipal(ip: string): AnonymousPrincipal {
  return {
    userId: `anon:${ip}`,
    deviceId: 'anonymous',
    sessionId: 'anonymous',
  }
}

/** Transport peer only. Forwarded headers cannot bypass auth limits. */
export function requestAddress(request: {
  ip?: string
  socket?: { remoteAddress?: string }
}): string {
  return request.socket?.remoteAddress ?? request.ip ?? 'unknown'
}
