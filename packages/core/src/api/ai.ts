import { z } from 'zod'
import {
  LineSchema,
  TextSchema,
  ResourceIdSchema,
  CatalogIdSchema,
  RowIdSchema,
  LocaleSchema,
  RegisterSchema,
  CountSchema,
  ProvenanceSchema,
  ProblemSchema,
} from './common.js'
import { WordGlossSchema } from './catalog.js'
const Option = LineSchema.extend({
  best: z.boolean().optional(),
  tip: z.string().min(10).max(1000),
  phrase_id: CatalogIdSchema.optional(),
}).refine((option) => option.es.trim().split(/\s+/).length <= 12, 'Maximum 12 Spanish words')
export const SceneSchema = z.strictObject({
  place: TextSchema,
  city: TextSchema,
  emoji: z.string().min(1).max(8),
  role: TextSchema,
  turns: z
    .array(
      z.strictObject({
        npc: LineSchema,
        options: z
          .array(Option)
          .length(3)
          .superRefine((options, ctx) => {
            if (options.filter((o) => o.best === true).length !== 1)
              ctx.addIssue({ code: 'custom', message: 'Exactly one best option' })
            if (new Set(options.map((o) => o.es)).size !== 3)
              ctx.addIssue({ code: 'custom', message: 'Options must be distinct' })
          }),
      }),
    )
    .min(3)
    .max(4),
  closer: LineSchema,
})
export const SceneRequestSchema = z.strictObject({
  theme: TextSchema,
  level: z.enum(['new', 'some', 'confident']),
  tag_profile: z.strictObject({
    pron: CountSchema,
    remember: CountSchema,
    useful: CountSchema,
    words: CountSchema,
  }),
  phrase_ids: z.array(CatalogIdSchema).max(100),
  locale: LocaleSchema,
})
export const SceneResponseSchema = z.strictObject({
  scene_id: ResourceIdSchema,
  cached: z.boolean(),
  fallback: z.boolean(),
  provenance: ProvenanceSchema,
  scene: SceneSchema,
})
export const SceneEventSchema = z.discriminatedUnion('event', [
  z.strictObject({
    event: z.literal('started'),
    data: z.strictObject({ request_id: RowIdSchema }),
  }),
  z.strictObject({ event: z.literal('completed'), data: SceneResponseSchema }),
  z.strictObject({ event: z.literal('error'), data: ProblemSchema }),
])
export const ThemesSchema = z.looseObject({ themes: z.array(TextSchema) })
export const CoachRequestSchema = z.strictObject({
  scene_id: ResourceIdSchema,
  turn_index: CountSchema,
  npc: LineSchema,
  learner_text: TextSchema,
  locale: LocaleSchema,
})
export const CoachResponseSchema = z.discriminatedUnion('status', [
  z.strictObject({
    status: z.literal('available'),
    note: TextSchema,
    suggested_line: LineSchema.nullable(),
    provenance: ProvenanceSchema,
  }),
  z.strictObject({
    status: z.literal('unavailable'),
    reason: z.enum(['unsafe', 'invalid_output', 'provider_unavailable', 'budget']),
    provenance: z.literal('unavailable'),
  }),
])
export const TranslateRequestSchema = z.strictObject({
  lines: z.array(TextSchema).min(1).max(100),
  source: z.literal('es'),
  target: z.literal('en'),
})
export const TranslationSchema = z.discriminatedUnion('status', [
  z
    .strictObject({
      status: z.literal('available'),
      index: CountSchema,
      es: TextSchema,
      en: TextSchema,
      provenance: ProvenanceSchema,
      confidence: z.number().min(0).max(1).nullable(),
      needs_review: z.boolean(),
    })
    .refine(
      (r) => (r.confidence !== null && r.confidence >= 0.7) || r.needs_review,
      'Unknown or low confidence requires review',
    ),
  z.strictObject({
    status: z.literal('unavailable'),
    index: CountSchema,
    es: TextSchema,
    en: z.null(),
    provenance: z.literal('unavailable'),
    confidence: z.null(),
    needs_review: z.literal(true),
  }),
])
export const TranslateResponseSchema = z
  .strictObject({ results: z.array(TranslationSchema).max(100) })
  .refine(
    (r) => new Set(r.results.map((v) => v.index)).size === r.results.length,
    'Unique input indexes',
  )
export const EnrichRequestSchema = z.strictObject({ phrase: LineSchema, locale: LocaleSchema })
export const EnrichResponseSchema = z.strictObject({
  resp: TextSchema,
  words: z.array(WordGlossSchema).max(12),
  example: LineSchema,
  hint: TextSchema,
  register: RegisterSchema,
  provenance: ProvenanceSchema,
  review_required: z.literal(true),
})
export type SceneRequest = z.infer<typeof SceneRequestSchema>
export type SceneResponse = z.infer<typeof SceneResponseSchema>
export type SceneEvent = z.infer<typeof SceneEventSchema>
export type CoachRequest = z.infer<typeof CoachRequestSchema>
export type CoachResponse = z.infer<typeof CoachResponseSchema>
export type TranslateRequest = z.infer<typeof TranslateRequestSchema>
export type TranslateResponse = z.infer<typeof TranslateResponseSchema>
export type EnrichRequest = z.infer<typeof EnrichRequestSchema>
export type EnrichResponse = z.infer<typeof EnrichResponseSchema>

export type Scene = z.infer<typeof SceneSchema>

export type Themes = z.infer<typeof ThemesSchema>

export type Translation = z.infer<typeof TranslationSchema>

/** Bind a translation batch to the exact reviewed input; no dropped or swapped lines. */
export function validateTranslationExchange(
  request: unknown,
  response: unknown,
): TranslateResponse {
  const input = TranslateRequestSchema.parse(request)
  const result = TranslateResponseSchema.parse(response)
  if (
    result.results.length !== input.lines.length ||
    result.results.some((line, index) => line.index !== index || line.es !== input.lines[index])
  ) {
    throw new Error('Translation response must preserve every input line and index')
  }
  return result
}
