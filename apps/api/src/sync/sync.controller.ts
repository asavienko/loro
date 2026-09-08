import { Body, Controller, Header, HttpCode, Inject, Post, Req, UseGuards } from '@nestjs/common'
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard.js'
import { LoroError } from '../common/errors.js'
import { SyncService } from './sync.service.js'

@Controller('sync')
@UseGuards(AuthGuard)
export class SyncController {
  constructor(@Inject(SyncService) private readonly sync: SyncService) {}

  private device(request: AuthenticatedRequest) {
    if (request.headers['x-loro-device'] !== request.principal.deviceId)
      throw new LoroError('FORBIDDEN')
    return request.principal
  }

  @Post('push')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  push(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.sync.push(this.device(request), body)
  }

  @Post('pull')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  pull(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.sync.pull(this.device(request), body)
  }

  @Post('status')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  status(@Req() request: AuthenticatedRequest) {
    return this.sync.status(this.device(request))
  }
}
