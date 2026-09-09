import {
  NATIVE_LANGUAGES,
  TARGET_LOCALES,
  isTargetLocale,
  supportsPair,
} from '../domain/languages.js'
import {
  FSRS_ALGORITHM,
  LEGACY_PREVIEW_ALGORITHM,
  MAX_OWN_PHRASE_TEXT_CODE_UNITS,
} from '../domain/phrase.js'
/** Target sync values, independent of storage/merge implementations. F-01/F-02/F-04. */
import { z } from 'zod'
import {
  CountSchema as N,
  TimestampSchema as T,
  RowIdSchema as Id,
  CatalogIdSchema,
  HlcSchema,
  LocalDateSchema,
  ClockTimeSchema,
  EngineSchema,
  TagSchema,
  DifficultySchema,
  GradeSchema,
  ScoreSchema,
  LatencySchema,
  CursorSchema,
} from './common.js'
import { FIELD_POLICY } from '../sync/fieldPolicy.js'

export const MAX_SYNC_OPS = 500
export const MAX_SYNC_BYTES = 512 * 1024
/** Only known scheduling policies may label persisted state; absence remains a legacy wire case. */
export const FsrsAlgorithmSchema = z.enum([FSRS_ALGORITHM, LEGACY_PREVIEW_ALGORITHM])
export type FsrsAlgorithm = z.infer<typeof FsrsAlgorithmSchema>
const Note = z.string().max(MAX_OWN_PHRASE_TEXT_CODE_UNITS)
const Source = z.enum([
  'starter',
  'discover',
  'scenario',
  'browse',
  'custom',
  'import',
  'capture',
  'related',
  'drop',
  'chat',
])
export const userPhraseValues = {
  targetLocale: z.enum(TARGET_LOCALES),
  ownMeaningLanguage: z.enum(NATIVE_LANGUAGES),
  phraseId: CatalogIdSchema.nullable(),
  ownEs: z.string().min(1).max(MAX_OWN_PHRASE_TEXT_CODE_UNITS),
  ownEn: Note,
  ownTheme: z.enum([
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
  ]),
  ownEmoji: z.string().min(1).max(8),
  source: Source,
  difficulty: DifficultySchema,
  tags: z.array(TagSchema).max(4),
  loved: z.boolean(),
  learned: z.boolean(),
  note: Note.nullable(),
  plays: N,
  reps: N,
  addedAt: T,
  lastPracticedAt: T.nullable(),
  graduatedAt: T.nullable(),
  srsStability: z.number().nonnegative(),
  srsDifficulty: z.number().min(0).max(10),
  srsDue: T,
  srsLastReview: T.nullable(),
  srsLapses: N,
  srsState: z.enum(['new', 'learning', 'review', 'relearning']),
  srsAlgorithm: FsrsAlgorithmSchema,
  repsToday: N,
  repsTodayDay: LocalDateSchema.nullable(),
  automaticity: z.number().min(0).max(100),
  lockInDays: N,
  rung: z.int().min(0).max(4),
  stumbles: N,
  cueLevel: z.int().min(0).max(4),
  axPerception: z.number().min(0).max(100),
  axRecall: z.number().min(0).max(100),
  axProduction: z.number().min(0).max(100),
  deletedAt: T.nullable(),
}
export const settingsValues = {
  languagePair: z
    .strictObject({
      nativeLanguage: z.enum(NATIVE_LANGUAGES),
      targetLocale: z.enum(TARGET_LOCALES),
    })
    .refine(
      (pair) => supportsPair(pair.nativeLanguage, pair.targetLocale),
      'Unsupported language pair',
    ),
  goal: z.string().max(100).nullable(),
  level: z.string().max(50).nullable(),
  dailyMinutes: z.union([z.literal(5), z.literal(10), z.literal(20)]).nullable(),
  activeEngine: EngineSchema,
  engineExplicit: z.boolean(),
  waveTimes: z.array(ClockTimeSchema).length(3),
  reminderTime: ClockTimeSchema.nullable(),
  notifications: z.boolean(),
  accent: z.string().max(64),
  theme: z.enum(['light', 'dark', 'system']),
  analyticsOptOut: z.boolean(),
}
/** Migration exclusions, not consent options. OS grants and download/credential state are device-only. */
export const excludedSettingsFields = ['cloudAsrConsent', 'voiceCloneConsent'] as const
const Wave = z.strictObject({
  wave: z.enum(['morning', 'midday', 'evening']),
  completedAt: T.nullable(),
})
export const refrainDayValues = {
  targetLocale: z.enum(TARGET_LOCALES),
  setIds: z.array(Id).max(100),
  waves: z.array(Wave).max(3),
}
export const streakDayValues = { practised: z.boolean(), minutes: z.number().nonnegative() }
const LogBase = { phraseId: Id, at: T }
export const reviewLogValues = {
  ...LogBase,
  grade: GradeSchema,
  stability: z.number().nonnegative(),
  difficulty: z.number().min(0).max(10),
  due: T,
  algorithm: FsrsAlgorithmSchema,
  targetLocale: userPhraseValues.targetLocale,
  lastReview: T.nullable(),
  lapses: N,
  state: userPhraseValues.srsState,
}
/** Complete journal evidence; historical logs may carry only the known algorithm. */
export const reviewLogJournalFields = [
  'algorithm',
  'targetLocale',
  'lastReview',
  'lapses',
  'state',
] as const
export const latencySampleValues = {
  ...LogBase,
  engine: EngineSchema,
  latencyMs: LatencySchema,
  verifiedBy: z.enum(['asr', 'score', 'self']),
}
export const takeValues = {
  ...LogBase,
  engine: z.enum(['pronunciation', 'prosody']),
  overall: ScoreSchema,
  melodyScore: ScoreSchema,
}
export const sessionValues = {
  engine: EngineSchema,
  startedAt: T,
  endedAt: T.nullable(),
  durationMs: N,
  phrasesTouched: N,
  phrasesProduced: N,
}
export const attemptValues = {
  ...LogBase,
  sessionId: Id,
  outcome: z.enum(['success', 'partial', 'skipped', 'failed']),
  latencyMs: LatencySchema,
  score: ScoreSchema,
  hintsUsed: N,
}
export const syncValueShapes = {
  user_phrase: userPhraseValues,
  settings: settingsValues,
  refrain_day: refrainDayValues,
  streak_day: streakDayValues,
  review_log: reviewLogValues,
  latency_sample: latencySampleValues,
  take: takeValues,
  session: sessionValues,
  attempt: attemptValues,
}

