/**
 * `applyDeltaToPhrase` — the only place a progress field is written.
 *
 * The interesting cases are the ones where getting increment-vs-absolute wrong is
 * silent: `reps` walking backwards, `lockInDays` counting the same day twice, a rung
 * falling.
 */

import { describe, expect, it } from 'vitest'
import {
  LadderRung,
  LOCK_IN_DAYS_TO_GRADUATE,
  RefrainEngine,
  userPhraseId,
  type ProgressDelta,
  type FsrsState,
} from '@loro/core'
import { makeContext, makePhrase } from '@loro/core/testing'
import { applyDeltaToPhrase, DELTA_RULES } from './delta'

/** `fakeClock`'s default local day, so the fixtures and the store agree. */
const DAY = '2026-07-28'
const AT = 1_785_231_660_000
const CANONICAL_SRS: FsrsState = {
  stability: 2,
  difficulty: 4,
  due: AT + 86_400_000,
  lastReview: AT,
  lapses: 3,
  state: 'review',
  algorithm: 'fsrs-6-default-c8ca282-loro-v1',
}

/**
 * Every field a `ProgressDelta` can carry, present.
 *
 * `Required<ProgressDelta>` is the point: a signal added to the contract will not compile
 * here until it is listed, and the test below then fails until `DELTA_RULES` classifies it.
 * Two locks, and neither can be opened by deleting the other. Same trick as
 * `packages/core/src/sync/fieldPolicy.test.ts` — a field nobody classified is a signal the
 * learner earned and the store threw away.
 */
const EVERY_SIGNAL: Required<ProgressDelta> = {
  phraseId: userPhraseId('0197f2a0-0000-7000-8000-000000000001'),
  reps: 1,
  plays: 1,
  lastPracticedAt: AT,
  latencySampleMs: 640,
  srs: CANONICAL_SRS,
  repsToday: 6,
  automaticity: 100,
  lockedInToday: true,
  rung: LadderRung.Transferred,
  stumbles: 1,
  staleReset: true,
  cueLevel: 2,
  axes: { perception: 3, recall: 4, production: 5 },
  difficulty: 'easy',
  learned: true,
  review: { grade: 3, at: AT, algorithm: CANONICAL_SRS.algorithm! },
}

describe('the delta classification', () => {
  it('classifies every signal a ProgressDelta can carry', () => {
    const declared = new Set(Object.keys(DELTA_RULES))
    const missing = Object.keys(EVERY_SIGNAL)
      // Identity and review history metadata are not phrase progress signals.
      .filter((k) => k !== 'phraseId' && k !== 'review')
      .filter((k) => !declared.has(k))

    expect(
      missing,
      'these ProgressDelta fields reach applyDeltaToPhrase with no classification — see DELTA_RULES and packages/core/src/engines/types.ts',
    ).toEqual([])
  })

  it('classifies nothing that is not a signal any more', () => {
    // The other direction: a field REMOVED from the contract must not leave a rule behind
    // writing a column from a value that can no longer arrive.
    const carried = new Set(Object.keys(EVERY_SIGNAL))
    expect(Object.keys(DELTA_RULES).filter((k) => !carried.has(k))).toEqual([])
  })

  it('makes every unstored signal say why', () => {
    // "Dropped on purpose" and "forgotten" must not look alike. This is what stops the
    // unstored kind becoming a place to park a field nobody wanted to think about.
    for (const [field, rule] of Object.entries(DELTA_RULES)) {
      if (rule.kind !== 'unstored') continue
      expect(rule.why.length, `${field} is unstored but gives no reason`).toBeGreaterThan(20)
    }
  })
})

