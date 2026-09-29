import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module.js'
import { LibraryReadController, LibraryWriteController } from './library.controller.js'
import { OptionalAuthGuard } from './library.guard.js'
import { LibraryService } from './library.service.js'
import { ProgressController, ProgressService } from './progress.js'

@Module({
  imports: [AuthModule],
  controllers: [LibraryReadController, LibraryWriteController, ProgressController],
  providers: [LibraryService, OptionalAuthGuard, ProgressService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class LibraryModule {}
