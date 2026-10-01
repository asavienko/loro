/**
 * HTTP request helpers shared by guards and controllers.
 *
 * Status-path matching and anonymous principals used to be copied between the
 * music and TTS guards. One helper keeps the leaf test and the `anon:<ip>`
 * identity the same for every anonymous spend path.
 */

import { BlockList, isIP } from 'node:net'
import { config } from './config.js'

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

/**
 * Where a proxy in front of the API connects from: loopback, or a private network. On the EC2 host
 * nginx reaches the container through Docker's port publishing, so the peer is the Docker bridge's
 * gateway (172.16.0.0/12 or 192.168.0.0/16), not 127.0.0.1.
 */
const PROXY_PEERS = new BlockList()
PROXY_PEERS.addSubnet('127.0.0.0', 8)
PROXY_PEERS.addSubnet('10.0.0.0', 8)
PROXY_PEERS.addSubnet('172.16.0.0', 12)
PROXY_PEERS.addSubnet('192.168.0.0', 16)
PROXY_PEERS.addAddress('::1', 'ipv6')
PROXY_PEERS.addSubnet('fc00::', 7, 'ipv6')

function isProxyPeer(address: string): boolean {
  const plain = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address)?.[1] ?? address
  const family = isIP(plain)
  return family !== 0 && PROXY_PEERS.check(plain, family === 4 ? 'ipv4' : 'ipv6')
}

/**
 * The address auth limits are keyed on: the transport peer. Only when the API is told it sits behind
 * Loro's proxy (`TRUST_PROXY=1`) and the peer is a loopback or private-network address is the
 * `X-Real-IP` that proxy sets taken instead, so learners behind the gateway don't share one bucket.
 * Otherwise forwarded headers cannot bypass auth limits.
 */
export function requestAddress(
  request: {
    ip?: string | undefined
    socket?: { remoteAddress?: string | undefined } | undefined
    headers?: Record<string, string | string[] | undefined> | undefined
  },
  trustProxy = config.trustProxy(),
): string {
  const peer = request.socket?.remoteAddress ?? request.ip ?? 'unknown'
  if (!trustProxy || !isProxyPeer(peer)) return peer
  const real = request.headers?.['x-real-ip']
  return typeof real === 'string' && isIP(real) !== 0 ? real : peer
}
