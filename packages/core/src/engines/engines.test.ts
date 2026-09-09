import { fakeCore } from '../testing/index.js'
import { selectRefrainSet as selectCanonicalSet } from './refrain/index.js'
const selectRefrainSet = (...args: Parameters<ReturnType<typeof fakeCore>['selectRefrainSet']>) =>
  selectCanonicalSet(fakeCore(), ...args)
/**
 * Engine tests: the shared conformance suite plus each engine's own rules.
 *
 * These run with no renderer, no simulator, and no device — which is the whole
 * reason engines are headless. See docs/architecture/practice-engines.md
 */

import { describe, expect, it, vi } from 'vitest'
import { runConformanceSuite } from './conformance.js'
import { StreamEngine, streamStats } from './stream/index.js'
import { RefrainEngine, effortState, warmBand, REFRAIN_MODES } from './refrain/index.js'
import { fakeRepository, makeContext, makePhrase, seedFixture, T0 } from '../testing/index.js'
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
      maintains: ['reps', 'plays', 'lastPracticedAt', 'latencySampleMs'],
      exempt: {
        axes: 'no measured DSP evidence is available from passive listening',
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

  it('excludes graduated phrases from the queue', async () => {
    const plan = await new StreamEngine().plan(
      makeContext([makePhrase('grad', { graduatedAt: T0 }), makePhrase('ok')]),
    )
    expect(new Set(plan.items.map((i) => i.phraseId))).toEqual(new Set(['ok']))
  })

  it('orders difficult before easy at equal play counts', async () => {
    const ctx = makeContext([
      makePhrase('easy', { difficulty: 'easy', plays: 5 }),
      makePhrase('hard', { difficulty: 'hard', plays: 5 }),
    ])
    const plan = await new StreamEngine().plan(ctx)
    expect(plan.items[0]!.phraseId).toBe('hard')
  })

  it('preserves canonical ordering instead of calculating its own rank or tie-break', async () => {
    const phrases = [makePhrase('a'), makePhrase('z')]
    const ctx = makeContext(phrases)
    const ordering = vi
      .spyOn(ctx.core, 'orderStream')
      .mockReturnValue([userPhraseId('z'), userPhraseId('a')])
    const rank = vi.spyOn(ctx.core, 'streamRank').mockImplementation(() => {
      throw new Error('Engine must use canonical ordering')
    })
    const plan = await new StreamEngine().plan(ctx)
    expect([...new Set(plan.items.map((item) => item.phraseId))]).toEqual(['z', 'a'])
    expect(ordering).toHaveBeenCalledWith(phrases, T0)
    expect(rank).not.toHaveBeenCalled()
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
    expect(delta.axes).toBeUndefined()
    expect(delta.srs).toBeUndefined()
    expect(delta.review).toBeUndefined()
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
    makeSuccessAttempt: (itemId) => success(itemId, { transcript: 'recognized phrase' }),
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
      ],
      exempt: {
        axes: 'manual practice and recognition do not provide measured DSP axis scores',
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

  it('uses canonical sizing, modes, tempo and automaticity for planning and recording', async () => {
    const engine = new RefrainEngine()
    const ctx = makeContext([makePhrase('one'), makePhrase('two')], {
      settings: { dailyMinutes: 10, waveTimes: [], repTarget: 1 },
    })
    const setSize = vi.spyOn(ctx.core, 'refrainSetSize').mockReturnValue(1)
    const mode = vi.spyOn(ctx.core, 'modeForRep').mockReturnValue('speed')
    const rate = vi.spyOn(ctx.core, 'modelRateForMode').mockReturnValue(1.07)
    const beat = vi.spyOn(ctx.core, 'beatMsForMode').mockReturnValue(531)
    const auto = vi.spyOn(ctx.core, 'automaticity').mockReturnValueOnce(43).mockReturnValue(87)
    const plan = await engine.plan(ctx)
    expect(plan.items).toHaveLength(1)
    expect(plan.items[0]).toMatchObject({
      mode: 'speed',
      audio: { rate: 1.07 },
      meta: { beatMs: 531, automaticity: 43, warmBand: 'warm' },
    })
    expect(setSize).toHaveBeenCalledWith(10)
    expect(mode).toHaveBeenCalledWith(0)
    expect(rate).toHaveBeenCalledWith('speed')
    expect(beat).toHaveBeenCalledWith('speed')
    const delta = await engine.record(
      { sessionId: 's', plan, cursor: 0 },
      success(plan.items[0]!.itemId),
    )
    expect(delta.automaticity).toBe(87)
    expect(auto).toHaveBeenNthCalledWith(1, 0, 1)
    expect(auto).toHaveBeenNthCalledWith(2, 1, 1)
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

  it('keeps persisted daily membership and order even when later priorities change', async () => {
    const ctx = makeContext(
      [makePhrase('new-hard', { difficulty: 'hard' }), makePhrase('first'), makePhrase('second')],
      {
        refrainSet: [userPhraseId('second'), userPhraseId('first')],
      },
    )
    const plan = await new RefrainEngine().plan(ctx)
    expect([...new Set(plan.items.map((item) => item.phraseId))]).toEqual(['second', 'first'])
    expect((await new RefrainEngine().plan({ ...ctx, refrainSet: [] })).items).toEqual([])
  })

  it('writes FSRS state even though the screen shows no interval (rule 5)', async () => {
    const engine = new RefrainEngine()
    const plan = await engine.plan(makeContext([makePhrase('one')]))
    const delta = await engine.record({ sessionId: 's', plan, cursor: 0 }, success('one#0'))
    expect(delta.srs).toBeDefined()
    expect(delta.srs!.due).toBeGreaterThan(T0)
    expect(delta.review).toEqual({ grade: 3, at: T0, algorithm: 'test-fsrs' })
  })

  it('uses the latest provided context and canonical grade to record the review', async () => {
    const engine = new RefrainEngine()
    const planning = makeContext([makePhrase('one')])
    const plan = await engine.plan(planning)
    const updated = makePhrase('one', { reps: 18 })
    const current = makeContext([updated])
    const grade = vi.spyOn(current.core, 'reviewGrade').mockReturnValue(4)
    const review = vi.spyOn(current.core, 'fsrsReview')
    const attempt = success('one#0', { confidence: 'instant' })
    const delta = await engine.record({ sessionId: 's', plan, cursor: 0 }, attempt, current)
    expect(grade).toHaveBeenCalledWith(attempt)
    expect(review).toHaveBeenCalledWith(updated, 4, T0, 'instant')
    expect(delta.review).toEqual({ grade: 4, at: T0, algorithm: 'test-fsrs' })
  })

  it('reads the constructor context when a resumed plan has no planning context', async () => {
    const ctx = makeContext([makePhrase('one')])
    const plan = await new RefrainEngine().plan(ctx)
    const engine = new RefrainEngine(() => ctx)
    const delta = await engine.record({ sessionId: 's', plan, cursor: 0 }, success('one#0'))
    expect(delta.review).toEqual({ grade: 3, at: T0, algorithm: 'test-fsrs' })
  })

  it('passes confidence only when no explicit self-grade supersedes it', async () => {
    const engine = new RefrainEngine()
    const ctx = makeContext([makePhrase('one')])
    const review = vi.spyOn(ctx.core, 'fsrsReview')
    const plan = await engine.plan(ctx)
    const delta = await engine.record(
      { sessionId: 's', plan, cursor: 0 },
      success('one#0', { selfGrade: 'hard', confidence: 'instant' }),
    )
    expect(review).toHaveBeenCalledWith(
      await ctx.phrases.byId(userPhraseId('one')),
      2,
      T0,
      undefined,
    )
    expect(delta.review?.grade).toBe(2)
  })

  it('keeps skipped attempts and missing schedule writes out of review evidence', async () => {
    const engine = new RefrainEngine()
    const ctx = makeContext([makePhrase('one')])
    const review = vi.spyOn(ctx.core, 'fsrsReview')
    const plan = await engine.plan(ctx)
    const session = { sessionId: 's', plan, cursor: 0 }
    const skipped = await engine.record(session, success('one#0', { outcome: 'skipped' }))
    expect(skipped.srs).toBeUndefined()
    expect(skipped.review).toBeUndefined()
    expect(review).not.toHaveBeenCalled()
    review.mockReturnValue(undefined)
    const missing = await engine.record(session, success('one#0'))
    expect(missing.srs).toBeUndefined()
    expect(missing.review).toBeUndefined()
  })

  it('rejects a canonical schedule that lacks an algorithm identifier', async () => {
    const engine = new RefrainEngine()
    const ctx = makeContext([makePhrase('one')])
    vi.spyOn(ctx.core, 'fsrsReview').mockReturnValue({ stability: 3, difficulty: 5, due: T0 + 1 })
    const plan = await engine.plan(ctx)
    await expect(
      engine.record({ sessionId: 's', plan, cursor: 0 }, success('one#0')),
    ).rejects.toThrow('identify its algorithm')
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
    expect(
      (await engine.record(session, success('one#3', { transcript: 'recognized phrase' }))).rung,
    ).toBe(LadderRung.Bent)
    expect((await engine.record(session, success('one#4', { selfGrade: 'good' }))).rung).toBe(
      LadderRung.Bent,
    )
  })

  it('earns Pressure-tested for a fast Speed rep', async () => {
    const engine = new RefrainEngine()
    const plan = await engine.plan(makeContext([makePhrase('one')]))
    const delta = await engine.record(
      { sessionId: 's', plan, cursor: 0 },
      success('one#2', { latencyMs: 620, transcript: 'recognized phrase' }),
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

  it('manual taps never claim production depth or synthetic DSP scores', async () => {
    const engine = new RefrainEngine()
    const plan = await engine.plan(makeContext([makePhrase('one')]))
    const session = { sessionId: 's', plan, cursor: 0 }
    for (const rep of [0, 2, 3, 4, 5]) {
      const delta = await engine.record(session, success(`one#${rep}`, { latencyMs: 620 }))
      expect(delta.rung).toBeUndefined()
      expect(delta.axes).toBeUndefined()
    }
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

describe('fakeRepository eligibility', () => {
  const due = {
    stability: 1,
    difficulty: 5,
    due: T0,
    lastReview: T0,
    lapses: 0,
    state: 'review' as const,
  }

  it('uses isActive and isDue rather than a second copy of the rule', async () => {
    const repo = fakeRepository([
      makePhrase('grad', { graduatedAt: T0 }),
      { ...makePhrase('grad-due', { graduatedAt: T0 }), srs: due },
      { ...makePhrase('learned', { learned: true }), srs: due },
      { ...makePhrase('due'), srs: due },
      makePhrase('fresh'),
    ])
    expect((await repo.active()).map((p) => p.id)).toEqual(['due', 'fresh'])
    expect((await repo.due(T0)).map((p) => p.id)).toEqual(['grad-due', 'due'])
  })
})

describe('refrain mechanics', () => {
  it('reaches 100% automaticity at the target', () => {
    const core = fakeCore()
    expect(core.automaticity(0, 6)).toBe(0)
    expect(core.automaticity(3, 6)).toBe(50)
    expect(core.automaticity(6, 6)).toBe(100)
    expect(core.automaticity(12, 6)).toBe(100)
    expect(core.automaticity(3, 0)).toBe(0)
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
    const core = fakeCore()
    expect(core.modeForRep(5)).toBe('cold')
    expect(core.modeForRep(99)).toBe('cold')
  })

  it('speeds up the beat only in Speed mode', () => {
    const core = fakeCore()
    expect(core.beatMsForMode('speed')).toBe(340)
    expect(core.beatMsForMode('echo')).toBe(720)
  })

  it('plays Speed faster than Echo', () => {
    const core = fakeCore()
    expect(core.modelRateForMode('speed')!).toBeGreaterThan(core.modelRateForMode('echo')!)
    expect(core.modelRateForMode('cold')).toBeNull()
  })

  it('sizes the set from daily minutes', () => {
    const core = fakeCore()
    expect(core.refrainSetSize(5)).toBe(3)
    expect(core.refrainSetSize(10)).toBe(5)
    expect(core.refrainSetSize(20)).toBe(8)
  })

  it('refuses undocumented core numbers instead of computing them', () => {
    const core = fakeCore()
    expect(() => core.automaticity(7, 6)).toThrow(/no automaticity fixture/)
    expect(() => core.refrainSetSize(6)).toThrow(/no refrainSetSize fixture/)
    expect(() => core.modeForRep(6)).toThrow(/no modeForRep fixture/)
  })
})
