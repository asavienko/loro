import { z } from 'zod'

export const TimestampSchema = z.int().nonnegative()
export const CountSchema = z.int().nonnegative()
export const RowIdSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
export const ResourceIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9_-]+$/)
export const CatalogIdSchema = z.string().regex(/^[a-z0-9]{2,12}$/)
export const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/)
export const LocalDateSchema = z.iso.date()
export const ClockTimeSchema = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/)
export const AppVersionSchema = z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?\+\d+$/)
export const HlcSchema = z
  .string()
  .regex(/^\d{1,16}:\d{4,10}:[A-Za-z0-9_-]{1,128}$/)
  .refine((value) => {
    const [physical, logical] = value.split(':').map(Number)
    return Number.isSafeInteger(physical) && logical !== undefined && logical <= 4_294_967_295
  }, 'HLC physical must be safe integer; logical must fit Rust u32')
export const CursorSchema = z
  .string()
  .min(1)
  .max(1024)
  .regex(/^[A-Za-z0-9_-]+$/)
export const EngineSchema = z.enum([
  'stream',
  'refrain',
  'srs',
  'prosody',
  'pronunciation',
  'roleplay',
  'run',
])
export const TagSchema = z.enum(['pron', 'remember', 'useful', 'words'])
export const DifficultySchema = z.enum(['easy', 'med', 'hard'])
export const GradeSchema = z.enum(['again', 'hard', 'good', 'easy'])
export const RegisterSchema = z.enum(['neutral', 'casual', 'formal'])
export const LocaleSchema = z.literal('es-ES')
export const TextSchema = z.string().trim().min(1).max(2000)
export const ScoreSchema = z.number().min(0).max(100).nullable()
export const LatencySchema = CountSchema.nullable()
export const LineSchema = z.strictObject({ es: TextSchema, en: TextSchema })
export const ProvenanceSchema = z.enum(['live', 'bundled', 'cache'])
export const appHeaders = { 'X-Loro-App': AppVersionSchema }
export const idempotencyHeaders = { ...appHeaders, 'Idempotency-Key': RowIdSchema }
export const syncHeaders = { ...appHeaders, 'X-Loro-Device': ResourceIdSchema }
export const rateHeaders = {
  'Retry-After': CountSchema,
  'X-RateLimit-Limit': CountSchema,
  'X-RateLimit-Remaining': CountSchema,
  'X-RateLimit-Reset': TimestampSchema,
}
export const cacheHeaders = { ETag: z.string(), 'Cache-Control': z.string() }

export const errorStatus = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  PLAN_REQUIRED: 402,
  SCHEMA_TOO_OLD: 409,
  RATE_LIMITED: 429,
  BUDGET_EXCEEDED: 429,
  VALIDATION_FAILED: 422,
  PROVIDER_UNAVAILABLE: 503,
  INTERNAL: 500,
  NOT_FOUND: 404,
  CURSOR_EXPIRED: 409,
} as const
export const ErrorCodeSchema = z.enum(
  Object.keys(errorStatus) as [keyof typeof errorStatus, ...(keyof typeof errorStatus)[]],
)
export const ProblemSchema = z
  .looseObject({
    type: z.url(),
    title: z.string(),
    status: z.int(),
    code: ErrorCodeSchema,
    detail: z.string().optional(),
    min_app_version: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.status !== errorStatus[value.code])
      ctx.addIssue({ code: 'custom', path: ['status'], message: 'Status must match error code' })
    if (value.code === 'SCHEMA_TOO_OLD' && !value.min_app_version)
      ctx.addIssue({
        code: 'custom',
        path: ['min_app_version'],
        message: 'Minimum version required',
      })
  })
export type Problem = z.infer<typeof ProblemSchema>
export type Hlc = z.infer<typeof HlcSchema>
export const targetErrors = Object.fromEntries(
  [...new Set(Object.values(errorStatus))].map((status) => [
    status,
    {
      schema: ProblemSchema,
      mediaType: 'application/problem+json' as const,
      description: 'Code selects client recovery; never render internal detail verbatim.',
      ...(status === 429 ? { headers: rateHeaders } : {}),
    },
  ]),
)

export type Timestamp = z.infer<typeof TimestampSchema>

export type Count = z.infer<typeof CountSchema>

export type RowId = z.infer<typeof RowIdSchema>

export type ResourceId = z.infer<typeof ResourceIdSchema>

export type CatalogId = z.infer<typeof CatalogIdSchema>

export type Sha256 = z.infer<typeof Sha256Schema>

export type LocalDate = z.infer<typeof LocalDateSchema>

export type ClockTime = z.infer<typeof ClockTimeSchema>

export type AppVersion = z.infer<typeof AppVersionSchema>

export type Cursor = z.infer<typeof CursorSchema>

export type Engine = z.infer<typeof EngineSchema>

export type Tag = z.infer<typeof TagSchema>

export type Difficulty = z.infer<typeof DifficultySchema>

export type Grade = z.infer<typeof GradeSchema>

export type Register = z.infer<typeof RegisterSchema>

export type Locale = z.infer<typeof LocaleSchema>

export type Text = z.infer<typeof TextSchema>

export type Score = z.infer<typeof ScoreSchema>

export type Latency = z.infer<typeof LatencySchema>

export type Line = z.infer<typeof LineSchema>

export type Provenance = z.infer<typeof ProvenanceSchema>

export type ErrorCode = z.infer<typeof ErrorCodeSchema>
