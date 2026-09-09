import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common'
import { AiController } from '../ai/ai.controller.js'
import { PhrasesController } from '../ai/phrases.controller.js'
import { config } from '../common/config.js'
import { LoroError } from '../common/errors.js'
/** AI remains disabled for account deployments until its own account/budget boundary is reviewed. */
@Injectable()
export class AuthBoundaryGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const settings = config.authSettings()
    const enabled =
      settings.enabled !== false &&
      (Boolean(settings.privateKeyPem) || Boolean(settings.signingKey))
    const handler = context.getClass()
    if (enabled && (handler === AiController || handler === PhrasesController)) {
      throw new LoroError('PROVIDER_UNAVAILABLE', 'This service is awaiting account isolation.')
    }
    return true
  }
}
