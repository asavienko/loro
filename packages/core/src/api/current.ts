import { oauthOperations } from './oauth-operations.js'
import { withExamples, currentExamples } from './examples.js'
/** Observed development surface. Not a production safety or input-validation guarantee. */
import { z } from 'zod'
import { CatalogPhraseSchema } from './catalog.js'
import type { Operation } from './operation.js'
export { CatalogPhraseSchema, WordGlossSchema } from './catalog.js'
export type { CatalogPhrase, WordGloss } from './catalog.js'

export const ErrorCodeSchema = z.enum([
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'PLAN_REQUIRED',
  'SCHEMA_TOO_OLD',
  'RATE_LIMITED',
  'BUDGET_EXCEEDED',
  'VALIDATION_FAILED',
  'PROVIDER_UNAVAILABLE',
  'INTERNAL',
  'NOT_FOUND',
])
export const ProblemSchema = z.looseObject({
  type: z.string(),
  title: z.string(),
  status: z.int(),
  detail: z.string().optional(),
  code: ErrorCodeSchema,
})
export const HlcSchema = z.object({
  physical: z.number(),
  logical: z.number(),
  node_id: z.string(),
})
export const FieldSchema = z.object({ v: z.unknown(), hlc: HlcSchema })
export const PushOpSchema = z.object({
  seq: z.number(),
  entity: z.string(),
  entity_id: z.string(),
  op: z.enum(['upsert', 'delete']),
  fields: z.record(z.string(), FieldSchema).optional(),
  deleted_at: z.number().nullable().optional(),
})
export const PushRequestSchema = z.object({
  client_hlc: z.string().optional(),
  ops: z.array(PushOpSchema).max(500),
})
export const RejectionSchema = z.object({
  seq: z.number(),
  code: z.string(),
  field: z.string().optional(),
})
export const PushResponseSchema = z.looseObject({
  accepted: z.array(z.number()),
  rejected: z.array(RejectionSchema),
  conflicts: z.array(z.string()),
  server_hlc: z.string(),
  server_time: z.number(),
})
export const PullRequestSchema = z.object({
  since: z.string().optional(),
  limit: z.number().optional(),
})
export const StoredRowSchema = z.object({
  entity: z.string(),
  id: z.string(),
  fields: z.record(z.string(), FieldSchema),
  deleted_at: z.number().nullable().optional(),
})
export const PullResponseSchema = z.looseObject({
  changes: z.array(StoredRowSchema),
  next: z.string(),
  has_more: z.literal(false),
  server_hlc: z.string(),
})
export const StatusResponseSchema = z.looseObject({ merge: z.string(), entities: z.number() })
export const HealthSchema = z.looseObject({ status: z.literal('ok'), version: z.string() })
export const ReadinessSchema = z.looseObject({
  status: z.enum(['ok', 'degraded']),
  checks: z.record(z.string(), z.string()),
})
export const ManifestSchema = z.looseObject({
  catalog_version: z.number(),
  lang: z.string(),
  phrase_count: z.number(),
  packs: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      emoji: z.string(),
      count: z.number(),
      onboarding: z.boolean(),
      trip: z.boolean(),
    }),
  ),
  scenarios: z.array(
    z.object({ id: z.string(), label: z.string(), emoji: z.string(), count: z.number() }),
  ),
  audio_base: z.string(),
  min_app_version: z.string(),
})
export const DiffSchema = z.looseObject({
  from: z.number(),
  to: z.number(),
  upserts: z.array(CatalogPhraseSchema),
  deprecations: z.array(z.object({ id: z.string(), deprecated_by: z.string() })),
  full_resync_required: z.boolean(),
})
export const PackSchema = z.looseObject({
  id: z.string(),
  label: z.string(),
  promised_count: z.number(),
  phrases: z.array(CatalogPhraseSchema),
})
const Line = z.object({ es: z.string(), en: z.string() })
export const SceneOptionSchema = Line.extend({
  best: z.boolean().optional(),
  tip: z.string(),
  phrase_id: z.string().optional(),
})
export const SceneSchema = z.object({
  place: z.string(),
  city: z.string(),
  emoji: z.string(),
  role: z.string(),
  turns: z.array(z.object({ npc: Line, options: z.array(SceneOptionSchema) })),
  closer: Line,
})
export const SceneRequestSchema = z.object({
  theme: z.string().optional(),
  level: z.string().optional(),
})
export const SceneResponseSchema = z.looseObject({
  scene_id: z.string(),
  cached: z.boolean(),
  fallback: z.boolean(),
  scene: SceneSchema,
})
export const ThemesSchema = z.looseObject({ themes: z.array(z.string()), provider: z.string() })
export type PushRequest = z.infer<typeof PushRequestSchema>
export type PushResponse = z.infer<typeof PushResponseSchema>
export type PullRequest = z.infer<typeof PullRequestSchema>
export type PullResponse = z.infer<typeof PullResponseSchema>
export type SceneResponse = z.infer<typeof SceneResponseSchema>
export type Problem = z.infer<typeof ProblemSchema>

