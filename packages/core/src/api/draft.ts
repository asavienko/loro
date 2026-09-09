import { withExamples, draftExamples } from './examples.js'
/** Gated contracts: never re-exported from the stable target entry point. */
import { z } from 'zod'
import type { Operation } from './operation.js'
import {
  CountSchema as N,
  TimestampSchema as T,
  ResourceIdSchema as Key,
  RowIdSchema as Id,
  LocalDateSchema,
  LocaleSchema,
  LineSchema,
  TextSchema,
  RegisterSchema,
  ProvenanceSchema,
  Sha256Schema,
  HlcSchema,
  appHeaders,
  idempotencyHeaders,
  targetErrors,
} from './common.js'
import { fieldShape } from './sync.js'
import { WordGlossSchema } from './catalog.js'
import { DeviceRegistrationSchema, UserSchema } from './account.js'
import { ChatTopicResourceSchema } from './chat-topic.js'
import { PhraseSuggestRequestSchema, PhraseSuggestResponseSchema } from './phrase-suggest.js'

export const draftGates = {
  trip: ['Q-07'],
  billing: ['Q-08', 'Q-12'],
  tts: ['Q-15'],
  chat: ['Q-16', 'Q-18', 'Q-19', 'Q-20'],
  config: ['Q-05'],
  discoverSuggest: ['Q-21'],
} as const
export const tripValues = {
  city: TextSchema,
  country: z.string().length(2),
  langVariant: LocaleSchema,
  arrivalDate: LocalDateSchema,
  returnDate: LocalDateSchema.nullable(),
  tripType: Key,
  targetCount: N,
  state: Key,
  createdAt: T,
  completedAt: T.nullable(),
  deletedAt: T.nullable(),
}
export const tripDropValues = {
  dayIndex: N,
  packId: Key.nullable(),
  unlocksOn: LocalDateSchema,
  state: Key,
  addedAt: T.nullable(),
}
export const tripPhraseValues = {
  source: z.enum(['drop', 'manual', 'capture']),
  usedAbroadCount: N,
  firstUsedAbroadAt: T.nullable(),
}
export const TripFieldsSchema = z.strictObject(fieldShape(tripValues)).partial()
export const TripDropFieldsSchema = z.strictObject(fieldShape(tripDropValues)).partial()
export const TripPhraseFieldsSchema = z.strictObject(fieldShape(tripPhraseValues)).partial()
export const TripSyncOpSchema = z.union([
  z.strictObject({
    seq: N,
    entity: z.literal('trip'),
    entity_id: Id,
    op: z.literal('upsert'),
    fields: TripFieldsSchema,
  }),
  z.strictObject({
    seq: N,
    entity: z.literal('trip_drop'),
    entity_id: Id,
    op: z.literal('upsert'),
    fields: TripDropFieldsSchema,
  }),
  z.strictObject({
    seq: N,
    entity: z.literal('trip_phrase'),
    entity_id: Id,
    op: z.literal('upsert'),
    fields: TripPhraseFieldsSchema,
  }),
  z.strictObject({
    seq: N,
    entity: z.enum(['trip', 'trip_drop', 'trip_phrase']),
    entity_id: Id,
    op: z.literal('delete'),
    deleted_at: T,
  }),
])
export const TripSyncRequestSchema = z.strictObject({
  client_hlc: HlcSchema,
  ops: z.array(TripSyncOpSchema).max(500),
})
export const DropResourceSchema = z.strictObject({
  version: N,
  steps: z.array(z.strictObject({ day: N, pack: Key.nullable(), review_only: z.boolean() })),
  rules: z.strictObject({
    unlock_hour_local: z.int().min(0).max(23),
    no_new_phrases_on_final_day: z.boolean(),
    missed_drops_merge_forward: z.boolean(),
    future_drops_can_be_pulled_forward: z.boolean(),
    dormant_above_days: N,
  }),
})

