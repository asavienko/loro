import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common'
import { SyncController } from '../sync/sync.controller.js'
import { AiController } from '../ai/ai.controller.js'
import type { AuthService } from './service.js'
import { AUTH_RUNTIME } from './runtime.js'
import { LoroError } from '../common/errors.js'
/** The legacy sync repository is shared, so an enabled account deployment must not expose it. */
@Injectable()
export class AuthBoundaryGuard implements CanActivate {
  constructor(@Inject(AUTH_RUNTIME) private readonly auth: AuthService | null) {}
  canActivate(context: ExecutionContext): boolean {
    const controller = context.getClass()
    if (this.auth && (controller === SyncController || controller === AiController)) {
      throw new LoroError('PROVIDER_UNAVAILABLE', 'This service is awaiting account isolation.')
    }
    return true
  }
}