/** Do not duplicate or infer the Rust merge; this only validates values. */
export function fieldShape<TShape extends z.ZodRawShape>(shape: TShape) {
  return Object.fromEntries(
    Object.entries(shape).map(([key, schema]) => [
      key,
      z.strictObject({ v: schema, hlc: HlcSchema }),
    ]),
  ) as {
    [K in keyof TShape]: z.ZodObject<{ v: TShape[K]; hlc: typeof HlcSchema }>
  }
}
export const fsrsFields = Object.entries(FIELD_POLICY.user_phrase)
  .filter(([, cls]) => cls === 'latest-review')
  .map(([key]) => key)
export const UserPhraseFieldsSchema = z
  .strictObject(fieldShape(userPhraseValues))
  .partial()
  .superRefine((fields, ctx) => {
    const present = fsrsFields.filter((key) => Object.hasOwn(fields, key))
    // Six-field preview operations remain byte-for-byte equivalent after validation, so an
    // already-receipted sequence keeps its original digest. The runtime assigns known legacy
    // provenance only after replay lookup; provenance never travels apart from schedule state.
    const completeLegacyGroup =
      !Object.hasOwn(fields, 'srsAlgorithm') && present.length === fsrsFields.length - 1
    if (present.length > 0 && present.length !== fsrsFields.length && !completeLegacyGroup)
      ctx.addIssue({
        code: 'custom',
        message: 'FSRS update must carry the complete latest-review group',
      })
    if (Object.hasOwn(fields, 'repsToday') !== Object.hasOwn(fields, 'repsTodayDay'))
      ctx.addIssue({ code: 'custom', message: 'Daily count and day key must travel together' })
    if (fields.phraseId?.v === null && !fields.ownEs?.v)
      ctx.addIssue({ code: 'custom', message: 'Creating an own phrase requires Spanish text' })
  })
