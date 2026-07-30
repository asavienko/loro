/**
 * Engine tests: the shared conformance suite plus each engine's own rules.
 *
 * These run with no renderer, no simulator, and no device — which is the whole
 * reason engines are headless. See docs/architecture/practice-engines.md
 */

import { describe, expect, it } from 'vitest'
import { runConformanceSuite } from './conformance.js'
import { StreamEngine, streamStats } from './stream/index.js'
import {
  RefrainEngine,
  automaticity,
  beatMsForMode,
  effortState,
  modeForRep,
  modelRateForMode,
  refrainSetSize,
  selectRefrainSet,
  warmBand,
  REFRAIN_MODES,
} from './refrain/index.js'
import { makeContext, makePhrase, seedFixture, T0 } from '../testing/index.js'
import type { Attempt } from './types.js'
import { LadderRung } from '../domain/phrase.js'
import { userPhraseId } from '../domain/ids.js'
import effortFixtures from '../domain/effort.fixtures.json'

const success = (itemId: string, extra: Partial<Attempt> = {}): Attempt => ({
  itemId,
  outcome: 'success',
  latencyMs: 1200,
  hintsUsed: 0,
  at: T0,
  ...extra,
})

// ─────────────────────────────────────────────────────────────────────────────

describe('StreamEngine', () => {
  runConformanceSuite(new StreamEngine(), {
    makeContext: () => makeContext(),
    makeEmptyContext: () => makeContext([]),
    makeSuccessAttempt: success,
    signals: {
      maintains: ['reps', 'plays', 'lastPracticedAt', 'latencySampleMs', 'axes'],
      exempt: {
        srs: 'passive listening is exposure, not a review — recognition without production',
        repsToday: 'the stream is open-ended; it has no daily rep target to count against',
        automaticity: 'derived from repsToday, which the stream does not keep',
        lockedInToday: 'lock-in is the Refrain’s closed-set idea; the stream has no set',
        rung: 'the ladder measures depth of production; listening produces nothing',
        stumbles: 'there is no gate to fail — the stream cannot tell a stumble from silence',
        staleReset: 'Loop C staleness is reset by producing, not by hearing',
        cueLevel: 'prosody cueing needs the DSP (plans/19, plans/27); no engine writes it yet',
        difficulty: 'the learner re-rates from the stream UI; the engine never infers it',
        learned: 'marking a phrase learned is a deliberate learner action, never inferred',
      },
    },
  })

  it('excludes learned phrases from the queue', async () => {
    const plan = await new StreamEngine().plan(makeContext())
    const ids = new Set(plan.items.map((i) => i.phraseId))
    // shp1 is learned in the blueprint's seed.
    expect(ids.has('shp1' as never)).toBe(false)
  })

  it('orders difficult before easy at equal play counts', async () => {
    const ctx = makeContext([
      makePhrase('easy', { difficulty: 'easy', plays: 5 }),
      makePhrase('hard', { difficulty: 'hard', plays: 5 }),
    ])
    const plan = await new StreamEngine().plan(ctx)
    expect(plan.items[0]!.phraseId).toBe('hard')
  })

  it('surfaces loved phrases sooner', async () => {
    const ctx = makeContext([
      makePhrase('plain', { plays: 3 }),
      makePhrase('loved', { plays: 3, loved: true }),
    ])
    const plan = await new StreamEngine().plan(ctx)
    expect(plan.items[0]!.phraseId).toBe('loved')
  })

  it('never starves a phrase — plays dominate the rank', async () => {
    const ctx = makeContext([
      makePhrase('freshEasy', { difficulty: 'easy', plays: 0 }),
      makePhrase('staleHard', { difficulty: 'hard', plays: 20 }),
    ])
    const plan = await new StreamEngine().plan(ctx)
    expect(plan.items[0]!.phraseId).toBe('freshEasy')
  })

  it('emits one item per repetition, sized by difficulty', async () => {
    const ctx = makeContext([makePhrase('h', { difficulty: 'hard' })])
    const plan = await new StreamEngine().plan(ctx)
    expect(plan.items).toHaveLength(4) // hard → 4
  })

  it('counts a play only when a full repeat cycle completes', async () => {
    const engine = new StreamEngine()
    const ctx = makeContext([makePhrase('m', { difficulty: 'med' })]) // 3 reps
    const plan = await engine.plan(ctx)
    const session = { sessionId: 's', plan, cursor: 0 }

    expect((await engine.record(session, success('m#0'))).plays).toBe(0)
    expect((await engine.record(session, success('m#1'))).plays).toBe(0)
    expect((await engine.record(session, success('m#2'))).plays).toBe(1)
  })

  it('never reports a latency for passive listening', async () => {
    const engine = new StreamEngine()
    const plan = await engine.plan(makeContext())
    const delta = await engine.record(
      { sessionId: 's', plan, cursor: 0 },
      success(plan.items[0]!.itemId),
    )
    expect(delta.latencySampleMs).toBeNull()
  })

  it('is an open-ended session', async () => {
    expect((await new StreamEngine().plan(makeContext())).closed).toBe(false)
  })

  it('reports unavailable on an empty stream', async () => {
    expect((await new StreamEngine().availability(makeContext([]))).state).toBe('unavailable')
  })
})

