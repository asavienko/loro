import { withExamples, targetExamples } from './examples.js'
/** Stable planned surface. No draft imports; importing it cannot authorize gated features. */
import { z } from 'zod'
import type { Operation } from './operation.js'
import {
  appHeaders,
  syncHeaders,
  cacheHeaders,
  targetErrors,
  CountSchema,
  LocaleSchema,
  ResourceIdSchema,
  RowIdSchema,
} from './common.js'
import {
  PushEnvelopeSchema,
  PushRequestSchema,
  PushResponseSchema,
  PullRequestSchema,
  PullResponseSchema,
  ChangeSchema,
  MAX_SYNC_BYTES,
} from './sync.js'
import { ManifestSchema, DiffSchema, PackSchema, FullCatalogSchema } from './content.js'
import {
  SceneRequestSchema,
  SceneResponseSchema,
  SceneEventSchema,
  ThemesSchema,
  CoachRequestSchema,
  CoachResponseSchema,
  TranslateRequestSchema,
  TranslateResponseSchema,
  EnrichRequestSchema,
  EnrichResponseSchema,
} from './ai.js'
import {
  SignInRequestSchema,
  SignInResponseSchema,
  MagicLinkRequestSchema,
  MagicLinkResponseSchema,
  MagicVerifyRequestSchema,
  RefreshRequestSchema,
  TokenResponseSchema,
  ClaimRequestSchema,
  ClaimResultSchema,
  ExportQueuedSchema,
  ExportStatusSchema,
  DeleteAccountRequestSchema,
  DeleteAccountResponseSchema,
} from './account.js'
import {
  AnalyticsEnvelopeSchema,
  AnalyticsRequestSchema,
  AnalyticsResponseSchema,
} from './analytics.js'
export * from './common.js'
export * from './sync.js'
export * from './content.js'
export * from './ai.js'
export * from './account.js'
export * from './analytics.js'
export type { Operation } from './operation.js'

export const HealthSchema = z.looseObject({ status: z.literal('ok'), version: z.string() })
export const ReadinessSchema = z.looseObject({
  status: z.enum(['ok', 'degraded']),
  checks: z.record(ResourceIdSchema, z.enum(['ok', 'unavailable'])),
})
/** Server-only export. Private local threads are assembled on device, never uploaded for export. */
export const AccountExportSchema = z.looseObject({
  schema_version: z.literal(1),
  user: z.looseObject({ id: ResourceIdSchema }),
  changes: z.array(ChangeSchema),
  created_at: CountSchema,
})
const base = {
  status: 'planned',
  auth: 'bearer',
  owner: 66,
  requirements: ['F-04'],
  headers: appHeaders,
} as const
const authBase = {
  ...base,
  owner: 67,
  auth: 'none',
  requirements: ['F-01', 'F-02', 'F-07'],
} as const
const authBehavior =
  'No first-run sign-in requirement. Verify provider/email proof, then bind registered installation. anon_id is correlation only; never grants access to server rows. Preserve local data; merge requires full local push before success. No push token in v1.'
