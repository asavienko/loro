/**
 * Discover suggestions go through POST /phrases/suggest when an API is configured.
 * Offline and failed calls keep the bundled topic list. No audio field.
 */
import {
  PhraseSuggestRequestSchema,
  PhraseSuggestResponseSchema,
  type PhraseSuggestRequest,
} from '@loro/core/api/draft'
import {
  filterNewCandidates,
  type NativeLanguage,
  type PhraseCandidate,
  type TargetLocale,
} from '@loro/core'
import { bundledTopicSuggestions } from '@loro/content'
import { bundledApiUrl } from './account/config'
import { requestWithTimeout } from './backend'

export async function requestPhraseSuggestions(
  input: {
    query: string
    nativeLanguage: NativeLanguage
    targetLocale: TargetLocale
    existingTexts: readonly string[]
  },
  baseUrl: string | null = bundledApiUrl(),
  send: typeof fetch = fetch,
): Promise<readonly PhraseCandidate[]> {
  const local = filterNewCandidates(
    bundledTopicSuggestions(input.query, input.nativeLanguage, input.targetLocale),
    input.existingTexts,
  )
  if (!baseUrl) return local
  let parsed: PhraseSuggestRequest
  try {
    parsed = PhraseSuggestRequestSchema.parse({
      query: input.query,
      native_language: input.nativeLanguage,
      target_locale: input.targetLocale,
    })
  } catch {
    return local
  }
  try {
    const response = await requestWithTimeout(
      `${baseUrl}/phrases/suggest`,
      {
        method: 'POST',
        credentials: 'omit',
        cache: 'no-store',
        redirect: 'error',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(parsed),
      },
      send,
    )
    if (!response.ok) return local
    const body = PhraseSuggestResponseSchema.safeParse(await response.json())
    // Current API returns `unavailable` when bundled topics are empty. Keep the
    // empty-bundled branch so a stale payload cannot hide "Suggested for this".
    if (
      !body.success ||
      body.data.provenance === 'unavailable' ||
      (body.data.provenance === 'bundled' &&
        body.data.fallback &&
        body.data.candidates.length === 0)
    )
      return local
    return filterNewCandidates(
      body.data.candidates.map((row) => ({
        targetText: row.target_text,
        translation: row.translation,
        ...(row.theme === undefined ? {} : { theme: row.theme }),
        ...(row.emoji === undefined ? {} : { emoji: row.emoji }),
        provenance: row.provenance,
        source: row.source,
        needsReview: true as const,
      })),
      input.existingTexts,
    )
  } catch {
    return local
  }
}
