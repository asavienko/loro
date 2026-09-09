/**
 * Guarded Discover phrase suggestions (plan 97 / AI-06). Draft until Q-21 enables live traffic.
 * Audio is structurally absent: the request type has no audio field.
 */
import { z } from 'zod'
import { NATIVE_LANGUAGES, TARGET_LOCALES, supportsPair } from '../domain/languages.js'
import { MAX_OWN_PHRASE_TEXT_CODE_UNITS } from '../domain/phrase.js'
import {
  PHRASE_SUGGEST_MAX_CANDIDATES,
  PHRASE_SUGGEST_MAX_QUERY,
  PHRASE_SUGGEST_MAX_WORDS,
  canonicalPhraseText,
  candidateIsAddable,
  containsPromptInjection,
  phraseWordCount,
} from '../domain/phraseReach.js'
import { ProvenanceSchema, RegisterSchema } from './common.js'

const pairOk = (value: { native_language: string; target_locale: string }) =>
  supportsPair(value.native_language, value.target_locale)

export const PhraseSuggestRequestSchema = z
  .strictObject({
    target_locale: z.enum(TARGET_LOCALES),
    native_language: z.enum(NATIVE_LANGUAGES),
    query: z.string().trim().min(2).max(PHRASE_SUGGEST_MAX_QUERY),
    level: z.enum(['beg', 'some', 'conf']).optional(),
    exclude_catalog_ids: z.array(z.string().min(1).max(32)).max(64).optional(),
  })
  .refine(pairOk, 'Unsupported language pair')

export const PhraseSuggestCandidateSchema = z
  .strictObject({
    target_text: z.string().trim().min(1).max(MAX_OWN_PHRASE_TEXT_CODE_UNITS),
    translation: z.string().trim().min(1).max(MAX_OWN_PHRASE_TEXT_CODE_UNITS),
    theme: z
      .enum([
        'Café',
        'Dining',
        'Travel',
        'Directions',
        'Shopping',
        'Small talk',
        'Survival',
        'Hotel',
        'Imported',
        'Mine',
        'Captured',
      ])
      .optional(),
    emoji: z.string().min(1).max(8).optional(),
    register: RegisterSchema.optional(),
    provenance: ProvenanceSchema,
    source: z.enum(['generated', 'custom', 'chat', 'import']),
    needs_review: z.literal(true),
  })
  .refine((row) => phraseWordCount(row.target_text) <= PHRASE_SUGGEST_MAX_WORDS, 'Maximum 12 words')

export const PhraseSuggestResponseSchema = z
  .strictObject({
    fallback: z.boolean(),
    provenance: z.union([ProvenanceSchema, z.literal('unavailable')]),
    candidates: z.array(PhraseSuggestCandidateSchema).max(PHRASE_SUGGEST_MAX_CANDIDATES),
  })
  .refine(
    (row) => row.provenance !== 'unavailable' || row.candidates.length === 0,
    'Unavailable has no rows',
  )
  .refine(
    (row) =>
      new Set(row.candidates.map((c) => canonicalPhraseText(c.target_text))).size ===
      row.candidates.length,
    'Candidates must be unique',
  )

export type PhraseSuggestRequest = z.infer<typeof PhraseSuggestRequestSchema>
export type PhraseSuggestCandidate = z.infer<typeof PhraseSuggestCandidateSchema>
export type PhraseSuggestResponse = z.infer<typeof PhraseSuggestResponseSchema>

export function unavailableSuggestResponse(): PhraseSuggestResponse {
  return { fallback: true, provenance: 'unavailable', candidates: [] }
}

export function validatePhraseSuggestExchange(
  request: unknown,
  response: unknown,
): PhraseSuggestResponse {
  const input = PhraseSuggestRequestSchema.parse(request)
  if (containsPromptInjection(input.query)) return unavailableSuggestResponse()
  return PhraseSuggestResponseSchema.parse(response)
}

export function assertAddableCandidates(response: PhraseSuggestResponse): void {
  for (const candidate of response.candidates) {
    if (
      !candidateIsAddable({
        targetText: candidate.target_text,
        translation: candidate.translation,
      })
    ) {
      throw new Error('Candidate is not addable')
    }
  }
}
