/**
 * The composition root.
 *
 * Adapter choices live in `platform.module.ts`. Feature modules own routes and
 * collaborators. A test that needs a different store or provider overrides the
 * token on this module rather than reaching past the seam
 * (docs/architecture/backend.md).
 */

import { Module } from '@nestjs/common'
import { AiModule } from './ai/ai.module.js'
import { AuthModule } from './auth/auth.module.js'
import { ContentModule } from './content/content.module.js'
import { HealthModule } from './health/health.module.js'
import { MusicModule } from './music/music.module.js'
import { PlatformModule } from './platform.module.js'
import { SyncModule } from './sync/sync.module.js'
import { TtsModule } from './tts/tts.module.js'

@Module({
  imports: [
    PlatformModule,
    AuthModule,
    SyncModule,
    MusicModule,
    TtsModule,
    AiModule,
    ContentModule,
    HealthModule,
  ],
})
// A Nest module is a decorated marker class; an empty body is the framework's shape,
// not a missed abstraction.
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class AppModule {}
