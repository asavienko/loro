/**
 * The conformance suite every practice engine must pass.
 *
 * This is the mechanism that makes RULE 5 real rather than aspirational:
 *
 *   > Every engine maintains every progress signal it can legitimately compute,
 *   > including ones it does not display.
 *
 * A learner practising only in the Refrain still accrues FSRS state and ladder rungs,
 * which is what makes engine switching lossless and the loop experiment interpretable.
 *
 * See docs/architecture/practice-engines.md#conformance
 */

import { expect, it, describe } from 'vitest'
import type { EngineContext, PracticeEngine, Attempt, ProgressDelta } from './types.js'
import type { PhraseState } from '../domain/phrase.js'
import { LadderRung } from '../domain/phrase.js'

export interface ConformanceOptions {
  /** A context with a populated store. */
  readonly makeContext: () => EngineContext
  /** A context whose store is empty. */
  readonly makeEmptyContext: () => EngineContext
  /**
   * Build a successful attempt for the engine's first item.
   * Engines gate differently, so the suite can't guess.
   */
  readonly makeSuccessAttempt: (itemId: string) => Attempt
  /** Engines that legitimately never write FSRS (e.g. passive listening). */
  readonly skipFsrs?: boolean
}

/**
 * Run the suite against an engine.
 *
 * ```ts
 * describe('StreamEngine', () => {
 *   runConformanceSuite(new StreamEngine(), { makeContext, ... })
 * })
 * ```
 */
export function runConformanceSuite(engine: PracticeEngine, opts: ConformanceOptions): void {
  describe(`conformance: ${engine.id}`, () => {
    it('plan() does not mutate the store', async () => {
      const ctx = opts.makeContext()
      const before = snapshot(await ctx.phrases.all())
      await engine.plan(ctx)
      expect(snapshot(await ctx.phrases.all())).toEqual(before)
    })

    it('is deterministic given the same store, clock, and seed', async () => {
      const a = await engine.plan(opts.makeContext())
      const b = await engine.plan(opts.makeContext())
      expect(a.items.map((i) => `${i.phraseId}:${i.mode}`)).toEqual(
        b.items.map((i) => `${i.phraseId}:${i.mode}`),
      )
    })

    it('uses no ambient nondeterminism', async () => {
      // If an engine reaches for Date.now() or Math.random() instead of its injected
      // clock and seed, it is not reproducible and cannot be golden-tested.
      /* eslint-disable no-restricted-syntax -- deliberate: we replace the globals to prove engines never reach for them */
      const realNow = Date.now
      const realRandom = Math.random
      Date.now = () => {
        throw new Error('engine called Date.now() — use ctx.clock')
      }
      Math.random = () => {
        throw new Error('engine called Math.random() — use ctx.seed')
      }
      try {
        await engine.plan(opts.makeContext())
      } finally {
        Date.now = realNow
        Math.random = realRandom
      }
      /* eslint-enable no-restricted-syntax */
    })

    it('records the universal progress signals once a phrase is worked through', async () => {
      // Deliberately measured across the phrase's WHOLE unit of work, not a single
      // item: the stream's unit is a full repeat cycle, the Refrain's is six reps.
      // Asserting on one item would encode one engine's shape as the rule.
      const delta = await recordFirstPhrase(engine, opts)
      if (delta === null) return // engine produced no items for this store
      expect(delta.reps, 'reps must advance').toBeGreaterThan(0)
      expect(delta.lastPracticedAt, 'lastPracticedAt must be set').toBeTypeOf('number')
    })

    it('maintains FSRS state even if it never shows an interval (rule 5)', async () => {
      if (opts.skipFsrs) return
      const delta = await recordFirstPhrase(engine, opts)
      if (delta === null) return
      expect(delta.srs, 'every engine feeds FSRS — see rule 5').toBeDefined()
      expect(delta.srs?.due).toBeTypeOf('number')
    })

    it('never lowers a ladder rung', async () => {
      const delta = await recordFirstPhrase(engine, opts)
      if (delta?.rung === undefined) return
      const ctx = opts.makeContext()
      const phrase = await ctx.phrases.byId(delta.phraseId)
      const before = phrase?.rung ?? LadderRung.Accumulated
      expect(delta.rung, '"you only climb or hold"').toBeGreaterThanOrEqual(before)
    })

    it('reports latency as a measured number or null, never an estimate', async () => {
      const delta = await recordFirstPhrase(engine, opts)
      if (delta === null || !('latencySampleMs' in delta)) return
      const ms = delta.latencySampleMs
      expect(ms === null || typeof ms === 'number').toBe(true)
    })

    it('is idempotent when the same attempt is replayed', async () => {
      const ctx = opts.makeContext()
      const plan = await engine.plan(ctx)
      const firstItem = plan.items[0]
      if (firstItem === undefined) return
      const session = { sessionId: 's1', plan, cursor: 0 }
      const attempt = opts.makeSuccessAttempt(firstItem.itemId)
      const once = await engine.record(session, attempt)
      const twice = await engine.record(session, attempt)
      expect(twice).toEqual(once)
    })

    it('produces a usable empty plan for an empty store', async () => {
      const plan = await engine.plan(opts.makeEmptyContext())
      expect(plan.items).toHaveLength(0)
      expect(plan.engineId).toBe(engine.id)
    })

    it('terminates when the session is closed', async () => {
      const ctx = opts.makeContext()
      const plan = await engine.plan(ctx)
      if (!plan.closed) return
      let cursor = 0
      // Guard against a non-terminating engine rather than hanging the suite.
      for (let i = 0; i <= plan.items.length + 1; i++) {
        const item = await engine.next({ sessionId: 's', plan, cursor })
        if (item === null) return
        cursor++
      }
      throw new Error('a closed session must eventually return null from next()')
    })

    it('reports availability without throwing', async () => {
      const availability = await engine.availability(opts.makeContext())
      expect(['available', 'degraded', 'unavailable']).toContain(availability.state)
    })
  })
}

/**
 * Work the first phrase through every item the engine planned for it, and
 * accumulate the deltas.
 *
 * Engines differ in what one item means — a repetition, a rep with a rotating mode,
 * a beat in a finisher — so the unit the rules are stated over is "one phrase's work".
 */
async function recordFirstPhrase(
  engine: PracticeEngine,
  opts: ConformanceOptions,
): Promise<ProgressDelta | null> {
  const ctx = opts.makeContext()
  const plan = await engine.plan(ctx)
  const first = plan.items[0]
  if (first === undefined) return null

  const phraseId = first.phraseId
  const items = plan.items.filter((i) => i.phraseId === phraseId)
  const session = { sessionId: 'conformance', plan, cursor: 0 }

  // Accumulated as a mutable draft, then frozen — `exactOptionalPropertyTypes` makes
  // spreading optional fields across a union unpleasant, and this is clearer anyway.
  let reps = 0
  let plays = 0
  let rung: ProgressDelta['rung']
  let last: ProgressDelta = { phraseId }

  for (const item of items) {
    const d = await engine.record(session, opts.makeSuccessAttempt(item.itemId))
    reps += d.reps ?? 0
    plays += d.plays ?? 0
    // Monotonic signals accumulate as a maximum, mirroring the `max` merge class.
    if (d.rung !== undefined) rung = rung === undefined ? d.rung : Math.max(rung, d.rung)
    last = d
  }

  return {
    ...last,
    phraseId,
    reps,
    plays,
    ...(rung === undefined ? {} : { rung }),
  }
}

function snapshot(phrases: readonly PhraseState[]): string {
  return JSON.stringify(phrases)
}
