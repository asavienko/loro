import { Module } from '@nestjs/common'
import { config } from '../common/config.js'
import { DATABASE, type SqlDatabase } from '../database/database.js'
import { AuthController, MeController } from './auth.controller.js'
import { AuthGuard } from './auth.guard.js'
import { AUTH_STORE, PostgresAuthStore } from './auth.store.js'
import { AuthService } from './auth.service.js'
import { ACCESS_TOKENS, AccessTokens } from './auth.tokens.js'
import { OAuthController } from './oauth.controller.js'
import { AuthLifecycle, buildAuth } from './module.js'
import { AUTH_RUNTIME } from './runtime.js'
import { oauthDeploymentSettings } from './settings.js'

function createAccessTokens(): AccessTokens | null {
  try {
    return new AccessTokens(config.sessionAuthSettings())
  } catch {
    return null
  }
}

@Module({
  controllers: [AuthController, MeController, OAuthController],
  providers: [
    { provide: AUTH_STORE, useClass: PostgresAuthStore },
    { provide: ACCESS_TOKENS, useFactory: createAccessTokens },
    AuthService,
    AuthGuard,
    AuthLifecycle,
    {
      provide: AUTH_RUNTIME,
      useFactory: (database: SqlDatabase, sessions: AuthService) =>
        buildAuth(oauthDeploymentSettings(), database, sessions),
      inject: [DATABASE, AuthService],
    },
  ],
  exports: [AuthService, AuthGuard, AUTH_STORE],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class AuthModule {}