describe('applyDeltaToPhrase', () => {
  it('adds the increments and replaces the absolutes', () => {
    const before = makePhrase('p', { reps: 5, plays: 2, stumbles: 1 })
    const after = applyDeltaToPhrase(
      before,
      {
        phraseId: before.id,
        reps: 1,
        plays: 1,
        stumbles: 1,
        repsToday: 3,
        automaticity: 50,
        lastPracticedAt: AT,
        difficulty: 'hard',
      },
      DAY,
    )

    expect(after.reps).toBe(6) // increment
    expect(after.plays).toBe(3) // increment
    expect(after.stumbles).toBe(2) // increment
    expect(after.repsToday).toBe(3) // absolute
    expect(after.repsTodayDay).toBe(DAY)
    expect(after.automaticity).toBe(50) // absolute
    expect(after.difficulty).toBe('hard') // absolute
    expect(after.lastPracticedAt).toBe(AT)
  })

  it('leaves every field alone for an empty delta', () => {
    const before = makePhrase('p', { reps: 5, repsToday: 4, repsTodayDay: DAY, automaticity: 67 })
    expect(applyDeltaToPhrase(before, { phraseId: before.id }, DAY)).toEqual(before)
  })

  it('does not stamp today onto a counter the engine did not report', () => {
    // A delta with no repsToday (a stream play, say) must not touch the day counter, or
    // yesterday's 4 reps would be re-dated to today and inflate the warming card.
    const before = makePhrase('p', { repsToday: 4, repsTodayDay: '2026-07-27' })
    const after = applyDeltaToPhrase(before, { phraseId: before.id, plays: 1 }, DAY)
    expect(after.repsToday).toBe(4)
    expect(after.repsTodayDay).toBe('2026-07-27')
  })

  it('clamps a stored axis even when the delta carries no axes', () => {
    // The axes fold is UNCONDITIONAL, deliberately: `bumpAxis` runs with `undefined` on
    // every delta, so a row holding an out-of-range percentage is repaired by the next rep
    // instead of carrying it forever. The "leaves every field alone for an empty delta"
    // test above cannot see this — its fixture axes are already 0 — so a reducer that
    // skipped absent keys would look correct and silently drop the clamp.
    // Built by spreading, not by an override: `makePhrase` pins the three axes to 0
    // (`packages/core/src/testing/index.ts:82-84`) and `PhraseOverrides` cannot reach them,
    // which is the very reason no existing test could have caught this.
    const before = { ...makePhrase('p'), axPerception: 150, axRecall: -20 }
    const after = applyDeltaToPhrase(before, { phraseId: before.id, reps: 1 }, DAY)
    expect(after.axPerception).toBe(100)
    expect(after.axRecall).toBe(0)
  })

  it('never lowers a ladder rung', () => {
    const before = makePhrase('p', { rung: LadderRung.PressureTested })
    const after = applyDeltaToPhrase(before, { phraseId: before.id, rung: LadderRung.Bent }, DAY)
    expect(after.rung).toBe(LadderRung.PressureTested)
  })

  it('never lowers a cue level', () => {
    const before = makePhrase('p', { cueLevel: 3 })
    expect(applyDeltaToPhrase(before, { phraseId: before.id, cueLevel: 1 }, DAY).cueLevel).toBe(3)
  })

  it('counts a lock-in once per day, however many deltas arrive', () => {
    let phrase = makePhrase('p', { repsToday: 5, repsTodayDay: DAY, automaticity: 83 })
    const lockIn: ProgressDelta = {
      phraseId: phrase.id,
      reps: 1,
      repsToday: 6,
      automaticity: 100,
      lockedInToday: true,
      lastPracticedAt: AT,
    }

    phrase = applyDeltaToPhrase(phrase, lockIn, DAY)
    expect(phrase.lockInDays).toBe(1)

    // A seventh rep on the same day still reports lockedInToday. It must not count again.
    phrase = applyDeltaToPhrase(phrase, lockIn, DAY)
    expect(phrase.lockInDays).toBe(1)
  })

  it('counts the next day separately, once reps reset', () => {
    let phrase = makePhrase('p', { repsToday: 5, repsTodayDay: DAY, automaticity: 83 })
    phrase = applyDeltaToPhrase(
      phrase,
      { phraseId: phrase.id, repsToday: 6, automaticity: 100, lockedInToday: true },
      DAY,
    )
    expect(phrase.lockInDays).toBe(1)

    // Tomorrow: the first rep writes a fresh, low automaticity...
    phrase = applyDeltaToPhrase(
      phrase,
      { phraseId: phrase.id, repsToday: 1, automaticity: 17 },
      '2026-07-29',
    )
    // ...and reaching 100 again is a second distinct day.
    phrase = applyDeltaToPhrase(
      phrase,
      { phraseId: phrase.id, repsToday: 6, automaticity: 100, lockedInToday: true },
      '2026-07-29',
    )
    expect(phrase.lockInDays).toBe(2)
  })

  it('graduates a phrase out of rotation on the fourth lock-in day', () => {
    let phrase = makePhrase('p', { lockInDays: LOCK_IN_DAYS_TO_GRADUATE - 1, automaticity: 0 })
    expect(phrase.graduatedAt).toBeNull()

    phrase = applyDeltaToPhrase(
      phrase,
      {
        phraseId: phrase.id,
        repsToday: 6,
        automaticity: 100,
        lockedInToday: true,
        lastPracticedAt: AT,
      },
      DAY,
    )

    expect(phrase.lockInDays).toBe(LOCK_IN_DAYS_TO_GRADUATE)
    expect(phrase.graduatedAt).toBe(AT)
  })

  it('clamps the prosody axes to 0…100', () => {
    const before = makePhrase('p')
    const bumped = applyDeltaToPhrase(
      before,
      { phraseId: before.id, axes: { production: 2, recall: 6 } },
      DAY,
    )
    expect(bumped.axProduction).toBe(2)
    expect(bumped.axRecall).toBe(6)

    const maxed = applyDeltaToPhrase(
      { ...before, axProduction: 99 },
      { phraseId: before.id, axes: { production: 50 } },
      DAY,
    )
    expect(maxed.axProduction).toBe(100)
  })

  it('replaces the complete scheduler group without deriving fields from stale state', () => {
    const before = {
      ...makePhrase('p'),
      srs: {
        ...CANONICAL_SRS,
        lapses: 8,
        state: 'relearning' as const,
        lastReview: AT - 1000,
        algorithm: 'legacy',
      },
    }
    const after = applyDeltaToPhrase(
      before,
      { phraseId: before.id, srs: CANONICAL_SRS, lastPracticedAt: AT + 500 },
      DAY,
    )
    expect(after.srs).toEqual(CANONICAL_SRS)
    // Scheduler review time is authoritative even if another practice timestamp differs.
    expect(after.srs?.lastReview).toBe(AT)
    expect(after.srs?.lapses).toBe(3)
    expect(after.srs?.state).toBe('review')
    expect(after.srs?.algorithm).toBe(CANONICAL_SRS.algorithm)
    expect(after.srs).not.toBe(CANONICAL_SRS)

    const relapsedSrs: FsrsState = {
      ...CANONICAL_SRS,
      stability: 1,
      difficulty: 6,
      due: AT + 600_000,
      lastReview: AT + 1000,
      lapses: 4,
      state: 'relearning',
    }
    const relapsed = applyDeltaToPhrase(after, { phraseId: before.id, srs: relapsedSrs }, DAY)
    expect(relapsed.srs).toEqual(relapsedSrs)
    expect(applyDeltaToPhrase(relapsed, { phraseId: before.id, plays: 1 }, DAY).srs).toEqual(
      relapsedSrs,
    )
  })

  it('lands every signal a delta can carry, in one delta', () => {
    // The coverage test for `DELTA_RULES`. One delta with every field of `ProgressDelta`
    // set, so a classification dropped from the table fails here rather than costing a
    // learner the signal — which is exactly what happened while the classification was a
    // hand-written literal: most of the engine's signals never arrived.
    const before = makePhrase('p', { reps: 1, plays: 1, stumbles: 1, cueLevel: 1 })
    const after = applyDeltaToPhrase(
      before,
      {
        phraseId: before.id,
        reps: 1,
        plays: 1,
        stumbles: 1,
        axes: { perception: 3, recall: 4, production: 5 },
        lastPracticedAt: AT,
        difficulty: 'easy',
        learned: true,
        repsToday: 6,
        automaticity: 100,
        lockedInToday: true,
        rung: LadderRung.Transferred,
        cueLevel: 2,
        srs: CANONICAL_SRS,
        // The two the store deliberately does not keep: there is no column for either
        // yet, and inventing one would be a fabricated number on a learner's screen.
        latencySampleMs: 640,
        staleReset: true,
      },
      DAY,
    )

    expect(after.reps).toBe(2)
    expect(after.plays).toBe(2)
    expect(after.stumbles).toBe(2)
    expect(after.axPerception).toBe(3)
    expect(after.axRecall).toBe(4)
    expect(after.axProduction).toBe(5)
    expect(after.lastPracticedAt).toBe(AT)
    expect(after.difficulty).toBe('easy')
    expect(after.learned).toBe(true)
    expect(after.repsToday).toBe(6)
    expect(after.repsTodayDay).toBe(DAY)
    expect(after.automaticity).toBe(100)
    expect(after.rung).toBe(LadderRung.Transferred)
    expect(after.cueLevel).toBe(2)
    expect(after.srs?.due).toBe(AT + 86_400_000)
    expect(after.lockInDays).toBe(1)

    // …and nothing else moved: `addedAt`, `id`, `note`, `tags`, `loved` are the learner's.
    expect(after.addedAt).toBe(before.addedAt)
    expect(after.tags).toBe(before.tags)
    expect(after.note).toBe(before.note)
    expect(after.loved).toBe(before.loved)
  })

  it('touches only the phrase the delta names', () => {
    const other = makePhrase('other', { reps: 1 })
    const after = applyDeltaToPhrase(other, { phraseId: other.id, reps: 1 }, DAY)
    expect(after.id).toBe(other.id)
    expect(after.reps).toBe(2)
  })
})

