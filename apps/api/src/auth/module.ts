/** Composition helpers; there is only one database pool and one session engine. */
import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common'
import type { AuthSettings } from './settings.js'
import { OAuthFlowService } from './service.js'
import { OAuthIdentityProvider } from './provider.js'
import { systemClock } from '../common/clock.js'
import { AUTH_RUNTIME } from './runtime.js'
import type { SqlDatabase } from '../database/database.js'
import type { AuthService } from './auth.service.js'

@Injectable()
export class AuthLifecycle implements OnModuleInit, OnModuleDestroy {
  private timer: ReturnType<typeof setInterval> | undefined
  constructor(@Inject(AUTH_RUNTIME) private readonly service: OAuthFlowService | null) {}
  async onModuleInit(): Promise<void> {
    if (!this.service) return
    await this.service.repository.cleanup(systemClock.now())
    this.timer = setInterval(() => {
      void this.service?.repository.cleanup(systemClock.now()).catch(() => undefined)
    }, 60_000)
    this.timer.unref()
  }
  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer)
  }
}
export function buildAuth(
  settings: AuthSettings | undefined,
  database: SqlDatabase,
  sessions: AuthService,
): OAuthFlowService | null {
  return settings
    ? new OAuthFlowService(
        settings,
        database,
        new OAuthIdentityProvider(settings),
        sessions,
        systemClock,
      )
    : null
}
