/**
 * The engines, and the `EngineContext` they run against.
 *
 * An engine receives every capability it needs — rows, clock, core maths, settings, flags,
 * seed — so it stays pure and unit-testable without a renderer or a native binding
 * (ADR-0006, practice-engines.md). This file is the one place that context is assembled
 * from the live store, which is also the seam persistence slots into: `PhraseRepository` is
 * already promise-shaped, so swapping the in-memory array for a SQLite repository changes
 * this file and nothing an engine can see.
 */

import {
  userPhraseId,
  DEFAULT_REP_TARGET,
  RefrainEngine,
  SpeakEngine,
  StreamEngine,
  isActive,
  isDue,
  type Clock,
  type EngineContext,
  type LoroCoreFacade,
  type PhraseRepository,
  type TripContext,
  type UserPhraseId,
} from '@loro/core'
import type { StoreApi } from 'zustand'
import { deviceClock } from '../lib/clock'
import { rustCoreFacade } from './coreFacade'
import { useApp } from './store'
import type { AppState } from './types'

export interface EngineContextDeps {
  readonly clock: Clock
  readonly waveTimes: readonly string[]
  readonly repTarget: number
  readonly trip: TripContext | null
  readonly flags: EngineContext['flags']
  readonly seed: number
}

/** Build an engine context from explicit collaborators, with no module-global reads. */
export function createEngineContext(
  store: Pick<StoreApi<AppState>, 'getState'>,
  deps: EngineContextDeps,
  core: LoroCoreFacade,
  overrides?: { readonly refrainSet?: readonly UserPhraseId[] },
): EngineContext {
  const state = store.getState()
  // A context belongs to the attempt/course that created it. A later language or
  // account switch must not redirect an asynchronous recording to another row set.
  const phrases = state.phrases
  /**
   * The store's array, read through the SAME eligibility rule as the repositories.
   *
   * This used to carry a recorded divergence: `active()` filtered only `!learned`, while
   * `PhraseTable.active()` and the Refrain's own candidate filter ALSO required
   * `graduatedAt === null`. So a graduated phrase stayed in what the engines planned from,
   * and the Stream kept offering work on a phrase that left rotation four lock-in days ago
   * — while every persistence reader already excluded it. `due()` disagreed the other way,
   * omitting the `!learned` the repositories require.
   *
   * `isActive` / `isDue` are the domain's (`@loro/core`), so there is now one rule and three
   * call sites rather than four rules. Deletion needs no check here: `removePhrase` splices
   * the row out of the array, so a deleted phrase is not a candidate to filter.
   */
  const repo: PhraseRepository = {
    all: () => Promise.resolve(phrases),
    byId: (id) => Promise.resolve(phrases.find((p) => p.id === id) ?? null),
    active: () => Promise.resolve(phrases.filter(isActive)),
    due: (at) => Promise.resolve(phrases.filter((p) => isDue(p, at))),
  }
  return {
    phrases: repo,
    clock: deps.clock,
    core,
    settings: {
      dailyMinutes: state.dailyMinutes,
      waveTimes: deps.waveTimes,
      repTarget: deps.repTarget,
    },
    trip: deps.trip,
    flags: deps.flags,
    seed: deps.seed,
    ...(overrides?.refrainSet !== undefined
      ? { refrainSet: overrides.refrainSet }
      : state.refrainDay === deps.clock.localDay()
        ? { refrainSet: state.refrainSet.map(userPhraseId) }
        : {}),
  }
}

/**
 * The wave schedule the production engines run on — and the one Today's day list renders.
 *
 * Keys are structure (Loop B's three waves, in this order). Times are SETTINGS, not copy:
 * Today used to print its own 12-hour display strings out of `copy.today.waves` ("1:00",
 * "7:00") beside these 24-hour ones, so the screen and the engine could disagree about when
 * the midday wave is and nothing would fail. Both are exported so screens cannot drift from
 * the scheduler; `lib/waves.ts` stays a generic zipper over whatever keys a caller passes.
 */
export const PRODUCTION_WAVES = ['morning', 'midday', 'evening'] as const
export type ProductionWave = (typeof PRODUCTION_WAVES)[number]
export const PRODUCTION_WAVE_TIMES = ['08:00', '13:00', '19:00'] as const

const productionEngineDeps: EngineContextDeps = {
  clock: deviceClock,
  waveTimes: PRODUCTION_WAVE_TIMES,
  repTarget: DEFAULT_REP_TARGET,
  trip: null,
  flags: { bool: (_k, d) => d, number: (_k, d) => d },
  seed: 42,
}

/** Production wrapper retained for existing route call sites. */
export function engineContext(overrides?: {
  readonly refrainSet?: readonly UserPhraseId[]
}): EngineContext {
  return createEngineContext(useApp, productionEngineDeps, rustCoreFacade, overrides)
}

export const streamEngine = new StreamEngine()
export const refrainEngine = new RefrainEngine(engineContext)
export const speakEngine = new SpeakEngine()
