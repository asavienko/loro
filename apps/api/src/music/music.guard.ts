/**
 * `GET /music/status` is public. Lyrics, renders and track bytes may omit a bearer
 * when the stub fixture path is on, or when ElevenLabs Music has a key, so web and
 * APK can play without a session. A presented bearer still wins so accounts stay isolated.
 */

import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common'
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard.js'
import { anonymousPrincipal, isGetLeafPath } from '../common/http.js'
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
      request.principal = anonymousPrincipal(request.ip ?? '0.0.0.0')
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

export function musicAnonymousAllowed(): boolean {
  const provider = config.musicProvider()
  if (provider === 'elevenlabs') return Boolean(config.musicApiKey()?.trim())
  return provider === 'stub'
}
