import { Injectable } from '@nestjs/common'
import type { PhraseSuggestResponse } from '@loro/core/api/draft'
import { suggestPhrases } from './phrase-suggest.js'

@Injectable()
export class PhraseSuggestService {
  suggest(body: unknown): Promise<PhraseSuggestResponse> {
    return suggestPhrases(body)
  }
}
