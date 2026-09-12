import { Body, Controller, HttpCode, Post } from '@nestjs/common'
import { ZodError } from 'zod'
import { PendingAccountIsolation } from '../common/account-isolation.js'
import { LoroError } from '../common/errors.js'
import { suggestPhrases } from './phrase-suggest.js'

@PendingAccountIsolation()
@Controller('phrases')
export class PhrasesController {
  @Post('suggest')
  @HttpCode(200)
  async suggest(@Body() body: unknown) {
    try {
      return await suggestPhrases(body)
    } catch (error) {
      if (error instanceof ZodError)
        throw new LoroError('VALIDATION_FAILED', 'Invalid phrase suggest request')
      throw error
    }
  }
}
