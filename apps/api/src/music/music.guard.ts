/**
 * `GET /music/status` is public. Lyrics, renders and track bytes may omit a bearer
 * when the stub fixture path is on, or when ElevenLabs Music has a key, so web and
 * APK can play without a session. A presented bearer still wins so accounts stay isolated.
 */

import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common'
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard.js'
import { config } from '../common/config.js'

@Injectable()
export class MusicGuard implements CanActivate {
  constructor(@Inject(AuthGuard) private readonly auth: AuthGuard) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    if (musicStatusAllowed(request)) return true
    const authorization = request.headers.authorization
    if (typeof authorization === 'string' && authorization.startsWith('Bearer ')) {
      return this.auth.canActivate(context)
    }
    if (musicAnonymousAllowed()) {
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

export function musicStatusAllowed(request: {
  method?: string
  path?: string
  url?: string
}): boolean {
  return isGetLeafPath(request, 'music/status')
}

function isGetLeafPath(
  request: { method?: string; path?: string; url?: string },
  leaf: string,
): boolean {
  if (request.method?.toUpperCase() !== 'GET') return false
  const raw = `${request.path ?? ''} ${request.url ?? ''}`
  const path = raw.split(/[?#\s]/).find((part) => part.length > 0) ?? ''
  return path === `/${leaf}` || path.endsWith(`/${leaf}`)
}

export function musicAnonymousAllowed(): boolean {
  const provider = config.musicProvider()
  if (provider === 'elevenlabs') return Boolean(config.musicApiKey()?.trim())
  return provider === 'stub'
}
