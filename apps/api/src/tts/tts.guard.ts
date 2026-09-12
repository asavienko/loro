/**
 * `GET /tts/status` is public so clients can hide play until ElevenLabs is ready.
 * Catalog reference and listening-class render/asset may omit a bearer when
 * `TTS_PROVIDER=elevenlabs` so web and APK can play without a session.
 * `TTS_STUB_RENDER=1` may render listening-class silence without a bearer;
 * catalog still 503 in stub mode.
 */

import {
  Inject,
  Injectable,
  Optional,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common'
import { LISTENING_ASSET_CLASS, REFERENCE_ASSET_CLASS } from '@loro/core'
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard.js'
import { anonymousPrincipal, isGetLeafPath } from '../common/http.js'
import { readTtsRuntimeConfig, TTS_RUNTIME_CONFIG, type TtsRuntimeConfig } from './transport.js'

const STUB_LOCAL_PRINCIPAL = {
  userId: 'stub-local',
  deviceId: 'stub-local',
  sessionId: 'stub-local',
} as const

@Injectable()
export class TtsGuard implements CanActivate {
  constructor(
    @Inject(AuthGuard) private readonly auth: AuthGuard,
    @Optional() @Inject(TTS_RUNTIME_CONFIG) private readonly ttsConfig?: TtsRuntimeConfig,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    const parsed = this.ttsConfig !== undefined ? this.ttsConfig : readTtsRuntimeConfig()
    if (ttsStatusAllowed(request)) return true
    if (stubListeningAnonymousAllowed(request, parsed)) {
      request.principal = { ...STUB_LOCAL_PRINCIPAL }
      return true
    }
    if (catalogReferenceAnonymousAllowed(request, parsed)) {
      request.principal = anonymousPrincipal(request.ip ?? '0.0.0.0')
      return true
    }
    return this.auth.canActivate(context)
  }
}

export function ttsStatusAllowed(request: {
  method?: string
  path?: string
  url?: string
}): boolean {
  return isGetLeafPath(request, 'tts/status')
}

function ttsAssetRequest(
  request: { method?: string; params?: { sha256?: string }; body?: unknown },
  allowed: (assetClass: unknown) => boolean,
): boolean {
  const method = request.method?.toUpperCase()
  if (method === 'GET') {
    return typeof request.params?.sha256 === 'string' && request.params.sha256.length > 0
  }
  if (method !== 'POST') return false
  const body = request.body
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return false
  return allowed((body as { asset_class?: unknown }).asset_class)
}

export function stubListeningAnonymousAllowed(
  request: {
    method?: string
    params?: { sha256?: string }
    body?: unknown
  },
  parsed: TtsRuntimeConfig = readTtsRuntimeConfig(),
): boolean {
  if (parsed?.provider !== 'stub' || !parsed.stubRender) return false
  return ttsAssetRequest(request, (assetClass) => assetClass === LISTENING_ASSET_CLASS)
}

export function catalogReferenceAnonymousAllowed(
  request: {
    method?: string
    params?: { sha256?: string }
    body?: unknown
  },
  parsed: TtsRuntimeConfig = readTtsRuntimeConfig(),
): boolean {
  if (parsed?.provider !== 'elevenlabs') return false
  return ttsAssetRequest(
    request,
    (assetClass) => assetClass === REFERENCE_ASSET_CLASS || assetClass === LISTENING_ASSET_CLASS,
  )
}
