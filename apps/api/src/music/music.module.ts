import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module.js'
import { MusicController } from './music.controller.js'
import { MusicGuard } from './music.guard.js'
import { MusicService } from './music.service.js'

@Module({
  imports: [AuthModule],
  controllers: [MusicController],
  providers: [MusicService, MusicGuard],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class MusicModule {}
