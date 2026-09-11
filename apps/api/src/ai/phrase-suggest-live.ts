/**
 * Optional Anthropic Discover suggest. Missing keys stay on the bundled path.
 * Query text is untrusted; the adapter never accepts audio.
 */
import {
  PhraseSuggestCandidateSchema,
  type PhraseSuggestRequest,
  type PhraseSuggestResponse,
} from '@loro/core/api/draft'
import { config } from '../common/config.js'
import { AnthropicMessages } from '../integrations/anthropic/messages.js'

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
        required: ['target_text', 'translation'],
        properties: {
          target_text: { type: 'string' },
          translation: { type: 'string' },
          theme: { type: 'string' },
          emoji: { type: 'string' },
        },
      },
    },
  },
} as const

export async function proposeLiveSuggestions(
  request: PhraseSuggestRequest,
  send: typeof fetch = fetch,
): Promise<PhraseSuggestResponse | null> {
  const apiKey = config.aiApiKey()?.trim()
  const model = config.aiSuggestModel().trim()
  if (!apiKey || !model) return null
  try {
    const client = new AnthropicMessages(
      {
        apiKey,
        model,
        timeoutMs: 20_000,
        maxTokens: 1024,
        maxRequestBytes: 16_384,
        maxResponseBytes: 32_768,
        maxConcurrentRequests: 2,
      },
      send,
    )
    const result = await client.generate({
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
