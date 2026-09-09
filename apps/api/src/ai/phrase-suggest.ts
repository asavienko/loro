/**
 * Guarded Discover phrase suggest — stub/bundled only until Q-21.
 */
import * as content from '@loro/content'
import {
  PhraseSuggestRequestSchema,
  assertAddableCandidates,
  unavailableSuggestResponse,
  validatePhraseSuggestExchange,
  type PhraseSuggestResponse,
} from '@loro/core/api/draft'

export function livePhraseSuggestEnabled(): boolean {
  return false
}

export function suggestPhrases(body: unknown): PhraseSuggestResponse {
  const parsed = PhraseSuggestRequestSchema.safeParse(body)
  if (!parsed.success) throw parsed.error
  // Fail closed until Q-21 wires a provider: flipping this flag must not call a model.
  // Live enablement keeps this bundled path as the fallback, then adds the provider branch.
  if (livePhraseSuggestEnabled()) return unavailableSuggestResponse()
  try {
    const rows = content.bundledTopicSuggestions(
      parsed.data.query,
      parsed.data.native_language,
      parsed.data.target_locale,
    )
    const response: PhraseSuggestResponse =
      rows.length === 0
        ? unavailableSuggestResponse()
        : {
            fallback: true,
            provenance: 'bundled',
            candidates: rows.map((row) => ({
              target_text: row.targetText,
              translation: row.translation,
              ...(row.theme === undefined ? {} : { theme: row.theme }),
              ...(row.emoji === undefined ? {} : { emoji: row.emoji }),
              provenance: 'bundled',
              source: 'generated',
              needs_review: true as const,
            })),
          }
    const validated = validatePhraseSuggestExchange(parsed.data, response)
    assertAddableCandidates(validated)
    return validated
  } catch {
    return unavailableSuggestResponse()
  }
}
