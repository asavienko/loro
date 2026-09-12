import { Module } from '@nestjs/common'
import { AiController } from './ai.controller.js'
import { AiService } from './ai.service.js'
import { PhrasesController } from './phrases.controller.js'

@Module({
  controllers: [AiController, PhrasesController],
  providers: [AiService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class AiModule {}
