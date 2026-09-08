import { describe, expect, it, vi } from 'vitest'
import { SpeakEngine } from './speak.js'
import { makeContext, makePhrase, T0 } from '../testing/index.js'
import type { Attempt } from './types.js'
import { runConformanceSuite } from './conformance.js'

const conformingEngine = new SpeakEngine()
runConformanceSuite(
  {
    id: 'speak',
    availability: (ctx) => conformingEngine.availability(ctx),
    plan: (ctx) => conformingEngine.plan(ctx),
    next: (session) => conformingEngine.next(session),
    record: (session, attempt, ctx) => conformingEngine.record(session, attempt, ctx),
    summarize: (session) => conformingEngine.summarize(session),
  },
  {
    makeContext: () => makeContext(),
    makeEmptyContext: () => makeContext([]),
    makeSuccessAttempt: (itemId) => ({
      itemId,
      outcome: 'success',
      hintsUsed: 0,
      transcript: 'recognized phrase',
      latencyMs: null,
      at: T0,
    }),
    signals: {
      maintains: ['reps', 'lastPracticedAt', 'latencySampleMs', 'srs', 'rung', 'staleReset'],
      exempt: {
        plays: 'Playback completion is recorded by the native playback owner, not recognition.',
        repsToday: 'Speak has no Refrain daily set or rep target.',
        automaticity: 'Speak does not infer automaticity from transcript matching.',
        lockedInToday: 'Lock-in belongs to completion of a Refrain set.',
        stumbles: 'A recognition failure cannot distinguish learner difficulty from ASR failure.',
        cueLevel: 'No DSP-derived cue-level evidence is available.',
        axes: 'No validated axis score is produced by transcript matching.',
        difficulty: 'Difficulty is the learner declaration.',
        learned: 'Learned is the learner declaration.',
      },
    },
  },
)

describe('Speak production evidence', () => {
  it('reveal mode and skipped phrases never claim a rep, latency, or schedule', async () => {
    const engine = new SpeakEngine()
    const ctx = makeContext([makePhrase('p')])
    const plan = await engine.plan(ctx)
    const session = { sessionId: 's', plan, cursor: 0 }
    for (const [outcome, hintsUsed, transcript] of [
      ['success', 1, 'Hola'],
      ['skipped', 0, ''],
      ['success', 0, ''],
    ] as const) {
      expect(
        await engine.record(
          session,
          { itemId: 'p#speak', outcome, hintsUsed, transcript, latencyMs: null, at: T0 },
          ctx,
        ),
      ).toEqual({ phraseId: 'p' })
    }
  })
  it('uses current canonical scheduling only for an unassisted recognized phrase', async () => {
    const engine = new SpeakEngine()
    const ctx = makeContext([makePhrase('p')])
    const expected = { stability: 1.4, difficulty: 3.2, due: T0 + 90_000, algorithm: 'test-fsrs' }
    const review = vi.spyOn(ctx.core, 'fsrsReview').mockReturnValue(expected)
    const plan = await engine.plan(ctx)
    const attempt: Attempt = {
      itemId: 'p#speak',
      outcome: 'success',
      hintsUsed: 0,
      transcript: 'Hola',
      latencyMs: null,
      at: T0,
    }
    const delta = await engine.record({ sessionId: 's', plan, cursor: 0 }, attempt, ctx)
    expect(delta).toMatchObject({
      reps: 1,
      srs: expected,
      latencySampleMs: null,
      lastPracticedAt: T0,
      review: { grade: 3, at: T0, algorithm: 'test-fsrs' },
    })
    expect(review).toHaveBeenCalledWith(
      await ctx.phrases.byId(plan.items[0]!.phraseId),
      3,
      T0,
      undefined,
    )
    await expect(engine.record({ sessionId: 's', plan, cursor: 0 }, attempt)).rejects.toThrow(
      'canonical engine context',
    )
  })

  it('uses the canonical attempt grade and attaches its review provenance', async () => {
    const engine = new SpeakEngine()
    const ctx = makeContext([makePhrase('p')])
    const grade = vi.spyOn(ctx.core, 'reviewGrade').mockReturnValue(4)
    const review = vi.spyOn(ctx.core, 'fsrsReview')
    const plan = await engine.plan(ctx)
    const attempt: Attempt = {
      itemId: 'p#speak',
      outcome: 'success',
      hintsUsed: 0,
      transcript: 'Hola',
      confidence: 'instant',
      latencyMs: null,
      at: T0,
    }
    const delta = await engine.record({ sessionId: 's', plan, cursor: 0 }, attempt, ctx)
    expect(grade).toHaveBeenCalledWith(attempt)
    expect(review).toHaveBeenCalledWith(
      await ctx.phrases.byId(plan.items[0]!.phraseId),
      4,
      T0,
      'instant',
    )
    expect(delta.review).toEqual({ grade: 4, at: T0, algorithm: 'test-fsrs' })
  })

  it('does not pass confidence when the learner explicitly self-grades', async () => {
    const engine = new SpeakEngine()
    const ctx = makeContext([makePhrase('p')])
    const review = vi.spyOn(ctx.core, 'fsrsReview')
    const plan = await engine.plan(ctx)
    const delta = await engine.record(
      { sessionId: 's', plan, cursor: 0 },
      {
        itemId: 'p#speak',
        outcome: 'success',
        hintsUsed: 0,
        transcript: 'Hola',
        selfGrade: 'hard',
        confidence: 'instant',
        latencyMs: null,
        at: T0,
      },
      ctx,
    )
    expect(review).toHaveBeenCalledWith(
      await ctx.phrases.byId(plan.items[0]!.phraseId),
      2,
      T0,
      undefined,
    )
    expect(delta.review?.grade).toBe(2)
  })

  it('never creates review evidence without an identified canonical schedule', async () => {
    const engine = new SpeakEngine()
    const ctx = makeContext([makePhrase('p')])
    const review = vi.spyOn(ctx.core, 'fsrsReview').mockReturnValue(undefined)
    const plan = await engine.plan(ctx)
    const session = { sessionId: 's', plan, cursor: 0 }
    const attempt: Attempt = {
      itemId: 'p#speak',
      outcome: 'success',
      hintsUsed: 0,
      transcript: 'Hola',
      latencyMs: null,
      at: T0,
    }
    const delta = await engine.record(session, attempt, ctx)
    expect(delta.srs).toBeUndefined()
    expect(delta.review).toBeUndefined()
    review.mockReturnValue({ stability: 3, difficulty: 5, due: T0 + 1 })
    await expect(engine.record(session, attempt, ctx)).rejects.toThrow('identify its algorithm')
  })
})
