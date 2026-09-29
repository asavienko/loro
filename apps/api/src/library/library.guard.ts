/**
 * The library's reading routes are open to everyone: Loro's content and shared items need no
 * account. A presented bearer is still checked, and a bad one is refused, so the app refreshes its
 * token rather than silently reading as a stranger.
 */
import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common'
import type { Request } from 'express'
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard.js'

export interface ReaderRequest extends Request {
  principal?: AuthenticatedRequest['principal']
}

@Injectable()
export class OptionalAuthGuard implements CanActivate {
  constructor(@Inject(AuthGuard) private readonly auth: AuthGuard) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ReaderRequest>()
    if (request.headers.authorization === undefined) return true
    return this.auth.canActivate(context)
  }
}

/** The signed-in reader's id, or null. */
export const readerOf = (request: ReaderRequest): string | null => request.principal?.userId ?? null
