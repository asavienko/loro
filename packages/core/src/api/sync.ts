import { supportsPair, TARGET_LOCALES } from '../domain/languages.js'
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
const Note = z.string().max(2000)
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
  targetLocale: z.enum(['es-ES', 'bg-BG', 'ru-RU']),
  ownMeaningLanguage: z.enum(['en', 'bg', 'ru']),
  phraseId: CatalogIdSchema.nullable(),
  ownEs: z.string().min(1).max(2000),
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
  srsAlgorithm: z.string().min(1).max(200).nullable(),
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
      nativeLanguage: z.enum(['en', 'bg', 'ru']),
      targetLocale: z.enum(['es-ES', 'bg-BG', 'ru-RU']),
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
  targetLocale: z.enum(['es-ES', 'bg-BG', 'ru-RU']),
  setIds: z.array(Id).max(100),
  waves: z.array(Wave).max(3),
}
export const streakDayValues = { practised: z.boolean(), minutes: z.number().nonnegative() }
const LogBase = { phraseId: Id, at: T }
export const reviewLogValues = {
  ...LogBase,
  algorithm: z.string().min(1).max(200),
  grade: GradeSchema,
  stability: z.number().nonnegative(),
  difficulty: z.number().min(0).max(10),
  due: T,
}
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
    if (present.length > 0 && present.length !== fsrsFields.length)
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
export const fieldsByEntity = {
  user_phrase: UserPhraseFieldsSchema,
  settings: SettingsFields,
  refrain_day: z.strictObject(fieldShape(refrainDayValues)).partial(),
  streak_day: z.strictObject(fieldShape(streakDayValues)).partial(),
  review_log: z.strictObject(fieldShape(reviewLogValues)).partial({ algorithm: true }),
  latency_sample: z.strictObject(fieldShape(latencySampleValues)),
  take: z.strictObject(fieldShape(takeValues)),
  session: z.strictObject(fieldShape(sessionValues)),
  attempt: z.strictObject(fieldShape(attemptValues)),
}
export type SyncEntity = keyof typeof fieldsByEntity
export function rowIdFor(entity: SyncEntity) {
  if (entity === 'refrain_day')
    return z.union([
      LocalDateSchema,
      z.string().refine((id) => {
        const [locale, day, extra] = id.split(':')
        return (
          extra === undefined &&
          TARGET_LOCALES.some((target) => target === locale) &&
          LocalDateSchema.safeParse(day).success
        )
      }, 'Expected a target locale and local date'),
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
  opFor('user_phrase'),
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
  rejected: z.array(SyncRejectionSchema),
  conflicts: z.array(z.string()),
  server_hlc: HlcSchema,
  server_time: T,
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
  changeFor('user_phrase'),
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
