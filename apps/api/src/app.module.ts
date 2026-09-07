import { AuthModule } from './auth/module.js'
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
import { InMemorySyncRepository } from './sync/sync.repository.memory.js'
import { AiController } from './ai/ai.controller.js'
import { AiService } from './ai/ai.service.js'
import { SCENE_PROVIDERS, type SceneProvider } from './ai/scene-provider.js'
import { StubSceneProvider } from './ai/scene-provider.stub.js'

@Module({
  imports: [AuthModule],
  controllers: [
    HealthController,
    ContentController,
    LearningContentController,
    SyncController,
    AiController,
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
    // Postgres lands with plans/13; it replaces this line and nothing else.
    { provide: SYNC_REPOSITORY, useClass: InMemorySyncRepository },
    // The wall clock, so a test can pin `server_hlc` instead of matching a regex.
    { provide: SERVER_CLOCK, useValue: systemClock },
  ],
})
// A Nest module is a decorated marker class; an empty body is the framework's shape,
// not a missed abstraction.
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class AppModule {}
