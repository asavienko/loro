import { Body, Controller, HttpCode, Inject, Post } from '@nestjs/common'
import { ZodError } from 'zod'
import { PendingAccountIsolation } from '../common/account-isolation.js'
import { LoroError } from '../common/errors.js'
import { PhraseSuggestService } from './phrase-suggest.service.js'

@PendingAccountIsolation()
@Controller('phrases')
export class PhrasesController {
  constructor(@Inject(PhraseSuggestService) private readonly phrases: PhraseSuggestService) {}

  @Post('suggest')
  @HttpCode(200)
  async suggest(@Body() body: unknown) {
    try {
      return await this.phrases.suggest(body)
    } catch (error) {
      if (error instanceof ZodError)
        throw new LoroError('VALIDATION_FAILED', 'Invalid phrase suggest request')
      throw error
    }
  }
}
