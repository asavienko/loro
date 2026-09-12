import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module.js'
import { TtsController } from './tts.controller.js'
import { TtsGuard } from './tts.guard.js'
import { TtsService } from './tts.service.js'

@Module({
  imports: [AuthModule],
  controllers: [TtsController],
  providers: [TtsService, TtsGuard],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class TtsModule {}
