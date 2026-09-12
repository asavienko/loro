import { Module } from '@nestjs/common'
import { ContentController } from './content.controller.js'
import { LearningContentController } from './learning-content.controller.js'

@Module({
  controllers: [ContentController, LearningContentController],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class ContentModule {}
