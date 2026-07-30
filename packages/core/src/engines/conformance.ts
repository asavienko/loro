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
import type {
  EngineContext,
  PracticeEngine,
  Attempt,
  ProgressDelta,
  ProgressSignal,
} from './types.js'
import { PROGRESS_SIGNALS } from './types.js'
import type { PhraseState } from '../domain/phrase.js'
import { LadderRung } from '../domain/phrase.js'

/**
 * What an engine claims about rule 5, declared rather than inferred.
 *
 * Every signal on `ProgressDelta` must appear in exactly one of these. That is the whole
 * mechanism: an engine may decline a signal, but it may not IGNORE one, and a signal
 * added to the contract fails every engine's suite until each has decided about it.
 *
 * A single `skipFsrs`-style flag per exemption cannot do this — it answers one question
 * and stays silent about the other fourteen.
 */
export interface SignalManifest {
  /** Signals this engine writes. Its own tests say when and with what value. */
  readonly maintains: readonly ProgressSignal[]
  /**
   * Signals it legitimately cannot, mapped to WHY. The reason is the point: "passive
   * listening is not a review" is a design decision, and an exemption without one is
   * usually an oversight wearing a declaration.
   */
  readonly exempt: Partial<Record<ProgressSignal, string>>
}

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
  /** Required — see `SignalManifest`. There is no default, because a default is a guess. */
  readonly signals: SignalManifest
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

    // ── the signal manifest: rule 5, declared and checked ──

    it('classifies every progress signal as maintained or exempt', () => {
      const maintained = new Set<string>(opts.signals.maintains)
      const exempt = new Set(Object.keys(opts.signals.exempt))

      const undeclared = PROGRESS_SIGNALS.filter((s) => !maintained.has(s) && !exempt.has(s))
      expect(
        undeclared,
        'a signal on ProgressDelta that no engine decided about is rule 5 quietly failing',
      ).toEqual([])

      const both = PROGRESS_SIGNALS.filter((s) => maintained.has(s) && exempt.has(s))
      expect(both, 'a signal cannot be both maintained and exempt').toEqual([])
    })

    it('gives a reason for every exemption', () => {
      for (const [signal, why] of Object.entries(opts.signals.exempt)) {
        expect(why, `${signal} is exempt with no reason`).toBeTruthy()
      }
    })

    it('never writes a signal it declared exempt', async () => {
      // Checked across EVERY delta, not the accumulation: a conditional write (a stumble,
      // a rung) shows up in one delta and would be invisible in a merged one.
      const written = new Set<string>()
      for (const delta of await recordPhraseWork(engine, opts)) {
        for (const key of Object.keys(delta)) written.add(key)
      }
      const lied = Object.keys(opts.signals.exempt).filter((s) => written.has(s))
      expect(lied, 'declared exempt but written anyway').toEqual([])
    })

    it('maintains FSRS state even if it never shows an interval (rule 5)', async () => {
      if (opts.signals.exempt.srs !== undefined) return
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
async function recordPhraseWork(
  engine: PracticeEngine,
  opts: ConformanceOptions,
): Promise<readonly ProgressDelta[]> {
  const ctx = opts.makeContext()
  const plan = await engine.plan(ctx)
  const first = plan.items[0]
  if (first === undefined) return []

  const items = plan.items.filter((i) => i.phraseId === first.phraseId)
  const session = { sessionId: 'conformance', plan, cursor: 0 }

  const deltas: ProgressDelta[] = []
  for (const item of items) {
    deltas.push(await engine.record(session, opts.makeSuccessAttempt(item.itemId)))
  }
  return deltas
}

async function recordFirstPhrase(
  engine: PracticeEngine,
  opts: ConformanceOptions,
): Promise<ProgressDelta | null> {
  const deltas = await recordPhraseWork(engine, opts)
  const last = deltas[deltas.length - 1]
  if (last === undefined) return null

  // Accumulated as a mutable draft, then frozen — `exactOptionalPropertyTypes` makes
  // spreading optional fields across a union unpleasant, and this is clearer anyway.
  let reps = 0
  let plays = 0
  let rung: ProgressDelta['rung']

  for (const d of deltas) {
    reps += d.reps ?? 0
    plays += d.plays ?? 0
    // Monotonic signals accumulate as a maximum, mirroring the `max` merge class.
    if (d.rung !== undefined) rung = rung === undefined ? d.rung : Math.max(rung, d.rung)
  }

  return {
    ...last,
    phraseId: last.phraseId,
    reps,
    plays,
    ...(rung === undefined ? {} : { rung }),
  }
}

function snapshot(phrases: readonly PhraseState[]): string {
  return JSON.stringify(phrases)
}
