/** F-04/F-08: implemented multilingual catalog wire contract, separate from legacy es/en. */
import { z } from 'zod'
import { NATIVE_LANGUAGES, TARGET_LOCALES, supportsPair } from '../domain/languages.js'
import { CatalogPhraseSchema } from './catalog.js'
import type { Operation } from './operation.js'

const TargetSchema = z.enum(TARGET_LOCALES)
const NativeSchema = z.enum(NATIVE_LANGUAGES)
const pair = {
  target: TargetSchema.default('es-ES'),
  native: NativeSchema.default('en'),
}
const validPair = (value: { target: string; native: string }) =>
  supportsPair(value.native, value.target)
export const LearningCatalogQuerySchema = z
  .object(pair)
  .refine(validPair, 'Unsupported language pair')
export const LearningVersionQuerySchema = z
  .string()
  .regex(/^\d+$/)
  .refine((value) => Number.isSafeInteger(Number(value)), 'Invalid catalog version')
  .default('0')
export const LearningDiffQuerySchema = z
  .object({ ...pair, from: LearningVersionQuerySchema })
  .refine(validPair, 'Unsupported language pair')
export const LearningPackQuerySchema = z
  .object({ ...pair, id: z.string().min(1) })
  .refine(validPair, 'Unsupported language pair')
const TeachingSchema = z.object({
  resp: z.string().optional(),
  hint: z.string().optional(),
  note: z.string().optional(),
  words: z
    .array(z.object({ targetText: z.string(), gloss: z.string(), say: z.string().optional() }))
    .optional(),
  example: z.object({ targetText: z.string(), translation: z.string() }).optional(),
})
export const LearningPhraseSchema = z.object({
  id: z.string(),
  targetLocale: TargetSchema,
  targetText: z.string(),
  translations: z.partialRecord(NativeSchema, z.string()),
  theme: CatalogPhraseSchema.shape.theme,
  emoji: z.string(),
  register: CatalogPhraseSchema.shape.register,
  cefr: CatalogPhraseSchema.shape.cefr,
  teaching: z.partialRecord(NativeSchema, TeachingSchema).optional(),
  respIpa: z.string().optional(),
  audio: CatalogPhraseSchema.shape.audio,
  f0Native: CatalogPhraseSchema.shape.f0_native,
  syl: CatalogPhraseSchema.shape.syl,
  deprecatedBy: z.string().optional(),
})
const identity = { targetLocale: TargetSchema, nativeLanguage: NativeSchema }
const SummarySchema = z.object({
  id: z.string(),
  label: z.string(),
  emoji: z.string(),
  count: z.int().nonnegative(),
})
export const LearningManifestSchema = z.object({
  ...identity,
  catalogVersion: z.int().nonnegative(),
  reviewStatus: z.enum(['pending-bilingual-review', 'legacy']),
  phraseCount: z.int().nonnegative(),
  capabilities: z.object({
    audio: z.boolean(),
    asr: z.boolean(),
    pronunciationScoring: z.boolean(),
  }),
  packs: z.array(SummarySchema.extend({ onboarding: z.boolean() })),
  scenarios: z.array(SummarySchema),
})
export const LearningDiffSchema = z.object({
  ...identity,
  from: z.int().nonnegative(),
  to: z.int().nonnegative(),
  upserts: z.array(LearningPhraseSchema),
  deprecations: z.array(z.never()),
  fullResyncRequired: z.boolean(),
})
export const LearningPackSchema = z.object({
  ...identity,
  id: z.string(),
  label: z.string(),
  phrases: z.array(LearningPhraseSchema),
})
export type LearningCatalogQuery = z.infer<typeof LearningCatalogQuerySchema>
export type LearningDiffQuery = z.infer<typeof LearningDiffQuerySchema>
export type LearningPackQuery = z.infer<typeof LearningPackQuerySchema>
export type LearningManifest = z.infer<typeof LearningManifestSchema>
export type LearningDiff = z.infer<typeof LearningDiffSchema>
export type LearningPack = z.infer<typeof LearningPackSchema>
export type LearningPhrase = z.infer<typeof LearningPhraseSchema>

export function learningContentOperations(problem: z.ZodType): readonly Operation[] {
  const base = {
    status: 'implemented',
    auth: 'none',
    requirements: ['F-04', 'F-08'],
    owner: 66,
  } as const
  const errors = {
    422: { schema: problem, mediaType: 'application/problem+json' },
    500: { schema: problem, mediaType: 'application/problem+json' },
  } as const
  return [
    {
      ...base,
      id: 'learningContentManifest',
      method: 'get',
      path: '/content/v2/manifest',
      summary: 'Multilingual bundled manifest',
      query: pair,
      responses: { 200: { schema: LearningManifestSchema }, ...errors },
      behavior:
        'Defaults to es-ES/en. Matching native/target languages are rejected. Real membership counts; no ETag or Cache-Control.',
    },
    {
      ...base,
      id: 'learningContentDiff',
      method: 'get',
      path: '/content/v2/diff',
      summary: 'Multilingual bundled catalog snapshot',
      query: { ...pair, from: LearningVersionQuerySchema },
      responses: { 200: { schema: LearningDiffSchema }, ...errors },
      behavior:
        'Decimal safe-integer version. Same version returns no upserts; every other version returns the full bundled catalog with fullResyncRequired. Deprecations are empty. Matching native/target languages are rejected.',
    },
    {
      ...base,
      id: 'learningContentPack',
      method: 'get',
      path: '/content/v2/pack',
      summary: 'Multilingual bundled pack',
      query: { ...pair, id: z.string().min(1) },
      responses: { 200: { schema: LearningPackSchema }, ...errors },
      behavior:
        'Unknown pack or unsupported language pair returns 422. Neutral targetText/translations payload; legacy content routes remain unchanged.',
    },
  ]
}

/** Illustrative transport fixtures, never a source of learner content. */
const exampleIdentity = { targetLocale: 'es-ES', nativeLanguage: 'en' }
const examplePhrase = {
  id: 'cafe1',
  targetLocale: 'es-ES',
  targetText: 'Un café, por favor.',
  translations: { en: 'A coffee, please.' },
  theme: 'Café',
  emoji: '☕',
}
export const learningContentExamples = {
  learningContentManifest: {
    responses: {
      200: {
        ...exampleIdentity,
        catalogVersion: 1,
        reviewStatus: 'legacy',
        phraseCount: 1,
        capabilities: { audio: false, asr: false, pronunciationScoring: false },
        packs: [{ id: 'cafe', label: 'Café', emoji: '☕', count: 1, onboarding: true }],
        scenarios: [],
      },
    },
  },
  learningContentDiff: {
    responses: {
      200: {
        ...exampleIdentity,
        from: 0,
        to: 1,
        upserts: [examplePhrase],
        deprecations: [],
        fullResyncRequired: true,
      },
    },
  },
  learningContentPack: {
    responses: { 200: { ...exampleIdentity, id: 'cafe', label: 'Café', phrases: [examplePhrase] } },
  },
}
