import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common'
import type { Request, Response } from 'express'
import {
  OAuthExchangeSchema,
  OAuthProviderSchema,
  OAuthRefreshSchema,
  OAuthStartSchema,
} from '@loro/core/api/oauth'
import type { AuthService } from './service.js'
import { AUTH_RUNTIME } from './runtime.js'
import { providerEnabled } from './settings.js'
import { LoroError } from '../common/errors.js'

@Controller('auth')
export class AuthController {
  constructor(@Inject(AUTH_RUNTIME) private readonly runtime: AuthService | null) {}
  private auth(): AuthService {
    if (!this.runtime) throw new LoroError('PROVIDER_UNAVAILABLE', 'Sign-in is not configured.')
    return this.runtime
  }
  private provider(value: string) {
    const parsed = OAuthProviderSchema.safeParse(value)
    if (!parsed.success) throw new LoroError('VALIDATION_FAILED', 'Invalid provider.')
    return parsed.data
  }
  @Get('providers')
  @Header('Cache-Control', 'no-store')
  providers() {
    const runtime = this.runtime
    return {
      providers: runtime
        ? OAuthProviderSchema.options.filter((p) => providerEnabled(runtime.settings, p))
        : [],
    }
  }
  @Post(':provider/start')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async start(@Param('provider') provider: string, @Body() body: unknown, @Req() request: Request) {
    const parsed = OAuthStartSchema.safeParse(body)
    if (!parsed.success) throw new LoroError('VALIDATION_FAILED', 'Invalid sign-in request.')
    const auth = this.auth()
    await auth.rate(request.ip ?? '')
    return auth.start(this.provider(provider), parsed.data.redirect_uri, parsed.data.code_challenge)
  }
  @Get(':provider/callback')
  async callbackGet(
    @Param('provider') provider: string,
    @Query() query: Record<string, unknown>,
    @Res() response: Response,
  ) {
    return this.callback(provider, query, response)
  }
  @Post(':provider/callback')
  async callbackPost(
    @Param('provider') provider: string,
    @Body() body: Record<string, unknown>,
    @Res() response: Response,
  ) {
    return this.callback(provider, body, response)
  }
  private async callback(
    provider: string,
    body: Record<string, unknown> | null,
    response: Response,
  ): Promise<void> {
    response.setHeader('Cache-Control', 'no-store')
    response.setHeader('Referrer-Policy', 'no-referrer')
    if (!body || typeof body['state'] !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(body['state']))
      throw new LoroError('UNAUTHENTICATED', 'Invalid sign-in state.')
    const code =
      typeof body['code'] === 'string' && body['code'].length <= 8192 && !body['error']
        ? body['code']
        : undefined
    response.redirect(303, await this.auth().callback(this.provider(provider), body['state'], code))
  }
  @Post('exchange')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async exchange(@Body() body: unknown, @Req() request: Request) {
    const parsed = OAuthExchangeSchema.safeParse(body)
    if (!parsed.success) throw new LoroError('VALIDATION_FAILED', 'Invalid exchange request.')
    const auth = this.auth()
    await auth.rate(request.ip ?? '')
    return auth.exchange(parsed.data.ticket, parsed.data.code_verifier)
  }
  @Post('refresh')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async refresh(@Body() body: unknown, @Req() request: Request) {
    const parsed = OAuthRefreshSchema.safeParse(body)
    if (!parsed.success) throw new LoroError('VALIDATION_FAILED', 'Invalid refresh request.')
    const auth = this.auth()
    await auth.rate(request.ip ?? '')
    return auth.refresh(parsed.data.refresh_token)
  }
  @Post('logout')
  @HttpCode(204)
  @Header('Cache-Control', 'no-store')
  async logout(@Body() body: unknown) {
    const parsed = OAuthRefreshSchema.safeParse(body)
    if (!parsed.success) throw new LoroError('VALIDATION_FAILED', 'Invalid logout request.')
    await this.auth().logout(parsed.data.refresh_token)
  }
  @Get('me')
  @Header('Cache-Control', 'no-store')
  async me(@Req() request: Request) {
    const token = request.headers.authorization
    if (!token?.startsWith('Bearer ') || token.length > 4096)
      throw new LoroError('UNAUTHENTICATED', 'Sign in to continue.')
    return this.auth().principal(token.slice(7))
  }
}
