/**
 * @loro/core — shared domain model, used by BOTH apps/mobile and apps/api.
 *
 * Rules for this package:
 *   • No platform imports (no react, react-native, @nestjs/*, node:*)
 *   • No I/O — types, schemas, and pure functions only
 *   • Reproducible maths belongs in @loro/core-rs, not here (ADR-0002). `domain/calendar.ts`
 *     is a declared exception with an expiry date: it mirrors `core-rs/src/calendar.rs`
 *     until the UniFFI bridge exists, and a shared fixture fails the build if the two
 *     drift. See its header, and plans/05-fix-shared-maths-duplication.md.
 */

export * from './domain/ids.js'
export * from './domain/phrase.js'
export * from './domain/calendar.js'
export * from './domain/text.js'

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

// Local persistence: schema, migrations, repositories, outbox. Driver-agnostic — the
// concrete SQLite driver is supplied by the platform.
export * from './persistence/index.js'

// Engine implementations. v1 ships stream + refrain; the rest land per the roadmap.
export {
  StreamEngine,
  streamStats,
  RefrainEngine,
  REFRAIN_MODES,
  DEFAULT_REP_TARGET,
  LOCK_IN_DAYS_TO_GRADUATE,
  effortState,
  warmBand,
} from './engines/index.js'
export type { EffortState, RefrainMode, WarmBand } from './engines/index.js'

export * from './domain/languages.js'
