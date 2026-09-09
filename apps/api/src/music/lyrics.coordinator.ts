import { createHash } from 'node:crypto'
import {
  bundledLyricDocument,
  validateLyricDocument,
  type CatalogLyricLine,
  type LyricDocument,
  type NativeLanguage,
  type TargetLocale,
} from '@loro/core'
import type { MusicLyricsRequest, MusicLyricsResponse } from '@loro/core/api/draft'
import { LoroError } from '../common/errors.js'
import { resolveMusicCatalogPhrases } from './catalog.js'

export const LYRICS_PROMPT_VERSION = 'loro-lyrics-v1'
export const LYRICS_MODEL_ID = 'stub-bundled'

export interface LyricsModel {
  propose(input: {
    phrases: readonly CatalogLyricLine[]
    targetLocale: TargetLocale
    meaningLanguage: NativeLanguage
    catalogVersion: number
    repairErrors?: readonly string[]
  }): Promise<unknown>
}

export class LyricsCoordinator {
  private readonly cache = new Map<string, MusicLyricsResponse>()

  constructor(private readonly model?: LyricsModel) {}

  async lyrics(request: MusicLyricsRequest, principalId: string): Promise<MusicLyricsResponse> {
    void principalId
    const { phrases, catalogVersion } = resolveMusicCatalogPhrases(
      request.catalog_phrase_ids,
      request.target_locale,
      request.meaning_language,
    )
    const cacheKey = lyricsCacheKey(request, catalogVersion)
    const cached = this.cache.get(cacheKey)
    if (cached) return { ...cached, cached: true }

    const floor = this.floor(phrases, request, catalogVersion)
    if (this.model === undefined) {
      this.cache.set(cacheKey, floor)
      return floor
    }

    const first = await this.model.propose({
      phrases,
      targetLocale: request.target_locale,
      meaningLanguage: request.meaning_language,
      catalogVersion,
    })
    const firstValid = validateLyricDocument(first, phrases, phrases)
    if (firstValid.ok) {
      const live = served(firstValid.document, 'live', false)
      this.cache.set(cacheKey, live)
      return live
    }

    const repaired = await this.model.propose({
      phrases,
      targetLocale: request.target_locale,
      meaningLanguage: request.meaning_language,
      catalogVersion,
      repairErrors: firstValid.errors,
    })
    const repairedValid = validateLyricDocument(repaired, phrases, phrases)
    if (repairedValid.ok) {
      const live = served(repairedValid.document, 'live', false)
      this.cache.set(cacheKey, live)
      return live
    }

    this.cache.set(cacheKey, floor)
    return floor
  }

  private floor(
    phrases: CatalogLyricLine[],
    request: MusicLyricsRequest,
    catalogVersion: number,
  ): MusicLyricsResponse {
    const document = bundledLyricDocument(
      phrases,
      request.target_locale,
      request.meaning_language,
      catalogVersion,
    )
    const valid = validateLyricDocument(document, phrases, phrases)
    if (!valid.ok) throw new LoroError('INTERNAL', 'Bundled lyrics failed validation')
    return served(valid.document, 'bundled', true)
  }
}

function served(
  document: LyricDocument,
  provenance: MusicLyricsResponse['provenance'],
  fallback: boolean,
): MusicLyricsResponse {
  return {
    lyric_document_id: lyricDocumentId(document),
    document,
    provenance,
    fallback,
    cached: false,
  }
}

export function lyricDocumentId(document: LyricDocument): string {
  return `lyric_${createHash('sha256').update(JSON.stringify(document.phrase_ids)).digest('hex').slice(0, 16)}`
}

export function lyricsCacheKey(request: MusicLyricsRequest, catalogVersion: number): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        schema_version: 1,
        prompt_version: LYRICS_PROMPT_VERSION,
        model_id: LYRICS_MODEL_ID,
        target_locale: request.target_locale,
        meaning_language: request.meaning_language,
        catalog_version: catalogVersion,
        ordered_catalog_ids: request.catalog_phrase_ids,
        tag_bucket: request.tag_profile ?? null,
      }),
    )
    .digest('hex')
}
