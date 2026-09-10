/**
 * Text-only. Q-15 pins are in; pronunciation review remains.
 * Status is public. Catalog reference and listening-class may be anonymous when
 * ElevenLabs is configured. Labeled stub-render listening may be local/anonymous.
 * Never registers voice clone.
 */

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
  StreamableFile,
  UseGuards,
} from '@nestjs/common'
import type { AuthenticatedRequest } from '../auth/auth.guard.js'
import { TtsGuard } from './tts.guard.js'
import { ttsDownloadOrigin, TtsService } from './tts.service.js'

@Controller('tts')
@UseGuards(TtsGuard)
export class TtsController {
  constructor(@Inject(TtsService) private readonly tts: TtsService) {}

  @Get('status')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  status() {
    return this.tts.status()
  }

  @Post('render')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  render(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.tts.render({
      userId: request.principal.userId,
      ip: request.ip ?? '0.0.0.0',
      body,
      publicOrigin: ttsDownloadOrigin(request),
    })
  }

  @Get('assets/:sha256')
  @Header('Cache-Control', 'private, max-age=31536000, immutable')
  async asset(@Param('sha256') sha256: string): Promise<StreamableFile> {
    const file = await this.tts.asset(sha256)
    return new StreamableFile(file.bytes, {
      type: file.contentType,
      disposition: 'inline',
    })
  }
}
