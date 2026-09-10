/**
 * `GET /tts/status` is public so clients can hide play until ElevenLabs is ready.
 * Catalog reference and listening-class render/asset may omit a bearer when
 * `TTS_PROVIDER=elevenlabs` so web and APK can play without a session.
 * `TTS_STUB_RENDER=1` may render listening-class silence without a bearer;
 * catalog still 503 in stub mode.
 */

import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common'
import { LISTENING_ASSET_CLASS, REFERENCE_ASSET_CLASS } from '@loro/core'
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard.js'
import { config } from '../common/config.js'
import { parseTtsConfig } from '../integrations/elevenlabs/tts.js'

const STUB_LOCAL_PRINCIPAL = {
  userId: 'stub-local',
  deviceId: 'stub-local',
  sessionId: 'stub-local',
} as const

@Injectable()
export class TtsGuard implements CanActivate {
  constructor(@Inject(AuthGuard) private readonly auth: AuthGuard) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    if (ttsStatusAllowed(request)) return true
    if (stubListeningAnonymousAllowed(request)) {
      request.principal = { ...STUB_LOCAL_PRINCIPAL }
      return true
    }
    if (catalogReferenceAnonymousAllowed(request)) {
      const ip = request.ip ?? '0.0.0.0'
      request.principal = {
        userId: `anon:${ip}`,
        deviceId: 'anonymous',
        sessionId: 'anonymous',
      }
      return true
    }
    return this.auth.canActivate(context)
  }
}

export function ttsStatusAllowed(request: { method?: string; path?: string; url?: string }): boolean {
  if (request.method?.toUpperCase() !== 'GET') return false
  const path = `${request.path ?? ''} ${request.url ?? ''}`
  return path.includes('/tts/status') || /(^|\/)status(\?|$)/.test(path)
}

export function stubListeningAnonymousAllowed(request: {
  method?: string
  params?: { sha256?: string }
  body?: unknown
}): boolean {
  let parsed
  try {
    parsed = parseTtsConfig(config.ttsEnv())
  } catch {
    return false
  }
  if (parsed.provider !== 'stub' || !parsed.stubRender) return false
  const method = request.method?.toUpperCase()
  if (method === 'GET') {
    return typeof request.params?.sha256 === 'string' && request.params.sha256.length > 0
  }
  if (method !== 'POST') return false
  const body = request.body
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return false
  return (body as { asset_class?: unknown }).asset_class === LISTENING_ASSET_CLASS
}

export function catalogReferenceAnonymousAllowed(request: {
  method?: string
  params?: { sha256?: string }
  body?: unknown
}): boolean {
  let parsed
  try {
    parsed = parseTtsConfig(config.ttsEnv())
  } catch {
    return false
  }
  if (parsed.provider !== 'elevenlabs') return false
  const method = request.method?.toUpperCase()
  if (method === 'GET') {
    return typeof request.params?.sha256 === 'string' && request.params.sha256.length > 0
  }
  if (method !== 'POST') return false
  const body = request.body
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return false
  const assetClass = (body as { asset_class?: unknown }).asset_class
  return assetClass === REFERENCE_ASSET_CLASS || assetClass === LISTENING_ASSET_CLASS
}
