import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Inject,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common'
import type { Response } from 'express'
import type { AuthenticatedRequest } from '../auth/auth.guard.js'
import { MusicGuard } from './music.guard.js'
import { MusicService } from './music.service.js'

@Controller('music')
@UseGuards(MusicGuard)
export class MusicController {
  constructor(@Inject(MusicService) private readonly music: MusicService) {}

  @Get('status')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  status() {
    return this.music.status()
  }

  @Post('lyrics')
  @HttpCode(200)
  lyrics(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.music.createLyrics(request.principal, body)
  }

  @Post('renders')
  @HttpCode(200)
  renders(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.music.renderStyles(request.principal, body)
  }

  @Get('tracks/:track_id')
  @Header('Cache-Control', 'no-store')
  track(@Req() request: AuthenticatedRequest, @Param('track_id') trackId: string) {
    return this.music.trackMetadata(request.principal, trackId)
  }

  @Get('tracks/:track_id/content')
  async content(
    @Req() request: AuthenticatedRequest,
    @Param('track_id') trackId: string,
    @Res() response: Response,
  ): Promise<void> {
    const file = await this.music.trackContent(request.principal, trackId)
    response.setHeader('Content-Type', file.contentType)
    response.setHeader('Cache-Control', 'private, max-age=60')
    response.setHeader('X-Loro-Generated', 'true')
    response.end(Buffer.from(file.bytes))
  }
}
