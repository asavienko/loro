import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { ACCOUNT_ISOLATION_PENDING } from '../common/account-isolation.js'
import { config } from '../common/config.js'
import { LoroError } from '../common/errors.js'

/** AI remains disabled for account deployments until its own account/budget boundary is reviewed. */
@Injectable()
export class AuthBoundaryGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (!accountIsolationEnabled()) return true
    const pending = this.reflector.getAllAndOverride<boolean>(ACCOUNT_ISOLATION_PENDING, [
      context.getHandler(),
      context.getClass(),
    ])
    if (pending) {
      throw new LoroError('PROVIDER_UNAVAILABLE', 'This service is awaiting account isolation.')
    }
    return true
  }
}

/** Session engine is on when a signing key is present and auth is not explicitly disabled. */
export function accountIsolationEnabled(): boolean {
  const settings = config.authSettings()
  return (
    settings.enabled !== false && (Boolean(settings.privateKeyPem) || Boolean(settings.signingKey))
  )
}
