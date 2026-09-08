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
} from '@loro/core/api/target'
import { LoroError } from '../common/errors.js'
import { AuthGuard, type AuthenticatedRequest } from './auth.guard.js'
import { AuthService } from './auth.service.js'

function parse<T>(
  schema: { safeParse(value: unknown): { success: true; data: T } | { success: false } },
  value: unknown,
): T {
  const result = schema.safeParse(value)
  if (!result.success) throw new LoroError('VALIDATION_FAILED')
  return result.data
}

/** Uses the actual transport peer. Forwarded headers cannot bypass auth limits. */
function address(request: Request): string {
  return request.socket.remoteAddress ?? 'unknown'
}

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
    return this.auth.signIn('google', parse(SignInRequestSchema, body), address(request))
  }

  @Post('apple')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  apple(@Body() body: unknown, @Req() request: Request) {
    return this.auth.signIn('apple', parse(SignInRequestSchema, body), address(request))
  }

  @Post('magic-link')
  @HttpCode(202)
  @Header('Cache-Control', 'no-store')
  magicLink(@Body() body: unknown, @Req() request: Request) {
    return this.auth.requestCode(parse(MagicLinkRequestSchema, body).email, address(request))
  }

  @Post('magic-link/verify')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  magicVerify(@Body() body: unknown, @Req() request: Request) {
    return this.auth.verifyCode(parse(MagicVerifyRequestSchema, body), address(request))
  }

  @Post('refresh')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  refresh(@Body() body: unknown, @Req() request: Request) {
    return this.auth.refresh(parse(RefreshRequestSchema, body).refresh_token, address(request))
  }

  @Post('logout')
  @HttpCode(204)
  @Header('Cache-Control', 'no-store')
  @UseGuards(AuthGuard)
  logout(@Req() request: AuthenticatedRequest) {
    return this.auth.logout(request.principal)
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
    const input = parse(ClaimRequestSchema, body)
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
