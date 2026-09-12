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
  UseGuards,
} from '@nestjs/common'
import type { Request, Response } from 'express'
import { OAuthExchangeSchema, OAuthProviderSchema, OAuthStartSchema } from '@loro/core/api/oauth'
import type { OAuthFlowService } from './oauth-flow.service.js'
import { AuthService } from './auth.service.js'
import { AuthGuard, type AuthenticatedRequest } from './auth.guard.js'
import { AUTH_RUNTIME } from './runtime.js'
import { providerEnabled } from './settings.js'
import { requestAddress } from '../common/http.js'
import { parseContract } from '../common/parse.js'
import { LoroError } from '../common/errors.js'

@Controller('auth')
export class OAuthController {
  constructor(
    @Inject(AUTH_RUNTIME) private readonly runtime: OAuthFlowService | null,
    @Inject(AuthService) private readonly sessions: AuthService,
  ) {}
  private auth(): OAuthFlowService {
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
    const parsed = parseContract(OAuthStartSchema, body, 'Invalid sign-in request.')
    const auth = this.auth()
    await auth.rate(requestAddress(request))
    return auth.start(this.provider(provider), parsed.redirect_uri, parsed.code_challenge)
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
    const parsed = parseContract(OAuthExchangeSchema, body, 'Invalid exchange request.')
    const auth = this.auth()
    await auth.rate(requestAddress(request))
    return auth.exchange(parsed.ticket, parsed.code_verifier, parsed.device, parsed.anon_id)
  }
  @Get('me')
  @Header('Cache-Control', 'no-store')
  @UseGuards(AuthGuard)
  async me(@Req() request: AuthenticatedRequest) {
    return (await this.sessions.me(request.principal)).user
  }
}
