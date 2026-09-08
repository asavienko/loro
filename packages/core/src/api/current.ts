import { withExamples, currentExamples } from './examples.js'
/** Implemented HTTP surface. Content and AI retain their documented development behavior. */
import { z } from 'zod'
import { CatalogPhraseSchema } from './catalog.js'
import type { Operation } from './operation.js'
import { ErrorCodeSchema, HlcSchema, ResourceIdSchema, RowIdSchema } from './common.js'
import {
  type PushOpSchema,
  type SyncRejectionSchema as RejectionSchema,
  type ChangeSchema as StoredRowSchema,
  PushRequestSchema,
  PushResponseSchema,
  PullRequestSchema,
  PullResponseSchema,
  MAX_SYNC_BYTES,
} from './sync.js'
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
  UserSchema,
} from './account.js'
export { ErrorCodeSchema, HlcSchema } from './common.js'
export {
  PushOpSchema,
  PushRequestSchema,
  PushResponseSchema,
  PullRequestSchema,
  PullResponseSchema,
  SyncRejectionSchema as RejectionSchema,
  ChangeSchema as StoredRowSchema,
} from './sync.js'
export type { PushRequest, PushResponse, PullRequest, PullResponse } from './sync.js'
export {
  SignInRequestSchema,
  SignInResponseSchema,
  MagicLinkRequestSchema,
  MagicLinkResponseSchema,
  MagicVerifyRequestSchema,
  RefreshRequestSchema,
  TokenResponseSchema,
  ClaimRequestSchema,
  ClaimResultSchema,
} from './account.js'
export type {
  SignInRequest,
  SignInResponse,
  MagicLinkRequest,
  MagicLinkResponse,
  MagicVerifyRequest,
  RefreshRequest,
  TokenResponse,
  ClaimRequest,
  ClaimResult,
} from './account.js'
export { CatalogPhraseSchema, WordGlossSchema } from './catalog.js'
export type { CatalogPhrase, WordGloss } from './catalog.js'

export const ProblemSchema = z.looseObject({
  type: z.string(),
  title: z.string(),
  status: z.int(),
  detail: z.string().optional(),
  code: ErrorCodeSchema,
})
export const FieldSchema = z.strictObject({ v: z.unknown(), hlc: HlcSchema })
export const StatusResponseSchema = z.looseObject({
  merge: z.string(),
  entities: z.int().nonnegative(),
})
export const AuthCapabilitiesSchema = z.looseObject({
  apple: z.boolean(),
  google: z.boolean(),
  email: z.boolean(),
})
export const MeResponseSchema = z.looseObject({ user: UserSchema, device_id: ResourceIdSchema })
export type AuthCapabilities = z.infer<typeof AuthCapabilitiesSchema>
export type MeResponse = z.infer<typeof MeResponseSchema>
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
export type SceneResponse = z.infer<typeof SceneResponseSchema>
export type Problem = z.infer<typeof ProblemSchema>

const errors = {
  400: { schema: ProblemSchema, mediaType: 'application/problem+json' },
  422: { schema: ProblemSchema, mediaType: 'application/problem+json' },
  500: { schema: ProblemSchema, mediaType: 'application/problem+json' },
} as const
const base = { status: 'implemented', auth: 'none', requirements: ['F-04'], owner: 66 } as const
const lang = z.literal('es-ES').optional()
const noStore = { 'Cache-Control': z.literal('no-store') }
const deviceHeaders = { 'X-Loro-Device': ResourceIdSchema }
const protectedErrors = {
  ...errors,
  401: { schema: ProblemSchema, mediaType: 'application/problem+json' },
  403: { schema: ProblemSchema, mediaType: 'application/problem+json' },
  409: { schema: ProblemSchema, mediaType: 'application/problem+json' },
  429: { schema: ProblemSchema, mediaType: 'application/problem+json' },
  503: { schema: ProblemSchema, mediaType: 'application/problem+json' },
} as const
const authBase = { ...base, owner: 67, requirements: ['F-01', 'F-02', 'F-07'] } as const
const syncBase = { ...base, owner: 68, auth: 'bearer', headers: deviceHeaders } as const
const signInBehavior =
  'Verify configured provider proof, register the installation and create a session. Tokens expire after 900 seconds; local data must be uploaded before the claim is complete. Provider capabilities describe configured methods. No anonymous identifier grants server access.'