const errors = {
  400: { schema: ProblemSchema, mediaType: 'application/problem+json' },
  422: { schema: ProblemSchema, mediaType: 'application/problem+json' },
  500: { schema: ProblemSchema, mediaType: 'application/problem+json' },
} as const
const base = { status: 'implemented', auth: 'none', requirements: ['F-04'], owner: 66 } as const
const lang = z.literal('es-ES').optional()
const legacyOperations = withExamples(
  [
    {
      ...base,
      id: 'health',
      method: 'get',
      path: '/health',
      summary: 'Liveness',
      responses: {
        200: {
          schema: HealthSchema,
          examples: [{ name: 'healthy', value: { status: 'ok', version: '0.0.0' } }],
        },
      },
      behavior: 'No auth. Liveness is independent of dependencies.',
    },
    {
      ...base,
      id: 'readiness',
      method: 'get',
      path: '/health/ready',
      summary: 'WASM readiness',
      responses: { 200: { schema: ReadinessSchema }, 503: { schema: ReadinessSchema } },
      behavior: '503 is JSON checks, not RFC 9457. Content and WASM only.',
    },
    {
      ...base,
      id: 'contentManifest',
      method: 'get',
      path: '/content/manifest',
      summary: 'Bundled manifest',
      query: { lang },
      responses: { 200: { schema: ManifestSchema }, ...errors },
      behavior: 'Real membership counts; no ETag or Cache-Control.',
    },
    {
      ...base,
      id: 'contentDiff',
      method: 'get',
      path: '/content/diff',
      summary: 'Bundled catalog diff',
      query: { lang, from: z.string().optional() },
      responses: { 200: { schema: DiffSchema }, ...errors },
      behavior:
        'from is parsed with parseInt; older versions receive whole catalog; from=0 requests resync; no history.',
    },
    {
      ...base,
      id: 'contentPack',
      method: 'get',
      path: '/content/pack',
      summary: 'Pack by query',
      query: { lang, id: z.string() },
      responses: { 200: { schema: PackSchema }, ...errors },
      behavior: 'Unknown pack returns 422; preserves authored membership order.',
    },
    {
      ...base,
      id: 'syncPush',
      method: 'post',
      path: '/sync/push',
      summary: 'Development merge harness',
      request: { schema: PushRequestSchema, examples: [{ name: 'empty', value: { ops: [] } }] },
      responses: { 201: { schema: PushResponseSchema }, ...errors },
      behavior:
        'Nest default 201. Unscoped memory. Partial rejection: schema_unknown or VALIDATION_FAILED. Field HLC objects. Input checks are incomplete; schema describes intended well-formed calls, not all accidentally accepted inputs.',
    },
    {
      ...base,
      id: 'syncPull',
      method: 'post',
      path: '/sync/pull',
      summary: 'All development rows',
      request: { schema: PullRequestSchema },
      responses: { 201: { schema: PullResponseSchema }, ...errors },
      behavior:
        'Ignores since and limit; every process row; no tenant scope; next is a placeholder HLC.',
    },
    {
      ...base,
      id: 'syncStatus',
      method: 'post',
      path: '/sync/status',
      summary: 'Development diagnostic',
      responses: { 201: { schema: StatusResponseSchema } },
      behavior: 'WASM availability and global row count; not production sync health.',
    },
    {
      ...base,
      id: 'aiScene',
      method: 'post',
      path: '/ai/scene',
      summary: 'Bundled scene',
      request: { schema: SceneRequestSchema },
      responses: { 201: { schema: SceneResponseSchema }, ...errors },
      behavior:
        'JSON only; optional level ignored. Stub or bundled fallback, no live provider or budgets.',
    },
    {
      ...base,
      id: 'aiThemes',
      method: 'get',
      path: '/ai/themes',
      summary: 'Bundled themes',
      responses: { 200: { schema: ThemesSchema } },
      behavior: 'Exposes configured provider name; not provider health.',
    },
  ] as const satisfies readonly Operation[],
  currentExamples,
)

export const currentOperations: readonly Operation[] = [
  ...legacyOperations,
  ...oauthOperations(ProblemSchema),
]

export type { Operation, ResponseContract } from './operation.js'

export type ErrorCode = z.infer<typeof ErrorCodeSchema>

export type Hlc = z.infer<typeof HlcSchema>

export type Field = z.infer<typeof FieldSchema>

export type PushOp = z.infer<typeof PushOpSchema>

export type Rejection = z.infer<typeof RejectionSchema>

export type StoredRow = z.infer<typeof StoredRowSchema>

export type StatusResponse = z.infer<typeof StatusResponseSchema>

export type Health = z.infer<typeof HealthSchema>

export type Readiness = z.infer<typeof ReadinessSchema>

export type Manifest = z.infer<typeof ManifestSchema>

export type Diff = z.infer<typeof DiffSchema>

export type Pack = z.infer<typeof PackSchema>

export type SceneOption = z.infer<typeof SceneOptionSchema>

export type Scene = z.infer<typeof SceneSchema>

export type SceneRequest = z.infer<typeof SceneRequestSchema>

export type Themes = z.infer<typeof ThemesSchema>
