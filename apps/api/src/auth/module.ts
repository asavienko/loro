import { Inject, Injectable, Module, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common'
import { authSettings, type AuthSettings } from './settings.js'
import { AuthService } from './service.js'
import { postgresAuthRepository } from './repository.js'
import { OAuthIdentityProvider } from './provider.js'
import { systemClock } from '../common/clock.js'
import { AuthController } from './controller.js'
import { AUTH_RUNTIME } from './runtime.js'
import { APP_GUARD } from '@nestjs/core'
import { AuthBoundaryGuard } from './guard.js'

@Injectable()
class AuthLifecycle implements OnModuleInit, OnModuleDestroy {
  private timer: ReturnType<typeof setInterval> | undefined
  constructor(@Inject(AUTH_RUNTIME) private readonly service: AuthService | null) {}
  async onModuleInit(): Promise<void> {
    if (!this.service) return
    await this.service.repository.initialize()
    await this.service.repository.cleanup(systemClock.now())
    this.timer = setInterval(() => {
      void this.service?.repository.cleanup(systemClock.now()).catch(() => undefined)
    }, 60_000)
    this.timer.unref()
  }
  async onModuleDestroy(): Promise<void> {
    if (this.timer) clearInterval(this.timer)
    await this.service?.repository.close()
  }
}
export function buildAuth(settings: AuthSettings | undefined): AuthService | null {
  return settings
    ? new AuthService(
        settings,
        postgresAuthRepository(settings.databaseUrl),
        new OAuthIdentityProvider(settings),
        systemClock,
      )
    : null
}
@Module({
  controllers: [AuthController],
  providers: [
    { provide: AUTH_RUNTIME, useFactory: () => buildAuth(authSettings()) },
    AuthLifecycle,
    { provide: APP_GUARD, useClass: AuthBoundaryGuard },
  ],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class AuthModule {}
