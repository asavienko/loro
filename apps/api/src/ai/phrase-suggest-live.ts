/**
 * Optional live Discover suggest through the text models (plan 111). Missing keys stay on the bundled
 * path. Query text is untrusted; the adapter never accepts audio.
 */
import {
  PhraseSuggestCandidateSchema,
  type PhraseSuggestRequest,
  type PhraseSuggestResponse,
} from '@loro/core/api/draft'
import { textModel } from '../integrations/models.js'
import type { StructuredTextModel } from '../integrations/text-model.js'

const CANDIDATE_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['candidates'],
  properties: {
    candidates: {
      type: 'array',
      maxItems: 6,
      items: {
        type: 'object',
        additionalProperties: false,
        // Strict schemas require every key; a row without a theme or emoji says null.
        required: ['target_text', 'translation', 'theme', 'emoji'],
        properties: {
          target_text: { type: 'string' },
          translation: { type: 'string' },
          theme: { type: ['string', 'null'] },
          emoji: { type: ['string', 'null'] },
        },
      },
    },
  },
} as const

let client: StructuredTextModel | null | undefined

/** One shared client, so its concurrency cap holds across requests. */
function suggestModel(): StructuredTextModel | null {
  if (client !== undefined) return client
  client = textModel({
    timeoutMs: 20_000,
    primaryTimeoutMs: 12_000,
    maxTokens: 1024,
    maxRequestBytes: 16_384,
    maxResponseBytes: 32_768,
    maxConcurrentRequests: 2,
  })
  return client
}

/** For tests: forget the client so a changed environment is read again, or use the one given. */
export function resetSuggestModel(model?: StructuredTextModel | null): void {
  client = model
}

export async function proposeLiveSuggestions(
  request: PhraseSuggestRequest,
): Promise<PhraseSuggestResponse | null> {
  const model = suggestModel()
  if (!model) return null
  try {
    const result = await model.generate({
      system:
        'Propose short language-learning phrases. No audio. No catalog ids. Keep each target under 12 words.',
      messages: [
        {
          role: 'user',
          content: `Native ${request.native_language}. Target ${request.target_locale}. Topic: ${request.query}`,
        },
      ],
      schema: CANDIDATE_JSON_SCHEMA,
      parse: parseLiveCandidates,
    })
    const candidates = result.value
    if (candidates.length === 0) return null
    return {
      fallback: false,
      provenance: 'live',
      candidates,
    }
  } catch {
    return null
  }
}

function parseLiveCandidates(value: unknown): PhraseSuggestResponse['candidates'] {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('invalid')
  }
  const rows = (value as { candidates?: unknown }).candidates
  if (!Array.isArray(rows)) throw new Error('invalid')
  return rows.map((row) => {
    if (row === null || typeof row !== 'object' || Array.isArray(row)) throw new Error('invalid')
    const record = row as Record<string, unknown>
    return PhraseSuggestCandidateSchema.parse({
      target_text: record['target_text'],
      translation: record['translation'],
      ...(typeof record['theme'] === 'string' ? { theme: record['theme'] } : {}),
      ...(typeof record['emoji'] === 'string' ? { emoji: record['emoji'] } : {}),
      provenance: 'live',
      source: 'generated',
      needs_review: true,
    })
  })
}
