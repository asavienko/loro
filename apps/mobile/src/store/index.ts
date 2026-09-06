/**
 * The app store — its public surface, and nothing else.
 *
 * Eight route files plus `ToastHost` import from `../src/store`, so every name below is a
 * contract: same name, same signature, same behaviour. The layout behind it is free to
 * change, and did — this file used to be 469 lines doing nine jobs at once.
 *
 * Where the jobs went:
 *
 *   state.ts        the data shape, INITIAL_STATE, the practice-day history
 *   delta.ts        applyDeltaToPhrase — the ONLY place a progress field is written
 *   catalog.ts      the bundled catalog and its lookup map
 *   phraseFactory.ts  the two ways a row comes into existence
 *   view.ts         the row ⋈ catalog join a screen renders
 *   slices/         the actions, grouped by concern
 *   store.ts        createAppStore + the app's instance
 *   selectors.ts    derived read-side hooks
 *   engines.ts      the engines and the EngineContext they run against
 *   coreFacade.ts   a TEMPORARY JS stand-in for packages/core-rs (ADR-0002, plans/05)
 *
 * Two rules the whole store holds:
 *   • The day comes from the injected `Clock`, never from a `Date` — one wrong line
 *     there reached every engine at once (see src/lib/clock.ts).
 *   • Practice outcomes are written ONLY through `applyDelta`, from a delta an engine
 *     produced. No action computes a progress field.
 */

export { INITIAL_STATE, dataOf, addPracticeDay } from './state'
export type { AppData, Toast } from './state'

export { applyDeltaToPhrase } from './delta'

export { catalogById, catalogPhrases, packs, scenarios } from './catalog'

export type { OwnPhraseDraft } from './phraseFactory'

export { toView } from './view'
export type { PhraseView } from './view'

export { createAppStore, useApp } from './store'
export type { AppState, StoreDeps } from './types'

export { useMastery, useViews } from './selectors'

export {
  PRODUCTION_WAVE_TIMES,
  createEngineContext,
  engineContext,
  refrainEngine,
  streamEngine,
} from './engines'
export type { EngineContextDeps } from './engines'
