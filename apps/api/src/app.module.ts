import { AuthLifecycle, buildAuth } from './auth/module.js'
import { OAuthController } from './auth/controller.js'
import { AUTH_RUNTIME } from './auth/runtime.js'
import { authSettings } from './auth/settings.js'
import { AuthBoundaryGuard } from './auth/guard.js'
import { APP_GUARD } from '@nestjs/core'
import type { SqlDatabase } from './database/database.js'
import { LearningContentController } from './content/learning-content.controller.js'
/**
 * The composition root.
 *
 * Every choice of implementation is made HERE and nowhere else: which store the sync
 * arbitration writes to, which providers can serve a scene. A module that needs a
 * different one in a test overrides it here rather than reaching past the seam
 * (docs/architecture/backend.md).
 */

import { Module } from '@nestjs/common'
import { SERVER_CLOCK, systemClock } from './common/clock.js'
import { HealthController } from './health/health.controller.js'
import { ContentController } from './content/content.controller.js'
import { SyncController } from './sync/sync.controller.js'
import { SyncService } from './sync/sync.service.js'
import { SYNC_REPOSITORY } from './sync/sync.repository.js'
import { PostgresSyncRepository } from './sync/sync.repository.postgres.js'
import { DATABASE, PostgresDatabase } from './database/database.js'
import { AuthController, MeController } from './auth/auth.controller.js'
import { AuthService } from './auth/auth.service.js'
import { AuthGuard } from './auth/auth.guard.js'
import { AiController } from './ai/ai.controller.js'
import { AiService } from './ai/ai.service.js'
import { SCENE_PROVIDERS, type SceneProvider } from './ai/scene-provider.js'
import { StubSceneProvider } from './ai/scene-provider.stub.js'

@Module({
  controllers: [
    HealthController,
    ContentController,
    LearningContentController,
    SyncController,
    AiController,
    AuthController,
    MeController,
    OAuthController,
  ],
  providers: [
    AiService,
    StubSceneProvider,
    {
      // Every scene provider, collected for `AiService` to key by name. Adding Claude
      // (plans/26, plans/45) is a new file, a class in this list, and one more entry in
      // `inject` — never a branch in the service.
      provide: SCENE_PROVIDERS,
      useFactory: (...providers: SceneProvider[]): SceneProvider[] => providers,
      inject: [StubSceneProvider],
    },
    SyncService,
    AuthService,
    AuthGuard,
    AuthLifecycle,
    {
      provide: AUTH_RUNTIME,
      useFactory: (database: SqlDatabase, sessions: AuthService) =>
        buildAuth(authSettings(), database, sessions),
      inject: [DATABASE, AuthService],
    },
    { provide: APP_GUARD, useClass: AuthBoundaryGuard },
    { provide: DATABASE, useClass: PostgresDatabase },
    { provide: SYNC_REPOSITORY, useClass: PostgresSyncRepository },
    // The wall clock, so a test can pin `server_hlc` instead of matching a regex.
    { provide: SERVER_CLOCK, useValue: systemClock },
  ],
})
// A Nest module is a decorated marker class; an empty body is the framework's shape,
// not a missed abstraction.
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class AppModule {}
