import { Module } from '@nestjs/common'
import { AuthController, MeController } from './auth.controller.js'
import { AuthGuard } from './auth.guard.js'
import { AuthService } from './auth.service.js'
import { OAuthController } from './oauth.controller.js'
import { AuthLifecycle, buildAuth } from './module.js'
import { AUTH_RUNTIME } from './runtime.js'
import { authSettings } from './settings.js'
import { DATABASE, type SqlDatabase } from '../database/database.js'

@Module({
  controllers: [AuthController, MeController, OAuthController],
  providers: [
    AuthService,
    AuthGuard,
    AuthLifecycle,
    {
      provide: AUTH_RUNTIME,
      useFactory: (database: SqlDatabase, sessions: AuthService) =>
        buildAuth(authSettings(), database, sessions),
      inject: [DATABASE, AuthService],
    },
  ],
  exports: [AuthService, AuthGuard],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class AuthModule {}
