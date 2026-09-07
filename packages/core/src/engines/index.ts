/**
 * Practice engines.
 *
 * Five to seven implementations of one contract, so the blueprint's three competing
 * philosophies stay viable. See docs/architecture/practice-engines.md and ADR-0006.
 *
 * Ship order: v1 stream + refrain · v1.1 srs, prosody, pronunciation, roleplay · v2 run.
 */

export * from './types.js'
export { StreamEngine, streamStats } from './stream/index.js'

export {
  RefrainEngine,
  REFRAIN_MODES,
  DEFAULT_REP_TARGET,
  LOCK_IN_DAYS_TO_GRADUATE,
  effortState,
  warmBand,
} from './refrain/index.js'
export type { EffortState, RefrainMode, WarmBand } from './refrain/index.js'
