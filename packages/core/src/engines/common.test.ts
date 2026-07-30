/**
 * The shared engine plumbing — and `universalDelta`, which is how rule 5 stops being
 * something each engine has to remember.
 *
 * The conformance suite proves an engine obeys rule 5. This proves the helper it obeys it
 * WITH, so a new engine inherits the guarantee instead of re-deriving it.
 */

import { describe, expect, it } from 'vitest'
import {
  availableWhenActive,
  distinctPhrases,
  itemAtCursor,
  itemFor,
  metaNumber,
  universalDelta,
  workedItems,
} from './common.js'
import type { Attempt, PracticeItem, SessionHandle } from './types.js'
import { makeContext, makePhrase, T0 } from '../testing/index.js'
import { userPhraseId } from '../domain/ids.js'

function item(itemId: string, phraseId = 'one', meta: Record<string, unknown> = {}): PracticeItem {
  return {
    itemId,
    phraseId: userPhraseId(phraseId),
    mode: 'echo',
    prompt: { show: 'full' },
    gate: { kind: 'tap' },
    audio: null,
    meta,
  }
}

function session(items: readonly PracticeItem[], cursor = 0): SessionHandle {
  return {
    sessionId: 's',
    plan: { engineId: 'refrain', items, estimatedMs: 0, closed: true },
    cursor,
  }
}

const attempt = (itemId: string, o: Partial<Attempt> = {}): Attempt => ({
  itemId,
  outcome: 'success',
  latencyMs: 1200,
  hintsUsed: 0,
  at: T0,
  ...o,
})

describe('universalDelta', () => {
  it('always carries the signals no engine may leave out', () => {
    const delta = universalDelta(item('one#0'), attempt('one#0'), { reps: 1, latencyMs: 940 })

    expect(delta.phraseId).toBe('one')
    expect(delta.reps).toBe(1)
    expect(delta.lastPracticedAt).toBe(T0)
    expect(delta.latencySampleMs).toBe(940)
  })

  it('preserves an unmeasured latency as null rather than dropping the key', () => {
    // Rule 4: `null` means "onset was not detected". A missing key would read as
    // "unchanged" to the store, and the last real measurement would stand forever.
    const delta = universalDelta(item('one#0'), attempt('one#0'), { reps: 0, latencyMs: null })
    expect('latencySampleMs' in delta).toBe(true)
    expect(delta.latencySampleMs).toBeNull()
  })

  it('omits plays entirely for an engine that has no notion of one', () => {
    // `exactOptionalPropertyTypes`: an `undefined`-valued key is not the same as no key.
    expect(
      'plays' in universalDelta(item('one#0'), attempt('one#0'), { reps: 1, latencyMs: 0 }),
    ).toBe(false)
  })

  it('carries plays when the engine supplies one', () => {
    const delta = universalDelta(item('one#0'), attempt('one#0'), {
      reps: 1,
      plays: 1,
      latencyMs: null,
    })
    expect(delta.plays).toBe(1)
  })

  it('records a zero rep count rather than omitting it on a failed attempt', () => {
    const delta = universalDelta(item('one#0'), attempt('one#0', { outcome: 'failed' }), {
      reps: 0,
      latencyMs: null,
    })
    expect(delta.reps).toBe(0)
    expect(delta.lastPracticedAt, 'a failed attempt is still practice').toBe(T0)
  })
})

describe('session plumbing', () => {
  it('finds the item an attempt refers to', () => {
    const items = [item('a#0'), item('a#1')]
    expect(itemFor(session(items), attempt('a#1')).itemId).toBe('a#1')
  })

  it('throws, naming the item, when an attempt is for something unplanned', () => {
    expect(() => itemFor(session([item('a#0')]), attempt('ghost'))).toThrow(/unknown item ghost/)
  })

  it('yields the item under the cursor', async () => {
    const items = [item('a#0'), item('a#1')]
    expect((await itemAtCursor(session(items, 1)))?.itemId).toBe('a#1')
  })

  it('yields null once the plan is exhausted', async () => {
    expect(await itemAtCursor(session([item('a#0')], 1))).toBeNull()
  })

  it('reads a number out of the meta bag, falling back when absent', () => {
    const withMeta = item('a#0', 'one', { repIndex: 4 })
    expect(metaNumber(withMeta, 'repIndex', 0)).toBe(4)
    expect(metaNumber(withMeta, 'repTarget', 6)).toBe(6)
  })

  it('counts only the items already worked', () => {
    const items = [item('a#0'), item('a#1'), item('a#2')]
    expect(workedItems(session(items, 2))).toHaveLength(2)
    expect(workedItems(session(items, 0))).toHaveLength(0)
  })

  it('counts distinct phrases, not items', () => {
    expect(distinctPhrases([item('a#0', 'a'), item('a#1', 'a'), item('b#0', 'b')])).toBe(2)
  })
})

describe('availableWhenActive', () => {
  it('is available when the learner has phrases in rotation', async () => {
    expect(await availableWhenActive(makeContext([makePhrase('one')]), 'nope')).toEqual({
      state: 'available',
    })
  })

  it("reports the engine's own reason when the store is empty", async () => {
    expect(await availableWhenActive(makeContext([]), 'stream-empty')).toEqual({
      state: 'unavailable',
      reason: 'stream-empty',
    })
  })
})