const contentBase = { ...base, owner: 61 }
const conditional = { ...appHeaders, 'If-None-Match': z.string().optional() }
const notModified = {
  schema: z.never(),
  description: 'No body; retain cached representation.',
  headers: cacheHeaders,
}
export const targetOperations = withExamples(
  [
    {
      ...base,
      id: 'health',
      method: 'get',
      path: '/health',
      auth: 'none',
      headers: {},
      summary: 'Liveness',
      responses: { 200: { schema: HealthSchema } },
      behavior: 'No downstream check; health probes need no app headers.',
    },
    {
      ...base,
      id: 'readiness',
      method: 'get',
      path: '/health/ready',
      auth: 'none',
      headers: {},
      summary: 'Dependency readiness',
      responses: { 200: { schema: ReadinessSchema }, 503: { schema: ReadinessSchema } },
      behavior:
        'Observe real dependencies only. 503 uses checks JSON; never report unavailable services as healthy.',
    },
    {
      ...authBase,
      id: 'authApple',
      method: 'post',
      path: '/auth/apple',
      summary: 'Sign in with Apple',
      request: { schema: SignInRequestSchema },
      responses: { 200: { schema: SignInResponseSchema }, ...targetErrors },
      behavior: authBehavior,
    },
    {
      ...authBase,
      id: 'authGoogle',
      method: 'post',
      path: '/auth/google',
      summary: 'Sign in with Google',
      request: { schema: SignInRequestSchema },
      responses: { 200: { schema: SignInResponseSchema }, ...targetErrors },
      behavior: authBehavior,
    },
    {
      ...authBase,
      id: 'authMagicLink',
      method: 'post',
      path: '/auth/magic-link',
      summary: 'Request sign-in code',
      request: { schema: MagicLinkRequestSchema },
      responses: { 202: { schema: MagicLinkResponseSchema }, ...targetErrors },
      behavior:
        'Always 202 for valid email regardless of existence; never enumerate accounts. Rate limit delivery.',
    },
    {
      ...authBase,
      id: 'authMagicVerify',
      method: 'post',
      path: '/auth/magic-link/verify',
      summary: 'Verify sign-in code',
      request: { schema: MagicVerifyRequestSchema },
      responses: { 200: { schema: SignInResponseSchema }, ...targetErrors },
      behavior: authBehavior,
    },
    {
      ...authBase,
      id: 'authRefresh',
      method: 'post',
      path: '/auth/refresh',
      summary: 'Rotate refresh token',
      request: { schema: RefreshRequestSchema },
      responses: { 200: { schema: TokenResponseSchema }, ...targetErrors },
      behavior:
        'Short-lived access; rotate refresh family. Reuse revokes family. Client single-flight refresh; never retry a consumed refresh blindly; re-auth retains outbox.',
    },
    {
      ...base,
      id: 'authClaim',
      method: 'post',
      path: '/auth/claim',
      owner: 67,
      summary: 'Authenticated local-data claim',
      headers: { ...syncHeaders, 'Idempotency-Key': RowIdSchema },
      request: { schema: ClaimRequestSchema },
      responses: { 200: { schema: ClaimResultSchema }, ...targetErrors },
      behavior:
        'Require bearer and registered device ownership; device header/body must match. Account scope server-derived. Idempotent claim ID; retry interruption; do not consider merge complete before outbox acknowledgement.',
    },
    {
      ...base,
      id: 'syncPush',
      method: 'post',
      path: '/sync/push',
      owner: 68,
      summary: 'Tenant-scoped background merge',
      headers: syncHeaders,
      request: {
        schema: PushRequestSchema,
        description:
          'Envelope validated first; validate each item with SyncPushRequest/PushOp schema and return per-index failures.',
      },
      responses: { 200: { schema: PushResponseSchema }, ...targetErrors },
      maxBodyBytes: MAX_SYNC_BYTES,
      behavior:
        '500 ops/512KiB. Validate envelope then each op; rejection includes nullable seq and input index. Only accepted seqs ack; unknown fields rejected. Duplicate seqs after first rejected. Replay keyed by principal/device/seq; inconsistent payload for reused seq rejected. Rust owns HLC/merge; server never trusts user_id. Draft trip entities not enabled. Full FSRS group required. Metadata logs only.',
    },
    {
      ...base,
      id: 'syncPull',
      method: 'post',
      path: '/sync/pull',
      owner: 68,
      summary: 'Tenant-scoped cursor page',
      headers: syncHeaders,
      request: { schema: PullRequestSchema },
      responses: { 200: { schema: PullResponseSchema }, ...targetErrors },
      behavior:
        'since=null starts bootstrap. Opaque signed cursor bound to principal and ordered durable change position; not a bare HLC or row offset. Cursor needs unique entity tie-break on equal (hlc,id). Stale cursor returns CURSOR_EXPIRED; retain local state/outbox and bootstrap from null. SCHEMA_TOO_OLD is reserved for an unsupported app version. Apply page + cursor atomically via Rust; tombstone rows have empty fields and explicit deleted_at. No device/tenant leakage.',
    },
    {
      ...contentBase,
      id: 'contentManifest',
      method: 'get',
      path: '/content/manifest',
      summary: 'Versioned content manifest',
      headers: conditional,
      query: { lang: LocaleSchema.default('es-ES') },
      responses: {
        200: { schema: ManifestSchema, headers: cacheHeaders },
        304: notModified,
        ...targetErrors,
      },
      behavior:
        'Public immutable content data behind documented bearer boundary. ETag/max-age=3600; actual counts. Full catalog/resource descriptors carry checksum and size; CDN assets require no bearer token.',
    },
    {
      ...contentBase,
      id: 'contentDiff',
      method: 'get',
      path: '/content/diff',
      summary: 'Versioned catalog changes',
      query: { lang: LocaleSchema.default('es-ES'), from: CountSchema },
      responses: { 200: { schema: DiffSchema }, ...targetErrors },
      behavior:
        'from must be a whole integer. from>current rejected 422. History gap/oversize diff sets full_resync_required; client fetches manifest full_catalog once and verifies checksum before atomic replacement. Retain owned/deprecated references.',
    },
    {
      ...contentBase,
      id: 'contentPack',
      method: 'get',
      path: '/content/pack/{id}',
      summary: 'Versioned pack contents',
      headers: conditional,
      pathParams: { id: ResourceIdSchema },
      query: { lang: LocaleSchema.default('es-ES') },
      responses: {
        200: { schema: PackSchema, headers: cacheHeaders },
        304: notModified,
        ...targetErrors,
      },
      behavior:
        'Unknown pack NOT_FOUND. Membership/count/order and checksum agree; offline cached pack remains usable. Current query route needs migration, not silent replacement.',
    },
    {
      ...base,
      id: 'aiScene',
      method: 'post',
      path: '/ai/scene',
      owner: 76,
      summary: 'Validated roleplay scene',
      headers: {
        ...appHeaders,
        Accept: z.enum(['application/json', 'text/event-stream']).optional(),
      },
      request: { schema: SceneRequestSchema },
      responses: {
        200: {
          schema: SceneResponseSchema,
          alternate: { mediaType: 'text/event-stream', schema: SceneEventSchema },
        },
        ...targetErrors,
      },
      behavior:
        'Negotiated JSON or SSE. SSE event/data framing; optional started then exactly one completed/error; no unvalidated token fragments. Disconnect before terminal event means failure and bundled continuation, not a partial scene. No EventSource resume promise. Three-four turns, one best of three; cache/budget/provider fallback preserves explicit provenance. Trip adaptation remains Q-07 draft.',
    },
    {
      ...base,
      id: 'aiThemes',
      method: 'get',
      path: '/ai/themes',
      owner: 76,
      summary: 'Available roleplay themes',
      responses: { 200: { schema: ThemesSchema }, ...targetErrors },
      behavior: 'Bundled local list on failure; no provider configuration exposed.',
    },
    {
      ...base,
      id: 'aiCoach',
      method: 'post',
      path: '/ai/coach',
      owner: 76,
      summary: 'Coach a submitted text line',
      request: { schema: CoachRequestSchema },
      responses: { 200: { schema: CoachResponseSchema }, ...targetErrors },
      behavior:
        'Untrusted text context only; validate scene/turn ownership. No transcript logging/shared personalized caching. If no validated note, show existing curated tip or omit.',
    },
    {
      ...base,
      id: 'aiTranslate',
      method: 'post',
      path: '/ai/translate',
      owner: 76,
      summary: 'Optional reviewed translation',
      request: { schema: TranslateRequestSchema },
      responses: { 200: { schema: TranslateResponseSchema }, ...targetErrors },
      behavior:
        'One indexed result per input, preserve text/order. Unknown or low confidence requires learner review; unavailable en=null. Confidence must be evidence-derived or null, never provider self-rating presented as calibrated. No automatic save.',
    },
    {
      ...base,
      id: 'aiEnrich',
      method: 'post',
      path: '/ai/enrich',
      auth: 'staff',
      owner: 61,
      summary: 'Staff-only authoring draft',
      request: { schema: EnrichRequestSchema },
      responses: { 200: { schema: EnrichResponseSchema }, ...targetErrors },
      behavior:
        'Staff scope mandatory. Human review before publish; never auto-mutates learner library or production catalog.',
    },
    {
      ...base,
      id: 'accountExport',
      method: 'get',
      path: '/account/export',
      owner: 67,
      summary: 'Create or reuse pending export job',
      responses: { 202: { schema: ExportQueuedSchema }, ...targetErrors },
      behavior:
        'Preserves documented GET job creation; no-store. Repeated request reuses pending job per principal. Server-only export downloaded then combined with private local data on device. Never upload raw chat to assemble export.',
    },
    {
      ...base,
      id: 'accountExportStatus',
      method: 'get',
      path: '/account/export/{job_id}',
      owner: 67,
      summary: 'Poll export job',
      pathParams: { job_id: ResourceIdSchema },
      responses: { 200: { schema: ExportStatusSchema }, ...targetErrors },
      behavior:
        'Owner-only/no-store. Cross-user IDs are NOT_FOUND. queued/running/ready/failed/expired states; signed URL short-lived. Retry/backoff for in-progress jobs; expired requires new export.',
    },
    {
      ...base,
      id: 'accountDelete',
      method: 'delete',
      path: '/account',
      owner: 67,
      summary: 'Schedule account erasure',
      request: { schema: DeleteAccountRequestSchema },
      responses: { 202: { schema: DeleteAccountResponseSchema }, ...targetErrors },
      behavior:
        'Repeat returns existing scheduled time, never extends it. 24h cancellation window via sign-in; after erasure revoke tokens/devices and prevent stale sync resurrection. Local erasure/export coordination belongs to client; outbox must not recreate deleted cloud account.',
    },
    {
      ...base,
      id: 'analyticsBatch',
      method: 'post',
      path: '/analytics/batch',
      owner: 71,
      summary: 'Consent-aware event batch',
      request: {
        schema: AnalyticsRequestSchema,
        description:
          'Validate envelope then each item with AnalyticsBatch schema. Unknown events/properties rejected by index, not persisted.',
      },
      responses: { 202: { schema: AnalyticsResponseSchema }, ...targetErrors },
      behavior:
        '500 events; dedup by principal/event_id. Server injects principal/server_ts. Consent checked on enqueue and upload; opt-out drops pending telemetry only. No text/audio; own phrases use salted hashes. Experiment exposures await draft configuration decision. Never retry permanent rejects.',
    },
  ] as const satisfies readonly Operation[],
  targetExamples,
)
export const targetComponents = {
  SyncPushRequest: PushRequestSchema,
  SyncPushEnvelope: PushEnvelopeSchema,
  AnalyticsBatch: AnalyticsRequestSchema,
  AnalyticsEnvelope: AnalyticsEnvelopeSchema,
  FullCatalog: FullCatalogSchema,
  AccountExport: AccountExportSchema,
}

export type Health = z.infer<typeof HealthSchema>

export type Readiness = z.infer<typeof ReadinessSchema>

export type AccountExport = z.infer<typeof AccountExportSchema>
