import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  HttpCode,
  Inject,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common'
import type { Request } from 'express'
import {
  ClaimRequestSchema,
  MagicLinkRequestSchema,
  MagicVerifyRequestSchema,
  RefreshRequestSchema,
  SignInRequestSchema,
} from '@loro/core/api/account'
import { LoroError } from '../common/errors.js'
import { requestAddress } from '../common/http.js'
import { parseContract } from '../common/parse.js'
import { AuthGuard, type AuthenticatedRequest } from './auth.guard.js'
import { AuthService } from './auth.service.js'

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Get('capabilities')
  @Header('Cache-Control', 'no-store')
  capabilities() {
    return this.auth.capabilities()
  }

  @Post('google')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  google(@Body() body: unknown, @Req() request: Request) {
    return this.auth.signIn(
      'google',
      parseContract(SignInRequestSchema, body),
      requestAddress(request),
    )
  }

  @Post('apple')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  apple(@Body() body: unknown, @Req() request: Request) {
    return this.auth.signIn(
      'apple',
      parseContract(SignInRequestSchema, body),
      requestAddress(request),
    )
  }

  @Post('magic-link')
  @HttpCode(202)
  @Header('Cache-Control', 'no-store')
  magicLink(@Body() body: unknown, @Req() request: Request) {
    return this.auth.requestCode(
      parseContract(MagicLinkRequestSchema, body).email,
      requestAddress(request),
    )
  }

  @Post('magic-link/verify')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  magicVerify(@Body() body: unknown, @Req() request: Request) {
    return this.auth.verifyCode(
      parseContract(MagicVerifyRequestSchema, body),
      requestAddress(request),
    )
  }

  @Post('refresh')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  refresh(@Body() body: unknown, @Req() request: Request) {
    const input = parseContract(RefreshRequestSchema, body)
    const registration =
      input.device && input.anon_id ? { device: input.device, anon_id: input.anon_id } : undefined
    return this.auth.refresh(input.refresh_token, requestAddress(request), registration)
  }

  @Post('logout')
  @HttpCode(204)
  @Header('Cache-Control', 'no-store')
  async logout(@Body() body: unknown, @Req() request: Request) {
    const refresh = RefreshRequestSchema.safeParse(body)
    if (refresh.success) return this.auth.revokeRefresh(refresh.data.refresh_token)
    const bearer = request.headers.authorization
    if (!bearer?.startsWith('Bearer ') || bearer.length > 16_384)
      throw new LoroError('UNAUTHENTICATED')
    const principal = await this.auth.authenticate(bearer.slice(7))
    const device = request.headers['x-loro-device']
    if (device !== undefined && device !== principal.deviceId) throw new LoroError('FORBIDDEN')
    return this.auth.logout(principal)
  }

  @Post('claim')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @UseGuards(AuthGuard)
  claim(
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
    @Headers('idempotency-key') key?: string,
  ) {
    const input = parseContract(ClaimRequestSchema, body)
    if (key !== input.request_id || request.headers['x-loro-device'] !== input.device_id) {
      throw new LoroError('VALIDATION_FAILED')
    }
    return this.auth.claim(request.principal, input)
  }
}

@Controller('me')
@UseGuards(AuthGuard)
export class MeController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  me(@Req() request: AuthenticatedRequest) {
    return this.auth.me(request.principal)
  }
}
