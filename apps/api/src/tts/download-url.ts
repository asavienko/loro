import { config } from '../common/config.js'

function headerString(
  headers: Record<string, unknown> | undefined,
  name: string,
): string | undefined {
  const value = headers?.[name] ?? headers?.[name.toLowerCase()]
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (Array.isArray(value) && typeof value[0] === 'string' && value[0].trim())
    return value[0].trim()
  return undefined
}

/** Prefer AUTH_PUBLIC_URL; otherwise echo the caller Host so emulator/LAN URLs stay reachable. */
export function ttsDownloadOrigin(request?: {
  protocol?: string
  headers?: Record<string, unknown>
}): string {
  const configured = config.publicUrl()
  if (configured) return configured.replace(/\/$/, '')
  const host = headerString(request?.headers, 'host')
  if (host) {
    const forwarded = headerString(request?.headers, 'x-forwarded-proto')?.split(',')[0]?.trim()
    const proto = forwarded ?? request?.protocol ?? 'http'
    return `${proto}://${host}`
  }
  if (!config.isProduction()) {
    return `http://127.0.0.1:${config.listenPort()}`
  }
  return config.authIssuer().replace(/\/$/, '')
}

export function ttsAssetUrl(sha256: string, publicOrigin?: string): string {
  return `${(publicOrigin ?? ttsDownloadOrigin()).replace(/\/$/, '')}/v1/tts/assets/${sha256}`
}
