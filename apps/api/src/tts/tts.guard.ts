/**
 * Licensed ElevenLabs TTS stays authenticated.
 * `TTS_STUB_RENDER=1` with `TTS_PROVIDER=stub` may render listening-class
 * silence and serve its checksum bytes without a bearer so a local device can
 * exercise generate → native `download()` without SOPS/auth. Catalog still 503.
 */

import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common'
import { LISTENING_ASSET_CLASS } from '@loro/core'
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
    if (stubListeningAnonymousAllowed(request)) {
      request.principal = { ...STUB_LOCAL_PRINCIPAL }
      return true
    }
    return this.auth.canActivate(context)
  }
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