describe('a real engine delta, round-tripped', () => {
  it('lands every signal the RefrainEngine reports', async () => {
    const engine = new RefrainEngine()
    const phrase = makePhrase('one')
    const ctx = makeContext([phrase])
    const plan = await engine.plan(ctx)
    const first = plan.items[0]
    expect(first).toBeDefined()
    if (first === undefined) return

    const delta = await engine.record(
      { sessionId: 's', plan, cursor: 0 },
      {
        itemId: first.itemId,
        outcome: 'success',
        latencyMs: 720,
        hintsUsed: 0,
        at: AT,
      },
      ctx,
    )

    const after = applyDeltaToPhrase(phrase, delta, DAY)

    // Rule 5: the engine reports signals this screen never shows, and they must land.
    expect(after.reps).toBe(1)
    expect(after.repsToday).toBe(1)
    expect(after.automaticity).toBe(17)
    expect(after.repsTodayDay).toBe(DAY)
    expect(after.lastPracticedAt).toBe(AT)
    expect(after.srs).toEqual(delta.srs)
    expect(after.srs?.algorithm).toBe('test-fixture')
    expect(after.srs?.due).toBeGreaterThan(AT)
    expect(after.axProduction).toBe(phrase.axProduction)
    expect(after.axRecall).toBe(phrase.axRecall)
  })

  it('resumes a phrase already part-way through today rather than restarting it', async () => {
    // The bug this pins: the plan used to start every phrase at rep 0, so re-entering the
    // Refrain reported repsToday: 1 and walked a stored 4 backwards.
    const engine = new RefrainEngine()
    const phrase = makePhrase('one', { reps: 4, repsToday: 4, repsTodayDay: DAY })
    const ctx = makeContext([phrase])
    const plan = await engine.plan(ctx)

    expect(plan.items).toHaveLength(2) // two reps left of six
    expect(plan.items.map((i) => i.mode)).toEqual(['call', 'cold'])

    const first = plan.items[0]
    if (first === undefined) return
    const delta = await engine.record(
      { sessionId: 's', plan, cursor: 0 },
      { itemId: first.itemId, outcome: 'success', latencyMs: 500, hintsUsed: 0, at: AT },
      ctx,
    )
    const after = applyDeltaToPhrase(phrase, delta, DAY)

    expect(after.repsToday).toBe(5)
    expect(after.automaticity).toBe(83)
    expect(after.reps).toBe(5)
  })
})
