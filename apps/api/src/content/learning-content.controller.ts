/** F-08. Versioned neutral payloads; /content retains the original es/en wire contract. */
import { Controller, Get, Query } from '@nestjs/common'
import { LANGUAGE_CAPABILITIES } from '@loro/core'
import {
  LearningCatalogQuerySchema,
  LearningDiffQuerySchema,
  LearningPackQuerySchema,
} from '@loro/core/api/current'
import { loadLearningCatalog } from '@loro/content'
import { LoroError } from '../common/errors.js'
import { parseContract } from '../common/parse.js'

@Controller('content/v2')
export class LearningContentController {
  @Get('manifest')
  manifest(@Query('target') target = 'es-ES', @Query('native') native = 'en') {
    const catalog = this.catalog(target, native)
    return {
      targetLocale: catalog.targetLocale,
      nativeLanguage: catalog.nativeLanguage,
      catalogVersion: catalog.catalogVersion,
      reviewStatus: catalog.reviewStatus,
      phraseCount: catalog.phrases.length,
      capabilities: LANGUAGE_CAPABILITIES[catalog.targetLocale],
      packs: catalog.packs.map(({ id, label, emoji, phrases, onboarding }) => ({
        id,
        label,
        emoji,
        count: phrases.length,
        onboarding,
      })),
      scenarios: catalog.scenarios.map(({ id, label, emoji, phrases }) => ({
        id,
        label,
        emoji,
        count: phrases.length,
      })),
    }
  }
  @Get('diff')
  diff(
    @Query('from') from = '0',
    @Query('target') target = 'es-ES',
    @Query('native') native = 'en',
  ) {
    parseContract(LearningDiffQuerySchema, { from, target, native })
    const catalog = this.catalog(target, native)
    return {
      from: Number(from),
      to: catalog.catalogVersion,
      targetLocale: catalog.targetLocale,
      nativeLanguage: catalog.nativeLanguage,
      upserts: Number(from) === catalog.catalogVersion ? [] : catalog.phrases,
      deprecations: [],
      fullResyncRequired: Number(from) !== catalog.catalogVersion,
    }
  }
  @Get('pack')
  pack(@Query('id') id: string, @Query('target') target = 'es-ES', @Query('native') native = 'en') {
    parseContract(LearningPackQuerySchema, { id, target, native })
    const catalog = this.catalog(target, native)
    const pack = catalog.packs.find((p) => p.id === id)
    if (!pack) throw new LoroError('VALIDATION_FAILED', 'Unknown pack')
    return {
      id: pack.id,
      label: pack.label,
      targetLocale: catalog.targetLocale,
      nativeLanguage: catalog.nativeLanguage,
      phrases: pack.phrases.map((id) => catalog.phrases.find((p) => p.id === id)),
    }
  }
  private catalog(target: string, native: string) {
    const query = parseContract(
      LearningCatalogQuerySchema,
      { target, native },
      'Unsupported language pair',
    )
    return loadLearningCatalog(query.target, query.native)
  }
}
