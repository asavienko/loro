/**
 * Content distribution — docs/architecture/api.md#content
 *
 * The catalog ships INDEPENDENTLY of the app: a phrase fix reaches every learner
 * within a day, no release (ADR-0009).
 */

import { Controller, Get, Query } from '@nestjs/common'
import { loadCatalog, type CatalogPhrase } from '@loro/content'
import { LoroError } from '../common/errors.js'

const catalog = loadCatalog()

interface ManifestPack {
  id: string
  label: string
  emoji: string
  count: number
  onboarding: boolean
  trip: boolean
}

@Controller('content')
export class ContentController {
  /** ~2 KB, cacheable, ETag'd. The client diffs against `catalog_version`. */
  @Get('manifest')
  manifest(@Query('lang') lang = 'es-ES'): {
    catalog_version: number
    lang: string
    phrase_count: number
    packs: ManifestPack[]
    scenarios: { id: string; label: string; emoji: string; count: number }[]
    audio_base: string
    min_app_version: string
  } {
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
      audio_base: process.env['CDN_BASE_URL'] ?? 'http://localhost:9000/loro-content',
      min_app_version: '1.0.0',
    }
  }

  /** Only the phrases changed since version N. */
  @Get('diff')
  diff(
    @Query('from') from = '0',
    @Query('lang') lang = 'es-ES',
  ): {
    from: number
    to: number
    upserts: CatalogPhrase[]
    deprecations: { id: string; deprecated_by: string }[]
    full_resync_required: boolean
  } {
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
  pack(
    @Query('id') id: string,
    @Query('lang') lang = 'es-ES',
  ): {
    id: string
    label: string
    promised_count: number
    phrases: CatalogPhrase[]
  } {
    this.assertLang(lang)
    const pack = catalog.packs.find((p) => p.id === id)
    if (pack === undefined) throw new LoroError('VALIDATION_FAILED', `unknown pack '${id}'`)

    const byId = new Map(catalog.phrases.map((p) => [p.id, p]))
    return {
      id: pack.id,
      label: pack.label,
      promised_count: pack.promisedCount,
      phrases: pack.phrases
        .map((pid) => byId.get(pid))
        .filter((p): p is CatalogPhrase => p !== undefined),
    }
  }

  private assertLang(lang: string): void {
    if (lang !== catalog.lang) {
      throw new LoroError('VALIDATION_FAILED', `no catalog for '${lang}'`)
    }
  }
}