export const currentOperations = withExamples(
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
      summary: 'Database and WASM readiness',
      responses: { 200: { schema: ReadinessSchema }, 503: { schema: ReadinessSchema } },
      behavior:
        '503 is JSON checks, not RFC 9457. Checks bundled content, canonical WASM merge and the real PostgreSQL connection.',
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
      ...authBase,
      id: 'authCapabilities',
      method: 'get',
      path: '/auth/capabilities',
      summary: 'Configured sign-in methods',
      responses: { 200: { schema: AuthCapabilitiesSchema, headers: noStore } },
      behavior:
        'Reports configured Apple, Google and email sign-in methods. False means unavailable; no simulated provider success.',
    },
    {
      ...authBase,
      id: 'authApple',
      method: 'post',
      path: '/auth/apple',
      summary: 'Sign in with Apple',
      request: { schema: SignInRequestSchema },
      responses: { 200: { schema: SignInResponseSchema, headers: noStore }, ...protectedErrors },
      behavior: signInBehavior,
    },
    {
      ...authBase,
      id: 'authGoogle',
      method: 'post',
      path: '/auth/google',
      summary: 'Sign in with Google',
      request: { schema: SignInRequestSchema },
      responses: { 200: { schema: SignInResponseSchema, headers: noStore }, ...protectedErrors },
      behavior: signInBehavior,
    },
    {
      ...authBase,
      id: 'authMagicLink',
      method: 'post',
      path: '/auth/magic-link',
      summary: 'Request sign-in code',
      request: { schema: MagicLinkRequestSchema },
      responses: { 202: { schema: MagicLinkResponseSchema, headers: noStore }, ...protectedErrors },
      behavior:
        'Valid email requests receive 202 when the configured delivery service accepts them. Rate limited; email existence is not disclosed. An unavailable delivery service returns 503.',
    },
    {
      ...authBase,
      id: 'authMagicVerify',
      method: 'post',
      path: '/auth/magic-link/verify',
      summary: 'Verify sign-in code',
      request: { schema: MagicVerifyRequestSchema },
      responses: { 200: { schema: SignInResponseSchema, headers: noStore }, ...protectedErrors },
      behavior:
        'Consume a valid unexpired email code once, then register the installation and return session tokens. Limited attempts; local progress remains pending until sync acknowledges it.',
    },
    {
      ...authBase,
      id: 'authRefresh',
      method: 'post',
      path: '/auth/refresh',
      summary: 'Rotate refresh token',
      request: { schema: RefreshRequestSchema },
      responses: { 200: { schema: TokenResponseSchema, headers: noStore }, ...protectedErrors },
      behavior:
        'Rotate the refresh token transactionally. Reuse revokes the session family; clients refresh once, single-flight, then re-authenticate while retaining their outbox.',
    },
    {
      ...authBase,
      id: 'authLogout',
      method: 'post',
      path: '/auth/logout',
      auth: 'bearer',
      summary: 'Revoke the current session',
      responses: {
        204: {
          schema: z.never(),
          headers: noStore,
          description: 'Session revoked; no response body.',
        },
        ...protectedErrors,
      },
      behavior:
        'Revoke the authenticated session without deleting local learner data. An optional device header must agree with the authenticated device.',
    },
    {
      ...authBase,
      id: 'authClaim',
      method: 'post',
      path: '/auth/claim',
      auth: 'bearer',
      headers: { ...deviceHeaders, 'Idempotency-Key': RowIdSchema },
      summary: 'Record authenticated local-data claim',
      request: { schema: ClaimRequestSchema },
      responses: { 200: { schema: ClaimResultSchema, headers: noStore }, ...protectedErrors },
      behavior:
        'Device header/body must agree and belong to the authenticated session; Idempotency-Key equals request_id. The claim is durable and idempotent. upload_required is true; the client completes the claim only after full local upload is acknowledged.',
    },
    {
      ...authBase,
      id: 'accountRead',
      method: 'get',
      path: '/me',
      auth: 'bearer',
      summary: 'Current account and device',
      responses: { 200: { schema: MeResponseSchema, headers: noStore }, ...protectedErrors },
      behavior:
        'Return server-derived user identity and authenticated device ID. An optional device header must agree with the authenticated device.',
    },
    {
      ...syncBase,
      id: 'syncPush',
      method: 'post',
      path: '/sync/push',
      summary: 'Durable account-scoped merge',
      request: {
        schema: PushRequestSchema,
        description: 'Validate the envelope, then classify each operation independently.',
      },
      responses: { 200: { schema: PushResponseSchema, headers: noStore }, ...protectedErrors },
      maxBodyBytes: MAX_SYNC_BYTES,
      behavior:
        'Bearer and registered device required. PostgreSQL transaction, canonical Rust merge, encoded field HLCs, per-operation rejection, principal/device/sequence replay protection. Receipts preserve exact field clock corrections across retries. Catalog duplicates return aliases; explicit re-add requires replaces naming an observed matching tombstone and creates a new generation. Only accepted sequences are acknowledged.',
    },
    {
      ...syncBase,
      id: 'syncPull',
      method: 'post',
      path: '/sync/pull',
      summary: 'Account-scoped cursor page',
      request: { schema: PullRequestSchema },
      responses: { 200: { schema: PullResponseSchema, headers: noStore }, ...protectedErrors },
      behavior:
        'since=null bootstraps. Opaque account-bound cursor pages durable changes with limit 1–500; invalid cursors return CURSOR_EXPIRED. Rows have entity_id and explicit deleted_at. Catalog tombstones expose only optional catalog_identity, never learner text. Apply returned aliases, rows and cursor atomically on the device.',
    },
    {
      ...syncBase,
      id: 'syncStatus',
      method: 'post',
      path: '/sync/status',
      summary: 'Authenticated sync diagnostic',
      responses: { 200: { schema: StatusResponseSchema, headers: noStore }, ...protectedErrors },
      behavior:
        'Bearer and matching registered device required. Reports real WASM availability and the authenticated account row count.',
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
