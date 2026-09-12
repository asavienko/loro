/**
 * Adapter choices — the only place production bindings are selected.
 *
 * Feature modules own controllers and collaborators. This module stays global so
 * a test overrides DATABASE / SYNC_REPOSITORY / TTS_TRANSPORT here rather than
 * reaching past the seam (docs/architecture/backend.md).
 */

import { Global, Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { StubSceneProvider } from './ai/scene-provider.stub.js'
import { SCENE_PROVIDERS, type SceneProvider } from './ai/scene-provider.js'
import { AuthBoundaryGuard } from './auth/auth-boundary.guard.js'
import { SERVER_CLOCK, systemClock } from './common/clock.js'
import { config } from './common/config.js'
import { DATABASE, PostgresDatabase, type SqlDatabase } from './database/database.js'
import { MUSIC_REPOSITORY, MemoryMusicRepository } from './music/repository.js'
import { PostgresMusicRepository } from './music/repository.postgres.js'
import { SYNC_REPOSITORY } from './sync/sync.repository.js'
import { PostgresSyncRepository } from './sync/sync.repository.postgres.js'
import { TTS_TRANSPORT, createTtsTransport } from './tts/transport.js'

@Global()
@Module({
  providers: [
    { provide: DATABASE, useClass: PostgresDatabase },
    { provide: SERVER_CLOCK, useValue: systemClock },
    { provide: SYNC_REPOSITORY, useClass: PostgresSyncRepository },
    {
      provide: MUSIC_REPOSITORY,
      useFactory: (database: SqlDatabase) =>
        config.musicProvider() === 'elevenlabs'
          ? new PostgresMusicRepository(database)
          : new MemoryMusicRepository(),
      inject: [DATABASE],
    },
    { provide: TTS_TRANSPORT, useFactory: createTtsTransport },
    StubSceneProvider,
    {
      provide: SCENE_PROVIDERS,
      useFactory: (...providers: SceneProvider[]): SceneProvider[] => providers,
      inject: [StubSceneProvider],
    },
    { provide: APP_GUARD, useClass: AuthBoundaryGuard },
  ],
  exports: [
    DATABASE,
    SERVER_CLOCK,
    SYNC_REPOSITORY,
    MUSIC_REPOSITORY,
    TTS_TRANSPORT,
    SCENE_PROVIDERS,
  ],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class PlatformModule {}
