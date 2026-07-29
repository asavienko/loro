import { Module } from '@nestjs/common'
import { HealthController } from './health/health.controller.js'
import { ContentController } from './content/content.controller.js'
import { SyncController } from './sync/sync.controller.js'
import { AiController } from './ai/ai.controller.js'
import { AiService } from './ai/ai.service.js'

@Module({
  controllers: [HealthController, ContentController, SyncController, AiController],
  providers: [AiService],
})
// A Nest module is a decorated marker class; an empty body is the framework's shape,
// not a missed abstraction.
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class AppModule {}