describe('stream helpers', () => {
  it('counts the header stats, excluding learned from loved and hard', () => {
    expect(streamStats(seedFixture())).toEqual({ loved: 1, hard: 2, learned: 1 })
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('RefrainEngine', () => {
  runConformanceSuite(new RefrainEngine(), {
    makeContext: () => makeContext(),
    makeEmptyContext: () => makeContext([]),
    makeSuccessAttempt: success,
    signals: {
      maintains: [
        'reps',
        'lastPracticedAt',
        'latencySampleMs',
        'srs',
        'repsToday',
        'automaticity',
        'lockedInToday',
        'rung',
        'stumbles',
        'axes',
      ],
      exempt: {
        plays: 'a play is a stream listen-through; the Refrain counts reps, not plays',
        staleReset: 'Loop C staleness lands with the Phrasebook (plans/23), not here',
        cueLevel: 'prosody cueing needs the DSP (plans/19, plans/27); no engine writes it yet',
        difficulty: 'the learner rates a phrase; six reps of it are not evidence to overrule them',
        learned: 'graduation is lockInDays reaching 4, applied by the store — not a delta',
      },
    },
  })

  it('is a CLOSED session — you can finish today', async () => {
    expect((await new RefrainEngine().plan(makeContext())).closed).toBe(true)
  })

  it('builds a set sized by the daily-minutes answer', async () => {
    const engine = new RefrainEngine()
    for (const [minutes, size] of [
      [5, 3],
      [10, 5],
      [20, 8],
    ] as const) {
      const ctx = makeContext(
        Array.from({ length: 12 }, (_, i) => makePhrase(`p${i}`)),
        { settings: { dailyMinutes: minutes, waveTimes: [], repTarget: 6 } },
      )
      const plan = await engine.plan(ctx)
      expect(new Set(plan.items.map((i) => i.phraseId)).size, `${minutes} min`).toBe(size)
    }
  })

  it('rotates the mode across the six reps of a phrase', async () => {
    const ctx = makeContext([makePhrase('one')])
    const plan = await new RefrainEngine().plan(ctx)
    expect(plan.items.map((i) => i.mode)).toEqual([...REFRAIN_MODES])
  })

  it('withholds the model audio from Cloze onwards', async () => {
    const ctx = makeContext([makePhrase('one')])
    const plan = await new RefrainEngine().plan(ctx)
    expect(plan.items.map((i) => i.audio !== null)).toEqual([true, true, true, false, false, false])
  })

  it('applies the production gate from Cloze onwards', async () => {
    const ctx = makeContext([makePhrase('one')])
    const plan = await new RefrainEngine().plan(ctx)
    expect(plan.items.map((i) => i.gate.kind)).toEqual([
      'asr-partial',
      'asr-partial',
      'asr-partial',
      'asr-full',
      'asr-full',
      'asr-full',
    ])
  })

  it('strips the prompt as the modes progress', async () => {
    const ctx = makeContext([makePhrase('one')])
    const plan = await new RefrainEngine().plan(ctx)
    expect(plan.items.map((i) => i.prompt.show)).toEqual([
      'full',
      'full',
      'full',
      'cloze',
      'meaning',
      'nothing',
    ])
  })

  it('passes through MEASURED latency and preserves null', async () => {
    const engine = new RefrainEngine()
    const plan = await engine.plan(makeContext([makePhrase('one')]))
    const session = { sessionId: 's', plan, cursor: 0 }

    const measured = await engine.record(session, success('one#0', { latencyMs: 940 }))
    expect(measured.latencySampleMs).toBe(940)

    // Onset was never detected. The read-out is hidden, never estimated.
    const unmeasured = await engine.record(session, success('one#1', { latencyMs: null }))
    expect(unmeasured.latencySampleMs).toBeNull()
  })

  it('writes FSRS state even though the screen shows no interval (rule 5)', async () => {
    const engine = new RefrainEngine()
    const plan = await engine.plan(makeContext([makePhrase('one')]))
    const delta = await engine.record({ sessionId: 's', plan, cursor: 0 }, success('one#0'))
    expect(delta.srs).toBeDefined()
    expect(delta.srs!.due).toBeGreaterThan(T0)
  })

  it('grades a hinted rep lower than a clean one', async () => {
    const engine = new RefrainEngine()
    const plan = await engine.plan(makeContext([makePhrase('one')]))
    const session = { sessionId: 's', plan, cursor: 0 }
    const clean = await engine.record(session, success('one#0'))
    const hinted = await engine.record(session, success('one#0', { hintsUsed: 2 }))
    expect(hinted.srs!.stability).toBeLessThan(clean.srs!.stability)
  })

  it('earns Bent for a hint-free Cloze or Call rep', async () => {
    const engine = new RefrainEngine()
    const plan = await engine.plan(makeContext([makePhrase('one')]))
    const session = { sessionId: 's', plan, cursor: 0 }
    expect((await engine.record(session, success('one#3'))).rung).toBe(LadderRung.Bent)
    expect((await engine.record(session, success('one#4'))).rung).toBe(LadderRung.Bent)
  })

  it('earns Pressure-tested for a fast Speed rep', async () => {
    const engine = new RefrainEngine()
    const plan = await engine.plan(makeContext([makePhrase('one')]))
    const delta = await engine.record(
      { sessionId: 's', plan, cursor: 0 },
      success('one#2', { latencyMs: 620 }),
    )
    expect(delta.rung).toBe(LadderRung.PressureTested)
  })

  it('records a stumble on a failed rep', async () => {
    const engine = new RefrainEngine()
    const plan = await engine.plan(makeContext([makePhrase('one')]))
    const delta = await engine.record(
      { sessionId: 's', plan, cursor: 0 },
      { itemId: 'one#0', outcome: 'failed', latencyMs: null, hintsUsed: 0, at: T0 },
    )
    expect(delta.stumbles).toBe(1)
    expect(delta.reps).toBe(0)
  })

  it('advances recall faster in Cold mode', async () => {
    const engine = new RefrainEngine()
    const plan = await engine.plan(makeContext([makePhrase('one')]))
    const session = { sessionId: 's', plan, cursor: 0 }
    const echo = await engine.record(session, success('one#0'))
    const cold = await engine.record(session, success('one#5'))
    expect(cold.axes!.recall!).toBeGreaterThan(echo.axes!.recall!)
  })
})

describe('refrain set selection', () => {
  it('prioritises phrases mid-graduation', () => {
    const set = selectRefrainSet(
      [makePhrase('new1'), makePhrase('midway', { lockInDays: 2, reps: 12 }), makePhrase('new2')],
      2,
    )
    expect(set[0]).toBe('midway')
  })

  it('pulls in the trip drop when a trip is active', () => {
    const set = selectRefrainSet([makePhrase('a'), makePhrase('tripPhrase')], 1, [
      userPhraseId('tripPhrase'),
    ])
    expect(set).toEqual(['tripPhrase'])
  })

  it('prefers the weakest practised phrase over stronger ones', () => {
    const set = selectRefrainSet(
      [
        makePhrase('strong', { reps: 5, automaticity: 90 }),
        makePhrase('weak', { reps: 5, automaticity: 20 }),
      ],
      1,
    )
    expect(set).toEqual(['weak'])
  })

  it('excludes learned and graduated phrases', () => {
    const set = selectRefrainSet(
      [
        makePhrase('learned', { learned: true }),
        makePhrase('grad', { graduatedAt: T0 }),
        makePhrase('ok'),
      ],
      5,
    )
    expect(set).toEqual(['ok'])
  })

  it('is stable — the same store yields the same set', () => {
    const phrases = Array.from({ length: 20 }, (_, i) => makePhrase(`p${i}`, { reps: i % 3 }))
    expect(selectRefrainSet(phrases, 5)).toEqual(selectRefrainSet(phrases, 5))
  })

  it('never exceeds the requested size', () => {
    const phrases = Array.from({ length: 50 }, (_, i) => makePhrase(`p${i}`))
    expect(selectRefrainSet(phrases, 5)).toHaveLength(5)
  })

  it('copes with fewer phrases than the set size', () => {
    expect(selectRefrainSet([makePhrase('only')], 5)).toEqual(['only'])
  })
})

describe('refrain mechanics', () => {
  it('reaches 100% automaticity at the target', () => {
    expect(automaticity(0, 6)).toBe(0)
    expect(automaticity(3, 6)).toBe(50)
    expect(automaticity(6, 6)).toBe(100)
    expect(automaticity(12, 6)).toBe(100)
    expect(automaticity(3, 0)).toBe(0)
  })

  it('warms through four bands', () => {
    expect(warmBand(0)).toBe('cold')
    expect(warmBand(32)).toBe('cold')
    expect(warmBand(33)).toBe('warm')
    expect(warmBand(66)).toBe('hot')
    expect(warmBand(100)).toBe('peak')
  })

  it('escalates the presentation-neutral effort state', () => {
    for (const fixture of effortFixtures) {
      expect(effortState(fixture.reps, fixture.automaticityPct)).toBe(fixture.expect)
    }
  })

  it('holds at Cold past the last mode', () => {
    expect(modeForRep(5)).toBe('cold')
    expect(modeForRep(99)).toBe('cold')
  })

  it('speeds up the beat only in Speed mode', () => {
    expect(beatMsForMode('speed')).toBe(340)
    expect(beatMsForMode('echo')).toBe(720)
  })

  it('plays Speed faster than Echo', () => {
    expect(modelRateForMode('speed')!).toBeGreaterThan(modelRateForMode('echo')!)
    expect(modelRateForMode('cold')).toBeNull()
  })

  it('sizes the set from daily minutes', () => {
    expect(refrainSetSize(5)).toBe(3)
    expect(refrainSetSize(10)).toBe(5)
    expect(refrainSetSize(20)).toBe(8)
  })
})
