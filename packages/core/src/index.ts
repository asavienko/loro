/**
 * @loro/core — shared domain model, used by BOTH apps/mobile and apps/api.
 *
 * Rules for this package:
 *   • No platform imports (no react, react-native, @nestjs/*, node:*)
 *   • No I/O — types, schemas, and pure functions only
 *   • Reproducible maths belongs in @loro/core-rs, not here (ADR-0002). `domain/calendar.ts`
 *     is a declared exception: it mirrors `core-rs/src/calendar.rs` for JS callers until
 *     plan 70. UniFFI already exports the same functions; the JSON WASM bridge does not
 *     dispatch calendar methods. A shared fixture fails the build if the two drift. See
 *     its header, and plans/archive/2026-07-30/05-fix-shared-maths-duplication.md.
 */

export * from './domain/ids.js'
export * from './domain/phrase.js'
export * from './domain/calendar.js'
export * from './domain/text.js'
export * from './domain/phraseReach.js'

export type {
  EngineId,
  PracticeEngine,
  PracticeItem,
  PromptSpec,
  GateSpec,
  AudioSpec,
  Attempt,
  ScoreBreakdown,
  ProgressDelta,
  SessionPlan,
  SessionHandle,
  SessionSummary,
  Availability,
  EngineContext,
  PhraseRepository,
  PracticeSettings,
  TripContext,
  LoroCoreFacade,
  Clock,
} from './engines/types.js'

export { FIELD_POLICY, mergeClassFor, mergeClassOf, isSyncEntity } from './sync/fieldPolicy.js'
export type { MergeClass, SyncEntity } from './sync/fieldPolicy.js'
export {
  PHRASE_STORAGE_ONLY_COLUMNS,
  PHRASE_SYNC_SQL_COLUMNS,
  PHRASE_WIRE_TO_SQL,
  SETTINGS_DEVICE_ONLY_FIELDS,
  SETTINGS_SYNC_FIELDS,
  SETTINGS_WIRE_TO_SQL,
  USER_PHRASE_SYNC_FIELDS,
} from './sync/syncableColumns.js'
export type {
  SettingsWireField,
  SyncableColumn,
  UserPhraseWireField,
} from './sync/syncableColumns.js'

// Local persistence: schema, migrations, repositories, outbox. Driver-agnostic — the
// concrete SQLite driver is supplied by the platform.
export * from './persistence/index.js'

// Engine implementations. v1 ships stream + refrain; the rest land per the roadmap.
export {
  StreamEngine,
  SpeakEngine,
  streamStats,
  RefrainEngine,
  REFRAIN_MODES,
  DEFAULT_REP_TARGET,
  LOCK_IN_DAYS_TO_GRADUATE,
  effortState,
  warmBand,
  selectRefrainSet,
} from './engines/index.js'
export type { EffortState, RefrainMode, WarmBand } from './engines/index.js'

export * from './domain/languages.js'
