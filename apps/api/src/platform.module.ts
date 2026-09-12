/**
 * Adapter choices — the only place production bindings are selected.
 *
 * Feature modules own controllers and collaborators. This module stays global so
 * a test overrides DATABASE / SYNC_REPOSITORY / TTS_TRANSPORT here rather than
 * reaching past the seam (docs/architecture/backend.md).
 */

import { Global, Module } from '@nestjs/common'
import { StubSceneProvider } from './ai/scene-provider.stub.js'
import { SCENE_PROVIDERS, type SceneProvider } from './ai/scene-provider.js'
import { SERVER_CLOCK, systemClock, type ServerClock } from './common/clock.js'
import { config } from './common/config.js'
import { RATE_LIMIT_STORE } from './common/rate-limit.js'
import { PostgresRateLimitStore } from './common/rate-limit.postgres.js'
import { DATABASE, PostgresDatabase, type SqlDatabase } from './database/database.js'
import { MusicBudget } from './music/budget.js'
import { LyricsCoordinator } from './music/lyrics.coordinator.js'
import { MUSIC_REPOSITORY, MemoryMusicRepository } from './music/repository.js'
import { PostgresMusicRepository } from './music/repository.postgres.js'
import { SYNC_REPOSITORY } from './sync/sync.repository.js'
import { PostgresSyncRepository } from './sync/sync.repository.postgres.js'
import { ElevenLabsMusicAdapter } from './integrations/elevenlabs/music.js'
import { MUSIC_ADAPTER } from './music/adapter.js'
import {
  TTS_RUNTIME_CONFIG,
  TTS_TRANSPORT,
  createTtsTransport,
  readTtsRuntimeConfig,
} from './tts/transport.js'

@Global()
@Module({
  providers: [
    { provide: DATABASE, useClass: PostgresDatabase },
    { provide: SERVER_CLOCK, useValue: systemClock },
    { provide: RATE_LIMIT_STORE, useClass: PostgresRateLimitStore },
    { provide: SYNC_REPOSITORY, useClass: PostgresSyncRepository },
    {
      provide: MUSIC_REPOSITORY,
      useFactory: (database: SqlDatabase) =>
        config.musicProvider() === 'elevenlabs'
          ? new PostgresMusicRepository(database)
          : new MemoryMusicRepository(),
      inject: [DATABASE],
    },
    {
      provide: MUSIC_ADAPTER,
      useFactory: () => new ElevenLabsMusicAdapter({ provider: config.musicProvider() }),
    },
    { provide: LyricsCoordinator, useFactory: () => new LyricsCoordinator() },
    {
      provide: MusicBudget,
      useFactory: (clock: ServerClock) => new MusicBudget(clock),
      inject: [SERVER_CLOCK],
    },
    { provide: TTS_RUNTIME_CONFIG, useFactory: readTtsRuntimeConfig },
    {
      provide: TTS_TRANSPORT,
      useFactory: createTtsTransport,
      inject: [TTS_RUNTIME_CONFIG],
    },
    StubSceneProvider,
    {
      provide: SCENE_PROVIDERS,
      useFactory: (...providers: SceneProvider[]): SceneProvider[] => providers,
      inject: [StubSceneProvider],
    },
  ],
  exports: [
    DATABASE,
    SERVER_CLOCK,
    RATE_LIMIT_STORE,
    SYNC_REPOSITORY,
    MUSIC_REPOSITORY,
    MUSIC_ADAPTER,
    LyricsCoordinator,
    MusicBudget,
    TTS_RUNTIME_CONFIG,
    TTS_TRANSPORT,
    SCENE_PROVIDERS,
  ],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class PlatformModule {}
