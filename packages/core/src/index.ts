/**
 * @loro/core — shared domain model, used by BOTH apps/mobile and apps/api.
 *
 * Rules for this package:
 *   • No platform imports (no react, react-native, @nestjs/*, node:*)
 *   • No I/O — types, schemas, and pure functions only
 *   • Reproducible maths belongs in @loro/core-rs, not here (ADR-0002)
 */

export * from './domain/ids.js'
export * from './domain/phrase.js'

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

export { FIELD_POLICY, mergeClassFor } from './sync/fieldPolicy.js'
export type { MergeClass, SyncEntity } from './sync/fieldPolicy.js'

// Engine implementations. v1 ships stream + refrain; the rest land per the roadmap.
export {
  StreamEngine,
  streamStats,
  rerateToast,
  RefrainEngine,
  REFRAIN_MODES,
  DEFAULT_REP_TARGET,
  LOCK_IN_DAYS_TO_GRADUATE,
  refrainSetSize,
  modeForRep,
  modelRateForMode,
  beatMsForMode,
  micLabelForMode,
  automaticity,
  effortLabel,
  warmBand,
  selectRefrainSet,
} from './engines/index.js'
export type { RefrainMode, WarmBand } from './engines/index.js'
