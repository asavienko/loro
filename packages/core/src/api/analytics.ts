/** F-08: the metrics.md taxonomy. No arbitrary props or learner-text fields. */
import { z } from 'zod'
import {
  CountSchema as N,
  TimestampSchema as T,
  ResourceIdSchema as Key,
  RowIdSchema as Id,
  Sha256Schema,
  CatalogIdSchema,
  EngineSchema as Engine,
  TagSchema as Tag,
  DifficultySchema as Difficulty,
  GradeSchema,
  ScoreSchema,
  LatencySchema,
  ProvenanceSchema,
  AppVersionSchema,
} from './common.js'
const Phrase = z.union([CatalogIdSchema, z.string().regex(/^own_[a-f0-9]{64}$/)])
const phrase = { phrase_id: Phrase }
const engine = { engine: Engine }
const Surface = z.enum([
  'onboarding',
  'add',
  'detail',
  'stream',
  'speak',
  'review',
  'roleplay',
  'memory',
  'pronunciation',
  'prosody',
  'today',
  'refrain',
  'run',
  'phrasebook',
  'progress',
  'trip',
  'survival',
  'chat',
  'inspector',
  'settings',
])
const Mode = z.enum(['echo', 'chorus', 'speed', 'cloze', 'call', 'cold'])
const Wave = z.enum(['morning', 'midday', 'evening'])
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
const permission = {
  permission: z.enum(['microphone', 'camera', 'speech', 'notifications']),
  granted: z.boolean().optional(),
  context: Surface,
}
const wave = { wave: Wave, set_size: N, reps_total: N }
const chat = { thread_id: Id, turn_id: Id }
const run = { deck_size: N, card_drawn: Key, redrawn: z.boolean(), target_phrase_id: Phrase }
const drop = { day_index: N, pack_id: Key, added_count: N, hours_to_add: z.number().nonnegative() }
const paywall = { trigger: Key, variant: Key }
const subscription = { plan: Key, trial: z.boolean(), days_since_install: N }
/** Every property is named and typed; schema registration alone does not authorize collection. */
export const eventPropertyShapes = {
  app_opened: {
    source: z.enum(['icon', 'notification', 'widget', 'deeplink']),
    offline: z.boolean(),
  },
  onboarding_started: {},
  onboarding_step_completed: { step: Key, answer: Key, ms_on_step: N },
  onboarding_completed: {
    goal: Key,
    level: Key,
    daily_minutes: N,
    packs: z.array(Key).max(100),
    seeded_count: N,
    total_ms: N,
  },
  permission_requested: permission,
  permission_resolved: permission,
  phrase_added: {
    ...phrase,
    source: Source,
    difficulty: Difficulty,
    tags: z.array(Tag).max(4),
    theme: Key,
  },
  phrase_removed: { ...phrase, owned_days: N, reps_at_removal: N },
  phrase_rated: {
    ...phrase,
    field: z.enum(['difficulty', 'tags', 'loved', 'learned']),
    from: z.union([Difficulty, z.array(Tag).max(4), z.boolean()]),
    to: z.union([Difficulty, z.array(Tag).max(4), z.boolean()]),
    surface: Surface,
  },
  phrase_note_set: { ...phrase, source: z.enum(['typed', 'suggestion']) },
  import_parsed: {
    line_count: N,
    parsed_count: N,
    separator_hits: z.strictObject({ tab: N, dash: N, semicolon: N, other: N }),
  },
  import_committed: { added_count: N, deselected_count: N },
  capture_completed: {
    line_count: N,
    added_count: N,
    ocr_confidence_bucket: z.enum(['unknown', 'low', 'medium', 'high']),
  },
  undo_used: { action: z.enum(['add', 'remove', 'rate', 'note']) },
  session_started: { ...engine, surface: Surface, queue_size: N, offline: z.boolean() },
  session_completed: {
    ...engine,
    duration_ms: N,
    phrases_touched: N,
    phrases_produced: N,
    interruptions: N,
  },
  session_abandoned: { ...engine, duration_ms: N, at_phrase_index: N },
  phrase_produced: {
    ...phrase,
    ...engine,
    mode: Mode,
    latency_ms: LatencySchema,
    verified_by: z.enum(['asr', 'score', 'self']),
    hints_used: N,
  },
  audio_played: {
    ...phrase,
    rate: z.number().positive(),
    surface: Surface,
    source: z.enum(['tts_cache', 'tts_device', 'cdn']),
  },
  stream_advanced: { ...phrase, repeats_completed: N, manual: z.boolean() },
  stream_rerated_live: {
    ...phrase,
    to: Difficulty,
    queue_position_before: N,
    queue_position_after: N,
  },
  refrain_wave_started: wave,
  refrain_wave_completed: wave,
  refrain_rep_completed: {
    ...phrase,
    mode: Mode,
    rep_index: N,
    latency_ms: LatencySchema,
    automaticity: ScoreSchema,
  },
  refrain_phrase_locked: { ...phrase, reps: N, total_ms: N, day_index: N },
  refrain_phrase_graduated: { ...phrase, days_in_rotation: N },
  srs_card_graded: {
    ...phrase,
    grade: GradeSchema,
    interval_days: z.number().nonnegative(),
    stability: z.number().nonnegative(),
    focus_tag: Tag.nullable(),
    ms_to_grade: N,
  },
  curve_confidence_rated: {
    ...phrase,
    level: z.enum(['forgot', 'shaky', 'ok', 'strong', 'instant']),
    stability_before: z.number().nonnegative(),
    stability_after: z.number().nonnegative(),
  },
  speak_word_revealed: { ...phrase, word_index: N, via: z.enum(['asr', 'hint']) },
  speak_phrase_completed: {
    ...phrase,
    hints_used: N,
    stars: z.int().min(0).max(3),
    asr_attempts: N,
  },
  pron_take_scored: {
    ...phrase,
    overall: ScoreSchema,
    worst_syllable_index: N.nullable(),
    attempt: N,
  },
  prosody_take_scored: {
    ...phrase,
    melody_score: ScoreSchema,
    delta: z.number().nullable(),
    cue_level: N,
    attempt: N,
    axes: z.strictObject({ perception: ScoreSchema, recall: ScoreSchema, production: ScoreSchema }),
  },
  prosody_cue_leveled_up: { ...phrase, from_level: N, to_level: N },
  roleplay_turn_taken: {
    scene_id: Key,
    turn: N,
    was_best: z.boolean(),
    via: z.enum(['tap', 'speech']),
  },
  roleplay_scene_completed: { scene_id: Key, turns: N, natural_lines: N, fluency: ScoreSchema },
  chat_started: {
    thread_id: Id,
    topic_id: Key,
    pace: z.enum(['natural', 'slow']),
    offline: z.boolean(),
    fallback_provenance: ProvenanceSchema,
  },
  chat_turn_submitted: { ...chat, turn_index: N, via: z.enum(['text', 'speech']), char_count: N },
  chat_turn_resolved: {
    ...chat,
    latency_ms: LatencySchema,
    provenance: ProvenanceSchema,
    suggestion_count: N,
    correction_count: N,
    safety_code: z.enum(['ok', 'refused', 'unavailable']),
  },
  chat_line_kept: { ...chat, kind: z.enum(['original', 'corrected', 'alternative']) },
  chat_thread_cleared: { thread_id: Id, turn_count: N, age_days: N },
  run_started: run,
  run_completed: run,
  run_rung_climbed: { ...phrase, from_rung: z.int().min(0).max(4), to_rung: z.int().min(0).max(4) },
  trip_created: {
    days_until_arrival: N,
    trip_type: Key,
    destination: Sha256Schema,
    target_count: N,
  },
  trip_drop_unlocked: drop,
  trip_drop_added: drop,
  trip_state_changed: { from: Key, to: Key },
  survival_phrase_played: {
    ...phrase,
    deck_position: N,
    hours_since_landing: z.number().nonnegative(),
    offline: z.boolean(),
  },
  trip_completed: {
    phrases_used_abroad: N,
    captures: N,
    readiness_at_arrival: ScoreSchema,
    essentials_pct: ScoreSchema,
  },
  widget_tapped: {
    widget: z.enum(['ios', 'android', 'live_activity']),
    action: z.enum(['open', 'play', 'practice']),
  },
  paywall_shown: paywall,
  paywall_dismissed: paywall,
  subscription_started: subscription,
  cancelled: subscription,
  sync_completed: { pushed: N, pulled: N, conflicts: N, duration_ms: N },
  sync_failed: { reason: Key, retry_count: N },
  ai_request_completed: {
    endpoint: z.enum(['scene', 'coach', 'translate', 'chat', 'enrich']),
    cache_hit: z.boolean(),
    latency_ms: LatencySchema,
    tokens_in: N,
    tokens_out: N,
    fallback_used: z.boolean(),
    validation_failures: N,
    repair_attempted: z.boolean(),
    safety_code: z.enum(['ok', 'refused', 'unavailable']),
    budget_state: z.enum(['available', 'exhausted', 'disabled']),
  },
  error_surfaced: { code: Key, surface: Surface, recoverable: z.boolean() },
}
export const EventContextSchema = z.strictObject({
  session_id: Id.nullable(),
  app_version: AppVersionSchema,
  platform: z.enum(['ios', 'android', 'web']),
  os_version: z.string().regex(/^[0-9A-Za-z._-]{1,64}$/),
  device_model: Key,
  locale: z.enum(['es-ES', 'en']),
  active_engine: Engine,
  trip_active: z.boolean(),
  offline: z.boolean(),
})
/** Identity/server timestamp are injected by the server, never caller-controlled. */
function eventFor<K extends keyof typeof eventPropertyShapes>(name: K) {
  return z.strictObject({
    event_id: Id,
    client_ts: T,
    context: EventContextSchema,
    name: z.literal(name),
    props: z.strictObject(eventPropertyShapes[name]),
  })
}
const eventNames = Object.keys(eventPropertyShapes) as (keyof typeof eventPropertyShapes)[]
export const EventSchema = z.union(eventNames.map(eventFor))
export const AnalyticsRequestSchema = z.strictObject({ events: z.array(EventSchema).max(500) })
export const AnalyticsEnvelopeSchema = z.strictObject({ events: z.array(z.unknown()).max(500) })
export const AnalyticsResponseSchema = z.looseObject({
  accepted: N,
  rejected: z.array(
    z.strictObject({ index: N, event_id: Id.nullable(), code: z.literal('VALIDATION_FAILED') }),
  ),
})
export type AnalyticsEvent = z.infer<typeof EventSchema>
export type AnalyticsRequest = z.infer<typeof AnalyticsRequestSchema>
export type AnalyticsResponse = z.infer<typeof AnalyticsResponseSchema>

export type EventContext = z.infer<typeof EventContextSchema>

export type Event = z.infer<typeof EventSchema>

export type AnalyticsEnvelope = z.infer<typeof AnalyticsEnvelopeSchema>
