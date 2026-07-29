/**
 * `applyDeltaToPhrase` — the only place a progress field is written.
 *
 * The interesting cases are the ones where getting increment-vs-absolute wrong is
 * silent: `reps` walking backwards, `lockInDays` counting the same day twice, a rung
 * falling.
 */

import { describe, expect, it } from 'vitest'
import { LadderRung, LOCK_IN_DAYS_TO_GRADUATE, RefrainEngine, type ProgressDelta } from '@loro/core'
import { makeContext, makePhrase } from '@loro/core/testing'
import { applyDeltaToPhrase } from './state'

/** `fakeClock`'s default local day, so the fixtures and the store agree. */
const DAY = '2026-07-28'
const AT = 1_785_231_660_000

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

  it('merges FSRS as a group and keeps the fields no engine reports', () => {
    const before = makePhrase('p')
    const after = applyDeltaToPhrase(
      before,
      {
        phraseId: before.id,
        srs: { stability: 3, difficulty: 5, due: AT + 3 * 86_400_000 },
        lastPracticedAt: AT,
      },
      DAY,
    )
    expect(after.srs).toEqual({
      stability: 3,
      difficulty: 5,
      due: AT + 3 * 86_400_000,
      lastReview: AT,
      lapses: 0,
      state: 'learning',
    })

    // A second review keeps the accumulated lapses rather than resetting them.
    const relapsed = applyDeltaToPhrase(
      { ...after, srs: { ...after.srs!, lapses: 2, state: 'relearning' } },
      { phraseId: before.id, srs: { stability: 1, difficulty: 6, due: AT }, lastPracticedAt: AT },
      DAY,
    )
    expect(relapsed.srs?.lapses).toBe(2)
    expect(relapsed.srs?.state).toBe('relearning')
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
    )

    const after = applyDeltaToPhrase(phrase, delta, DAY)

    // Rule 5: the engine reports signals this screen never shows, and they must land.
    expect(after.reps).toBe(1)
    expect(after.repsToday).toBe(1)
    expect(after.automaticity).toBe(17)
    expect(after.repsTodayDay).toBe(DAY)
    expect(after.lastPracticedAt).toBe(AT)
    expect(after.srs).not.toBeNull()
    expect(after.srs?.due).toBeGreaterThan(AT)
    expect(after.axProduction).toBeGreaterThan(0)
    expect(after.axRecall).toBeGreaterThan(0)
  })

  it('resumes a phrase already part-way through today rather than restarting it', async () => {
    // The bug this pins: the plan used to start every phrase at rep 0, so re-entering the
    // Refrain reported repsToday: 1 and walked a stored 4 backwards.
    const engine = new RefrainEngine()
    const phrase = makePhrase('one', { reps: 4, repsToday: 4, repsTodayDay: DAY })
    const plan = await engine.plan(makeContext([phrase]))

    expect(plan.items).toHaveLength(2) // two reps left of six
    expect(plan.items.map((i) => i.mode)).toEqual(['call', 'cold'])

    const first = plan.items[0]
    if (first === undefined) return
    const delta = await engine.record(
      { sessionId: 's', plan, cursor: 0 },
      { itemId: first.itemId, outcome: 'success', latencyMs: 500, hintsUsed: 0, at: AT },
    )
    const after = applyDeltaToPhrase(phrase, delta, DAY)

    expect(after.repsToday).toBe(5)
    expect(after.automaticity).toBe(83)
    expect(after.reps).toBe(5)
  })
})