const SettingsFields = z.strictObject(fieldShape(settingsValues)).partial()
export const ReviewLogFieldsSchema = z
  .strictObject(fieldShape(reviewLogValues))
  .partial({ algorithm: true, targetLocale: true, lastReview: true, lapses: true, state: true })
  .superRefine((fields, ctx) => {
    // Earlier persisted/attempted logs already carried an algorithm without journal state.
    // Keep those operations unchanged for receipt replay; they remain shadow records only.
    const present = reviewLogJournalFields.filter(
      (key) => key !== 'algorithm' && Object.hasOwn(fields, key),
    )
    if (
      present.length > 0 &&
      (present.length !== reviewLogJournalFields.length - 1 || !Object.hasOwn(fields, 'algorithm'))
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Review journal provenance and scheduling state must travel together',
      })
  })
export const fieldsByEntity = {
  user_phrase: UserPhraseFieldsSchema,
  settings: SettingsFields,
  refrain_day: z.strictObject(fieldShape(refrainDayValues)).partial(),
  streak_day: z.strictObject(fieldShape(streakDayValues)).partial(),
  review_log: ReviewLogFieldsSchema,
  latency_sample: z.strictObject(fieldShape(latencySampleValues)),
  take: z.strictObject(fieldShape(takeValues)),
  session: z.strictObject(fieldShape(sessionValues)),
  attempt: z.strictObject(fieldShape(attemptValues)),
}
export type SyncEntity = keyof typeof fieldsByEntity
export function rowIdFor(entity: SyncEntity) {
  // Legacy Spanish days remain readable. New course days cannot collide across targets.
  if (entity === 'refrain_day')
    return z.union([
      LocalDateSchema,
      z.string().refine((value) => {
        const separator = value.indexOf(':')
        return (
          isTargetLocale(value.slice(0, separator)) &&
          LocalDateSchema.safeParse(value.slice(separator + 1)).success
        )
      }, 'Expected a course locale and local date'),
    ])
  if (entity === 'streak_day') return LocalDateSchema
  if (entity === 'settings') return z.literal('settings')
  return Id
}
function opFor<K extends SyncEntity>(entity: K) {
  return z.union([
    z.strictObject({
      seq: N,
      entity: z.literal(entity),
      entity_id: rowIdFor(entity),
      op: z.literal('upsert'),
      fields: fieldsByEntity[entity],
    }),
    z.strictObject({
      seq: N,
      entity: z.literal(entity),
      entity_id: rowIdFor(entity),
      op: z.literal('delete'),
      deleted_at: T,
    }),
  ])
}
export const PushOpSchema = z.union([
  z.union([
    z.strictObject({
      seq: N,
      entity: z.literal('user_phrase'),
      entity_id: Id,
      op: z.literal('upsert'),
      fields: UserPhraseFieldsSchema,
      replaces: z.strictObject({ id: Id, deleted_at: T }).optional(),
    }),
    z.strictObject({
      seq: N,
      entity: z.literal('user_phrase'),
      entity_id: Id,
      op: z.literal('delete'),
      deleted_at: T,
    }),
  ]),
  opFor('settings'),
  opFor('refrain_day'),
  opFor('streak_day'),
  opFor('review_log'),
  opFor('latency_sample'),
  opFor('take'),
  opFor('session'),
  opFor('attempt'),
])
/** Validate envelope first; malformed individual ops must not reject unrelated writes. */
export const PushEnvelopeSchema = z.strictObject({
  client_hlc: HlcSchema,
  ops: z.array(z.unknown()).max(MAX_SYNC_OPS),
})
export const PushRequestSchema = z.strictObject({
  client_hlc: HlcSchema,
  ops: z.array(PushOpSchema).max(MAX_SYNC_OPS),
})
export const SyncRejectionSchema = z.strictObject({
  seq: N.nullable(),
  index: N,
  code: z.enum(['VALIDATION_FAILED', 'SCHEMA_TOO_OLD']),
  field: z.string().optional(),
})
export function validatePushBatch(input: unknown) {
  const envelope = PushEnvelopeSchema.parse(input)
  const valid: z.infer<typeof PushOpSchema>[] = []
  const rejected: z.infer<typeof SyncRejectionSchema>[] = []
  const seqs = new Set<number>()
  envelope.ops.forEach((raw, index) => {
    const seq = z.object({ seq: N }).safeParse(raw)
    const parsed = PushOpSchema.safeParse(raw)
    if (!parsed.success || (seq.success && seqs.has(seq.data.seq))) {
      rejected.push({ index, seq: seq.success ? seq.data.seq : null, code: 'VALIDATION_FAILED' })
    } else valid.push(parsed.data)
    if (seq.success) seqs.add(seq.data.seq)
  })
  return { client_hlc: envelope.client_hlc, valid, rejected }
}
export const PushResponseSchema = z.looseObject({
  accepted: z.array(N),
  aliases: z
    .array(z.strictObject({ from: Id, to: Id }))
    .max(MAX_SYNC_OPS)
    .optional(),
  rejected: z.array(SyncRejectionSchema),
  conflicts: z.array(z.string()),
  server_hlc: HlcSchema,
  server_time: T,
  /** Receipt-scoped normalization survives a lost response and later replay. */
  clock_corrections: z
    .array(z.strictObject({ seq: N, field: z.string(), from: HlcSchema, to: HlcSchema }))
    .optional(),
})
export const PullRequestSchema = z.strictObject({
  since: CursorSchema.nullable(),
  limit: z.int().min(1).max(500).default(500),
})
function changeFor<K extends SyncEntity>(entity: K) {
  return z.union([
    z.strictObject({
      entity: z.literal(entity),
      entity_id: rowIdFor(entity),
      fields: fieldsByEntity[entity],
      deleted_at: z.null(),
    }),
    z.strictObject({
      entity: z.literal(entity),
      entity_id: rowIdFor(entity),
      fields: z.strictObject({}),
      deleted_at: T,
    }),
  ])
}
export const ChangeSchema = z.union([
  z.union([
    z.strictObject({
      entity: z.literal('user_phrase'),
      entity_id: Id,
      fields: UserPhraseFieldsSchema,
      deleted_at: z.null(),
    }),
    z.strictObject({
      entity: z.literal('user_phrase'),
      entity_id: Id,
      fields: z.strictObject({}),
      deleted_at: T,
      catalog_identity: z
        .strictObject({
          phraseId: CatalogIdSchema,
          targetLocale: z.enum(TARGET_LOCALES),
        })
        .optional(),
    }),
  ]),
  changeFor('settings'),
  changeFor('refrain_day'),
  changeFor('streak_day'),
  changeFor('review_log'),
  changeFor('latency_sample'),
  changeFor('take'),
  changeFor('session'),
  changeFor('attempt'),
])
export const PullResponseSchema = z.looseObject({
  aliases: z.array(z.strictObject({ from: Id, to: Id })).optional(),
  changes: z.array(ChangeSchema).max(500),
  next: CursorSchema,
  has_more: z.boolean(),
  server_hlc: HlcSchema,
})
export type PushOp = z.infer<typeof PushOpSchema>
export type PushRequest = z.infer<typeof PushRequestSchema>
export type PushResponse = z.infer<typeof PushResponseSchema>
export type PullRequest = z.infer<typeof PullRequestSchema>
export type PullResponse = z.infer<typeof PullResponseSchema>