export const ChatPaceSchema = z.enum(['natural', 'slow'])
export const ChatTurnRequestSchema = z
  .strictObject({
    request_id: Id,
    thread_id: Id,
    topic_id: Key,
    pace: ChatPaceSchema,
    locale: LocaleSchema,
    turns: z
      .array(z.strictObject({ id: Id, speaker: z.enum(['loro', 'learner']), text: TextSchema }))
      .min(1)
      .max(20),
  })
  .superRefine((r, ctx) => {
    if (new Set(r.turns.map((t) => t.id)).size !== r.turns.length)
      ctx.addIssue({ code: 'custom', message: 'Unique turn IDs required' })
    if (r.turns.at(-1)?.speaker !== 'learner')
      ctx.addIssue({ code: 'custom', message: 'Latest turn must be the learner submission' })
  })
const Alternative = LineSchema.extend({ id: Id, register: RegisterSchema, explanation: TextSchema })
const Correction = z.strictObject({
  start: N,
  end: N,
  before: TextSchema,
  replacement: z.string().max(2000),
  explanation: TextSchema,
  kind: z.enum(['grammar', 'spelling', 'register', 'word_choice']),
  provenance: ProvenanceSchema,
})
export const ChatFeedbackSchema = z
  .strictObject({
    turn_id: Id,
    original: TextSchema,
    corrected: TextSchema.nullable(),
    corrections: z.array(Correction).max(20),
    alternatives: z.array(Alternative).max(5),
    glosses: z.array(WordGlossSchema).max(24),
    explanation: TextSchema.nullable(),
    provenance: ProvenanceSchema,
  })
  .superRefine((f, ctx) => {
    let end = 0
    let corrected = ''
    for (const c of f.corrections) {
      if (
        c.start < end ||
        c.start >= c.end ||
        c.end > f.original.length ||
        f.original.slice(c.start, c.end) !== c.before
      )
        ctx.addIssue({
          code: 'custom',
          message:
            'Correction spans must be ordered, non-overlapping UTF-16 spans matching original text',
        })
      corrected += f.original.slice(end, c.start) + c.replacement
      end = c.end
    }
    corrected += f.original.slice(end)
    if (f.corrections.length > 0 && f.corrected !== corrected)
      ctx.addIssue({ code: 'custom', message: 'Corrected text must agree with evidence spans' })
    if (f.corrections.length === 0 && f.corrected !== null)
      ctx.addIssue({ code: 'custom', message: 'No correction without evidence' })
  })
export const ChatTurnResponseSchema = z.strictObject({
  request_id: Id,
  provenance: ProvenanceSchema,
  degraded: z.boolean(),
  safety: z.enum(['ok', 'refused']),
  reply: LineSchema.extend({ id: Id }),
  suggestions: z.array(LineSchema.extend({ id: Id, register: RegisterSchema })).max(5),
  feedback: z.array(ChatFeedbackSchema).max(20),
})
export function validateChatExchange(request: unknown, response: unknown) {
  const req = ChatTurnRequestSchema.parse(request)
  const result = ChatTurnResponseSchema.parse(response)
  if (req.request_id !== result.request_id) throw new Error('Stale request ID')
  if (req.turns.some((t) => t.id === result.reply.id)) throw new Error('Reply ID already exists')
  const seen = new Set<string>()
  for (const feedback of result.feedback) {
    if (
      seen.has(feedback.turn_id) ||
      !req.turns.some(
        (t) => t.id === feedback.turn_id && t.speaker === 'learner' && t.text === feedback.original,
      )
    )
      throw new Error('Feedback must reference one submitted learner turn')
    seen.add(feedback.turn_id)
  }
  return result
}
export { ChatTopicResourceSchema } from './chat-topic.js'
export const TtsRequestSchema = z.strictObject({
  text: TextSchema,
  lang: LocaleSchema,
  phrase_hash: Sha256Schema,
})
export const TtsResponseSchema = z.looseObject({
  uri: z.string().regex(/^sha256\/[a-f0-9]{64}$/),
  sha256: Sha256Schema,
  ms: z.int().positive(),
  cached: z.boolean(),
})
export const BillingVerifyRequestSchema = z.strictObject({
  platform: z.enum(['ios', 'android']),
  receipt: z.string().min(1).max(65536),
  product_id: Key,
})
export const EntitlementSchema = z
  .looseObject({
    schema_version: z.literal(1),
    entitlements: z.array(Key).max(100),
    expires_at: T.nullable(),
    grace_until: T.nullable(),
    issued_at: T,
    source: z.enum(['app_store', 'play_store', 'aggregator']),
    key_id: Key,
    signature: z.string().min(1).max(4096),
  })
  .refine(
    (e) => e.expires_at === null || e.grace_until === null || e.grace_until >= e.expires_at,
    'Grace must not precede expiry',
  )
