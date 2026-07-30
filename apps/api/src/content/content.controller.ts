/**
 * Content distribution — docs/architecture/api.md#content
 *
 * The catalog ships INDEPENDENTLY of the app: a phrase fix reaches every learner
 * within a day, no release (ADR-0009).
 *
 * No service layer, deliberately: the catalog is immutable data loaded from
 * `@loro/content` at import, and a pass-through service would be a layer around a
 * constant. When packs move to object storage there will be something to inject.
 */

import { Controller, Get, Query } from '@nestjs/common'
import { loadCatalog, type CatalogPhrase } from '@loro/content'
import { config } from '../common/config.js'
import { LoroError } from '../common/errors.js'

const catalog = loadCatalog()
const phrasesById: ReadonlyMap<string, CatalogPhrase> = new Map(
  catalog.phrases.map((phrase) => [phrase.id, phrase]),
)

/** The oldest app build this catalog is safe to serve. */
const MIN_APP_VERSION = '1.0.0'

interface ManifestPack {
  id: string
  label: string
  emoji: string
  count: number
  onboarding: boolean
  trip: boolean
}

interface ManifestScenario {
  id: string
  label: string
  emoji: string
  count: number
}

interface ManifestResponse {
  catalog_version: number
  lang: string
  phrase_count: number
  packs: ManifestPack[]
  scenarios: ManifestScenario[]
  audio_base: string
  min_app_version: string
}

interface DiffResponse {
  from: number
  to: number
  upserts: CatalogPhrase[]
  deprecations: { id: string; deprecated_by: string }[]
  full_resync_required: boolean
}

interface PackResponse {
  id: string
  label: string
  promised_count: number
  phrases: CatalogPhrase[]
}

@Controller('content')
export class ContentController {
  /** ~2 KB, cacheable, ETag'd. The client diffs against `catalog_version`. */
  @Get('manifest')
  manifest(@Query('lang') lang = 'es-ES'): ManifestResponse {
    this.assertLang(lang)
    return {
      catalog_version: catalog.catalogVersion,
      lang: catalog.lang,
      phrase_count: catalog.phrases.length,
      packs: catalog.packs.map((p) => ({
        id: p.id,
        label: p.label,
        emoji: p.emoji,
        // The count shown to a learner is membership — never an aspiration.
        count: p.phrases.length,
        onboarding: p.onboarding,
        trip: p.trip,
      })),
      scenarios: catalog.scenarios.map((s) => ({
        id: s.id,
        label: s.label,
        emoji: s.emoji,
        count: s.phrases.length,
      })),
      audio_base: config.cdnBaseUrl(),
      min_app_version: MIN_APP_VERSION,
    }
  }

  /** Only the phrases changed since version N. */
  @Get('diff')
  diff(@Query('from') from = '0', @Query('lang') lang = 'es-ES'): DiffResponse {
    this.assertLang(lang)
    const fromVersion = Number.parseInt(from, 10)
    if (Number.isNaN(fromVersion) || fromVersion < 0) {
      throw new LoroError('VALIDATION_FAILED', "'from' must be a non-negative integer")
    }

    const upToDate = fromVersion >= catalog.catalogVersion
    return {
      from: fromVersion,
      to: catalog.catalogVersion,
      upserts: upToDate ? [] : catalog.phrases,
      deprecations: catalog.phrases
        .filter((p) => p.deprecated_by !== undefined)
        .map((p) => ({ id: p.id, deprecated_by: p.deprecated_by ?? '' })),
      // A learner months behind should download the catalog once, not a diff
      // larger than the catalog.
      full_resync_required: fromVersion === 0,
    }
  }

  /** A full pack, for trip prefetch. */
  @Get('pack')
  pack(@Query('id') id: string, @Query('lang') lang = 'es-ES'): PackResponse {
    this.assertLang(lang)
    const pack = catalog.packs.find((p) => p.id === id)
    if (pack === undefined) throw new LoroError('VALIDATION_FAILED', `unknown pack '${id}'`)

    return {
      id: pack.id,
      label: pack.label,
      promised_count: pack.promisedCount,
      phrases: pack.phrases
        .map((pid) => phrasesById.get(pid))
        .filter((p): p is CatalogPhrase => p !== undefined),
    }
  }

  private assertLang(lang: string): void {
    if (lang !== catalog.lang) {
      throw new LoroError('VALIDATION_FAILED', `no catalog for '${lang}'`)
    }
  }
}
