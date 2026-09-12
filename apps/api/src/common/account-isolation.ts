/**
 * Marks AI spend routes that stay closed while account isolation is on.
 *
 * Account deployments enable the session engine before AI has its own
 * tenant/budget boundary. The guard reads this metadata instead of comparing
 * controller classes, so a new spend route cannot slip past by living on a
 * different controller.
 */

import { SetMetadata } from '@nestjs/common'

export const ACCOUNT_ISOLATION_PENDING = 'accountIsolationPending'

export const PendingAccountIsolation = (): ClassDecorator & MethodDecorator =>
  SetMetadata(ACCOUNT_ISOLATION_PENDING, true)
