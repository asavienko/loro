/**
 * Draft phrase-song contracts (plan 96). Structurally omit recordings, PCM, ASR, and
 * `conditioning_ref`. Live spend stays gated by plan-local Q-21.
 */
import { z } from 'zod'
import { NATIVE_LANGUAGES, TARGET_LOCALES } from '../domain/languages.js'
import {
  MUSIC_MAX_PHRASES,
  MUSIC_MAX_STYLES,
  MUSIC_MIN_PHRASES,
  MUSIC_MIN_STYLES,
  MUSIC_STYLE_IDS,
} from '../domain/lyric-plan.js'
import {
  CountSchema,
  ProvenanceSchema,
  ResourceIdSchema,
  Sha256Schema,
  TextSchema,
} from './common.js'

export const MUSIC_LYRIC_SCHEMA_VERSION = 1
export {
  MUSIC_MIN_PHRASES,
  MUSIC_MAX_PHRASES,
  MUSIC_MIN_STYLES,
  MUSIC_MAX_STYLES,
} from '../domain/lyric-plan.js'
export const MUSIC_MAX_TITLE_CHARS = 80
export const MUSIC_MAX_LINE_CHARS = 200
export const MUSIC_MAX_LINES_PER_SECTION = 30
export const MUSIC_MAX_SECTIONS = 8
export const MUSIC_SECTION_NAMES = [
  'Verse 1',
  'Verse 2',
  'Verse 3',
  'Chorus',
  'Bridge',
  'Outro',
] as const

/** Catalog ids as `loadLearningCatalog` publishes them (`cafe1` or `bg-BG:cafe1`). */
export const MusicCatalogPhraseIdSchema = z
  .string()
  .min(2)
  .max(32)
  .regex(/^(?:(?:es-ES|bg-BG|ru-RU):)?[a-z0-9]{2,12}$/)

export const MusicTargetLocaleSchema = z.enum(TARGET_LOCALES)
export const MusicMeaningLanguageSchema = z.enum(NATIVE_LANGUAGES)
export const MusicStyleIdSchema = z.enum(MUSIC_STYLE_IDS)
export const MusicSectionNameSchema = z.enum(MUSIC_SECTION_NAMES)

export const MusicTagProfileSchema = z.strictObject({
  pron: CountSchema,
  remember: CountSchema,
  useful: CountSchema,
  words: CountSchema,
})

const LyricLineSchema = z.string().trim().min(1).max(MUSIC_MAX_LINE_CHARS)
const TitleTextSchema = z.string().trim().min(1).max(MUSIC_MAX_TITLE_CHARS)

export const LyricSectionSchema = z.strictObject({
  name: MusicSectionNameSchema,
  lines: z.array(LyricLineSchema).min(1).max(MUSIC_MAX_LINES_PER_SECTION),
})

export const LyricUsedPhraseSchema = z.strictObject({
  catalog_phrase_id: MusicCatalogPhraseIdSchema,
  target_text: TextSchema,
  section_name: MusicSectionNameSchema,
  line_index: z
    .int()
    .nonnegative()
    .max(MUSIC_MAX_LINES_PER_SECTION - 1),
  match: z.enum(['exact_line', 'contiguous_span']),
})

export const LyricGlossLineSchema = z.strictObject({
  target: TextSchema,
  translation: TextSchema,
})

export const LyricDocumentSchema = z
  .strictObject({
    schema_version: z.literal(MUSIC_LYRIC_SCHEMA_VERSION),
    target_locale: MusicTargetLocaleSchema,
    meaning_language: MusicMeaningLanguageSchema,
    catalog_version: CountSchema,
    phrase_ids: z.array(MusicCatalogPhraseIdSchema).min(MUSIC_MIN_PHRASES).max(MUSIC_MAX_PHRASES),
    title: z.strictObject({
      target: TitleTextSchema,
      translation: TitleTextSchema,
    }),
    sections: z.array(LyricSectionSchema).min(1).max(MUSIC_MAX_SECTIONS),
    used_phrases: z.array(LyricUsedPhraseSchema).min(MUSIC_MIN_PHRASES).max(MUSIC_MAX_PHRASES),
    gloss_lines: z.array(LyricGlossLineSchema).max(MUSIC_MAX_PHRASES),
  })
  .superRefine((document, ctx) => {
    if (new Set(document.phrase_ids).size !== document.phrase_ids.length) {
      ctx.addIssue({ code: 'custom', message: 'Unique catalog phrase ids required' })
    }
    const sectionNames = document.sections.map((section) => section.name)
    if (new Set(sectionNames).size !== sectionNames.length) {
      ctx.addIssue({ code: 'custom', message: 'Section names must be unique' })
    }
  })

