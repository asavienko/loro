import { Body, Controller, Post } from '@nestjs/common'
import { ZodError } from 'zod'
import { LoroError } from '../common/errors.js'
import { suggestPhrases } from './phrase-suggest.js'

@Controller('phrases')
export class PhrasesController {
  @Post('suggest')
  suggest(@Body() body: unknown) {
    try {
      return suggestPhrases(body)
    } catch (error) {
      if (error instanceof ZodError)
        throw new LoroError('VALIDATION_FAILED', 'Invalid phrase suggest request')
      throw error
    }
  }
}
