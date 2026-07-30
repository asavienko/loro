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
  DEFAULT_REP_TARGET,
  RefrainEngine,
  StreamEngine,
  type EngineContext,
  type PhraseRepository,
} from '@loro/core'
import { deviceClock } from '../lib/clock'
import { jsCoreFacade } from './coreFacade'
import { useApp } from './store'

export function engineContext(): EngineContext {
  const phrases = useApp.getState().phrases
  /**
   * KNOWN DIVERGENCE, left exactly as it is.
   *
   * `active()` here filters only `!learned`, while the persistence layer's
   * `PhraseTable.active()` (`packages/core/src/persistence/memory.ts:44` and its SQL twin)
   * ALSO requires `graduatedAt === null`. So a graduated phrase stays in what the engines
   * plan from, and the Refrain keeps offering work on a phrase that left rotation four
   * lock-in days ago — while every persistence reader already excludes it.
   *
   * Swapping in the repository would fix that AND change which phrases the learner is asked
   * to practise, which is a behaviour change, not a refactor. Recorded for the plan that
   * wires persistence into the store (plans/09/10); the two must agree then, and the
   * repository's definition is the right one to keep.
   */
  const repo: PhraseRepository = {
    all: () => Promise.resolve(phrases),
    byId: (id) => Promise.resolve(phrases.find((p) => p.id === id) ?? null),
    active: () => Promise.resolve(phrases.filter((p) => !p.learned)),
    due: (at) => Promise.resolve(phrases.filter((p) => p.srs !== null && p.srs.due <= at)),
  }
  return {
    phrases: repo,
    clock: deviceClock,
    core: jsCoreFacade,
    settings: {
      dailyMinutes: useApp.getState().dailyMinutes,
      waveTimes: ['08:00', '13:00', '19:00'],
      repTarget: DEFAULT_REP_TARGET,
    },
    trip: null,
    flags: { bool: (_k, d) => d, number: (_k, d) => d },
    seed: 42,
  }
}

export const streamEngine = new StreamEngine()
export const refrainEngine = new RefrainEngine()