export const RestoreRequestSchema = z.strictObject({
  purchases: z.array(BillingVerifyRequestSchema).max(100),
})
/** No invented universal provider webhook payload. This schema is intentionally uninhabitable. */
export const BillingWebhookRequestSchema = z.never()
export const DevicesSchema = z.looseObject({
  devices: z
    .array(
      DeviceRegistrationSchema.extend({
        device_id: Key,
        last_seen_at: T.nullable(),
        current: z.boolean(),
      }),
    )
    .max(100),
  next: Key.nullable(),
})
export const AccountSchema = UserSchema.extend({ deletion_scheduled_for: T.nullable() })
export const ConfigSchema = z.strictObject({
  version: N,
  expires_at: T,
  flags: z.strictObject({ live_chat: z.boolean(), loop_experiment: z.boolean(), run: z.boolean() }),
  assignments: z
    .array(
      z.strictObject({
        experiment_id: Key,
        variant: z.enum(['control', 'stream', 'refrain', 'srs']),
        assignment_id: Id,
      }),
    )
    .max(10),
})
const empty = z.looseObject({ status: z.literal('accepted') })
const base = {
  status: 'draft',
  auth: 'bearer',
  requirements: ['F-04'],
  headers: appHeaders,
  responses: { ...targetErrors },
} as const
export const draftOperations = withExamples(
  [
    {
      ...base,
      id: 'chatTurn',
      method: 'post',
      path: '/chat/turn',
      owner: 82,
      gates: draftGates.chat,
      unresolved: [
        'Launch posture, entitlement/rate/cost caps, local retention and provider text retention/region',
      ],
      summary: 'Bounded private text conversation',
      headers: idempotencyHeaders,
      request: { schema: ChatTurnRequestSchema },
      responses: { 200: { schema: ChatTurnResponseSchema }, ...targetErrors },
      maxBodyBytes: 128 * 1024,
      behavior:
        'Authoring bounds: 20 recent turns, 2000 chars each. No production request until Q-18/Q-20. Raw text excluded from sync/logs/telemetry/shared cache. Live failures select bundled graph. Validate response against original request; discard stale replies. Idempotency scoped to principal/request, not shared personalized caching.',
    },
    {
      ...base,
      id: 'phraseSuggest',
      method: 'post',
      path: '/phrases/suggest',
      owner: 97,
      auth: 'none',
      gates: draftGates.discoverSuggest,
      unresolved: [
        'Live enablement, per-pair eval thresholds, shared AI spend cap and provider retention',
      ],
      summary: 'Guarded Discover own-phrase suggestions',
      request: { schema: PhraseSuggestRequestSchema },
      responses: { 200: { schema: PhraseSuggestResponseSchema }, ...targetErrors },
      maxBodyBytes: 8 * 1024,
      behavior:
        'No audio field. Stub and bundled topics are the development default. No production live request until Q-21. Invalid, unsafe or unmatched queries return zero candidates with fallback. Never writes catalog rows. Cache only folded query, pair and content version.',
    },
    {
      ...base,
      id: 'ttsRender',
      method: 'post',
      path: '/tts/render',
      owner: 61,
      gates: draftGates.tts,
      unresolved: [
        'Licensed voice, voice-version cache identity, rights, pronunciation review and budget',
      ],
      summary: 'Render text as model speech',
      headers: idempotencyHeaders,
      request: { schema: TtsRequestSchema },
      responses: { 200: { schema: TtsResponseSchema }, ...targetErrors },
      behavior:
        'Text only. Server recomputes hash and keys by text/locale/approved voice version. Device TTS on failure. Never accepts recordings.',
    },
    {
      ...base,
      id: 'billingVerify',
      method: 'post',
      path: '/billing/verify',
      owner: 74,
      gates: draftGates.billing,
      unresolved: [
        'Store provider/proof formats, SKUs/entitlements, signature algorithm/canonicalization/key rotation and grace policy',
      ],
      summary: 'Verify store purchase',
      headers: idempotencyHeaders,
      request: { schema: BillingVerifyRequestSchema },
      responses: { 200: { schema: EntitlementSchema }, ...targetErrors },
      behavior:
        'Principal-scoped idempotency and trusted store verification. Cache/grace; never block cached Survival.',
    },
    {
      ...base,
      id: 'billingEntitlements',
      method: 'get',
      path: '/billing/entitlements',
      owner: 74,
      gates: draftGates.billing,
      unresolved: ['Entitlement policy and signing protocol'],
      summary: 'Refresh entitlement snapshot',
      responses: { 200: { schema: EntitlementSchema }, ...targetErrors },
      behavior: 'Draft additive route; authenticated no-store response, offline grace.',
    },
    {
      ...base,
      id: 'billingRestore',
      method: 'post',
      path: '/billing/restore',
      owner: 74,
      gates: draftGates.billing,
      unresolved: ['Store restore mechanism and proof format'],
      summary: 'Restore purchases',
      headers: idempotencyHeaders,
      request: { schema: RestoreRequestSchema },
      responses: { 200: { schema: EntitlementSchema }, ...targetErrors },
      behavior: 'Draft additive route; verify ownership; replay must not grant twice.',
    },
    {
      ...base,
      id: 'billingWebhook',
      method: 'post',
      path: '/billing/webhook',
      auth: 'provider-signature',
      owner: 74,
      gates: draftGates.billing,
      unresolved: [
        'Provider-specific raw body, signature headers, event identity, verification and acknowledgement',
      ],
      summary: 'Unresolved provider webhook boundary',
      headers: {},
      request: { schema: BillingWebhookRequestSchema },
      responses: { 202: { schema: empty }, ...targetErrors },
      behavior:
        'Not callable: never-schema until Q-12 supplies real provider contract. Do not normalize before signature verification; deduplicate verified event IDs. Proposed acknowledgement also subject to provider decision.',
    },
    {
      ...base,
      id: 'accountRead',
      method: 'get',
      path: '/account',
      owner: 67,
      gates: [],
      unresolved: ['Account management UX/transport review under plan 67'],
      summary: 'Account lifecycle summary',
      responses: { 200: { schema: AccountSchema }, ...targetErrors },
      behavior: 'Draft additive route. Private/no-store; account scope comes from bearer identity.',
    },
    {
      ...base,
      id: 'accountDevices',
      method: 'get',
      path: '/account/devices',
      owner: 67,
      gates: [],
      unresolved: ['Device management transport and paging review'],
      summary: 'Registered devices',
      query: { cursor: Key.optional() },
      responses: { 200: { schema: DevicesSchema }, ...targetErrors },
      behavior: 'Draft additive route; authenticated principal devices only.',
    },
    {
      ...base,
      id: 'deviceRevoke',
      method: 'delete',
      path: '/account/devices/{device_id}',
      owner: 67,
      gates: [],
      unresolved: ['Revocation UX/recovery review'],
      summary: 'Revoke a device session',
      pathParams: { device_id: Key },
      responses: { 202: { schema: empty }, ...targetErrors },
      behavior:
        'Idempotent revocation; reject other users devices as NOT_FOUND; do not discard local outbox.',
    },
    {
      ...base,
      id: 'authLogout',
      method: 'post',
      path: '/auth/logout',
      owner: 67,
      gates: [],
      unresolved: ['Sign-out versus local-data-erasure UX'],
      summary: 'Revoke current refresh family',
      responses: { 202: { schema: empty }, ...targetErrors },
      behavior:
        'Authenticated despite auth prefix. Local sign-out can proceed offline; revocation requires server connectivity.',
    },
    {
      ...base,
      id: 'configuration',
      method: 'get',
      path: '/config',
      owner: 71,
      gates: draftGates.config,
      unresolved: [
        'Registered flags, assignment policy, exposure taxonomy and Q-05 experiment design',
      ],
      summary: 'Versioned flags and experiment assignments',
      responses: { 200: { schema: ConfigSchema }, ...targetErrors },
      behavior:
        'Private principal-scoped cache; stable assignments; expired/unknown flags disabled. No experiment activation or guessed exposure event while Q-05 remains open.',
    },
  ] as const satisfies readonly Operation[],
  draftExamples,
)
/** Named components are published as drafts even where no endpoint is ready to consume them. */
export const draftComponents = {
  TripSyncRequest: {
    schema: TripSyncRequestSchema,
    gates: draftGates.trip,
    unresolved: [
      'Relocation/return/end states; drop/phrase parent keys and canonical identity; tombstone propagation',
    ],
  },
  DropResource: {
    schema: DropResourceSchema,
    gates: draftGates.trip,
    unresolved: ['Q-07 continuing drop semantics'],
  },
  ChatTopicResource: {
    schema: ChatTopicResourceSchema,
    gates: draftGates.chat,
    unresolved: ['Release topic coverage and retained feedback policy'],
  },
} as const
export type ChatTurnRequest = z.infer<typeof ChatTurnRequestSchema>
export type ChatTurnResponse = z.infer<typeof ChatTurnResponseSchema>
export type ChatFeedback = z.infer<typeof ChatFeedbackSchema>
export type TripSyncOp = z.infer<typeof TripSyncOpSchema>
export type TtsRequest = z.infer<typeof TtsRequestSchema>
export type TtsResponse = z.infer<typeof TtsResponseSchema>
export type Entitlement = z.infer<typeof EntitlementSchema>
export type Configuration = z.infer<typeof ConfigSchema>

export type TripFields = z.infer<typeof TripFieldsSchema>

export type TripDropFields = z.infer<typeof TripDropFieldsSchema>

export type TripPhraseFields = z.infer<typeof TripPhraseFieldsSchema>

export type TripSyncRequest = z.infer<typeof TripSyncRequestSchema>

export type DropResource = z.infer<typeof DropResourceSchema>

export type ChatPace = z.infer<typeof ChatPaceSchema>

export type ChatTopicResource = z.infer<typeof ChatTopicResourceSchema>
export type { PhraseSuggestRequest, PhraseSuggestResponse } from './phrase-suggest.js'
export {
  PhraseSuggestRequestSchema,
  PhraseSuggestResponseSchema,
  validatePhraseSuggestExchange,
  unavailableSuggestResponse,
  assertAddableCandidates,
} from './phrase-suggest.js'

export type BillingVerifyRequest = z.infer<typeof BillingVerifyRequestSchema>

export type RestoreRequest = z.infer<typeof RestoreRequestSchema>

export type BillingWebhookRequest = z.infer<typeof BillingWebhookRequestSchema>

export type Devices = z.infer<typeof DevicesSchema>

export type Account = z.infer<typeof AccountSchema>

export type Config = z.infer<typeof ConfigSchema>