export const MusicLyricsRequestSchema = z
  .strictObject({
    target_locale: MusicTargetLocaleSchema,
    meaning_language: MusicMeaningLanguageSchema,
    catalog_phrase_ids: z
      .array(MusicCatalogPhraseIdSchema)
      .min(MUSIC_MIN_PHRASES)
      .max(MUSIC_MAX_PHRASES),
    tag_profile: MusicTagProfileSchema.optional(),
  })
  .superRefine((request, ctx) => {
    if (new Set(request.catalog_phrase_ids).size !== request.catalog_phrase_ids.length) {
      ctx.addIssue({ code: 'custom', message: 'Unique catalog phrase ids required' })
    }
  })

export const MusicLyricsResponseSchema = z.strictObject({
  lyric_document_id: ResourceIdSchema,
  document: LyricDocumentSchema,
  provenance: ProvenanceSchema,
  fallback: z.boolean(),
  cached: z.boolean(),
})

export const MusicRenderStatusSchema = z.enum(['queued', 'ready', 'failed', 'unknown_spend'])

export const MusicRendersRequestSchema = z
  .strictObject({
    lyric_document_id: ResourceIdSchema,
    style_ids: z.array(MusicStyleIdSchema).min(MUSIC_MIN_STYLES).max(MUSIC_MAX_STYLES),
  })
  .superRefine((request, ctx) => {
    if (new Set(request.style_ids).size !== request.style_ids.length) {
      ctx.addIssue({ code: 'custom', message: 'Unique style ids required' })
    }
  })

export const MusicRenderJobSchema = z.strictObject({
  job_id: ResourceIdSchema,
  style_id: MusicStyleIdSchema,
  status: MusicRenderStatusSchema,
  error_code: z
    .enum(['provider', 'copyright', 'budget', 'invalid_audio', 'unavailable'])
    .nullable(),
  track_id: ResourceIdSchema.nullable(),
  duration_ms: z.int().positive().nullable(),
})

export const MusicRendersResponseSchema = z.strictObject({
  lyric_document_id: ResourceIdSchema,
  jobs: z.array(MusicRenderJobSchema).min(MUSIC_MIN_STYLES).max(MUSIC_MAX_STYLES),
})

export const MusicTrackResponseSchema = z.strictObject({
  track_id: ResourceIdSchema,
  style_id: MusicStyleIdSchema,
  sha256: Sha256Schema,
  byte_length: z.int().nonnegative(),
  duration_ms: z.int().positive().nullable(),
  content_type: z.enum(['audio/mpeg', 'audio/wav']),
  generated: z.literal(true),
  download_path: z.string().regex(/^\/music\/tracks\/[A-Za-z0-9_-]+\/content$/),
})

export const MusicV2ChunkSchema = z.strictObject({
  text: z.string().min(1).max(8000),
  duration_ms: z.int().min(3000).max(120_000),
  positive_styles: z.array(z.string().min(1).max(80)).max(16),
  negative_styles: z.array(z.string().min(1).max(80)).max(16),
})

export const MusicV2CompositionPlanSchema = z.strictObject({
  chunks: z.array(MusicV2ChunkSchema).min(1).max(MUSIC_MAX_SECTIONS),
  context_adherence: z.literal('high'),
})

export type LyricDocument = z.infer<typeof LyricDocumentSchema>
export type LyricSection = z.infer<typeof LyricSectionSchema>
export type LyricUsedPhrase = z.infer<typeof LyricUsedPhraseSchema>
export type MusicLyricsRequest = z.infer<typeof MusicLyricsRequestSchema>
export type MusicLyricsResponse = z.infer<typeof MusicLyricsResponseSchema>
export type MusicRendersRequest = z.infer<typeof MusicRendersRequestSchema>
export type MusicRendersResponse = z.infer<typeof MusicRendersResponseSchema>
export type MusicRenderJob = z.infer<typeof MusicRenderJobSchema>
export type MusicTrackResponse = z.infer<typeof MusicTrackResponseSchema>
export type MusicV2CompositionPlan = z.infer<typeof MusicV2CompositionPlanSchema>
export type MusicV2Chunk = z.infer<typeof MusicV2ChunkSchema>
export type MusicStyleId = z.infer<typeof MusicStyleIdSchema>
export type MusicTagProfile = z.infer<typeof MusicTagProfileSchema>
