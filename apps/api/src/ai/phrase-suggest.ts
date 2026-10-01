/**
 * Guarded Discover phrase suggest. Bundled topics are the default.
 * A configured text model (plan 111) may propose live rows; failures fall back to bundled.
 */
import * as content from '@loro/content'
import { containsPromptInjection } from '@loro/core'
import {
  PhraseSuggestRequestSchema,
  assertAddableCandidates,
  unavailableSuggestResponse,
  validatePhraseSuggestExchange,
  type PhraseSuggestResponse,
} from '@loro/core/api/draft'
import { textModelConfigured } from '../integrations/models.js'
import { proposeLiveSuggestions } from './phrase-suggest-live.js'

export function livePhraseSuggestEnabled(): boolean {
  return textModelConfigured()
}

export async function suggestPhrases(body: unknown): Promise<PhraseSuggestResponse> {
  const parsed = PhraseSuggestRequestSchema.safeParse(body)
  if (!parsed.success) throw parsed.error
  if (containsPromptInjection(parsed.data.query)) return unavailableSuggestResponse()
  if (livePhraseSuggestEnabled()) {
    const live = await proposeLiveSuggestions(parsed.data)
    if (live !== null) {
      try {
        const validated = validatePhraseSuggestExchange(parsed.data, live)
        assertAddableCandidates(validated)
        return validated
      } catch {
        // Bundled floor stays the honest fallback.
      }
    }
  }
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
