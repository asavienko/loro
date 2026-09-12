import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common'
import type { Request } from 'express'
import { LoroError } from '../common/errors.js'
import { assertDeviceHeader } from './device-header.js'
import { AuthService } from './auth.service.js'
import type { AuthPrincipal } from './auth.tokens.js'

export interface AuthenticatedRequest extends Request {
  principal: AuthPrincipal
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    const authorization = request.headers.authorization
    if (!authorization?.startsWith('Bearer ') || authorization.length > 16_384) {
      throw new LoroError('UNAUTHENTICATED')
    }
    const principal = await this.auth.authenticate(authorization.slice(7))
    assertDeviceHeader(principal, request.headers['x-loro-device'])
    request.principal = principal
    return true
  }
}
