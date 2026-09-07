/**
 * StreamEngine — hands-free listening. Used by every loop.
 *
 * Blueprint: Loro.dc.html:600-677, logic 2516-2632.
 * Spec: docs/product/functional-spec.md#4-adaptive-stream
 *
 * The only engine with no gate and the only one that runs in the background.
 * Live re-rating re-ranks the queue immediately, which is why `plan()` returns a
 * fresh ordering every time rather than a frozen list.
 */

import type {
  Attempt,
  Availability,
  EngineContext,
  PracticeEngine,
  PracticeItem,
  ProgressDelta,
  SessionHandle,
  SessionPlan,
  SessionSummary,
} from '../types.js'
import {
  availableWhenActive,
  distinctPhrases,
  itemAtCursor,
  itemFor,
  metaNumber,
  universalDelta,
  workedItems,
} from '../common.js'
import type { PhraseState } from '../../domain/phrase.js'

export class StreamEngine implements PracticeEngine {
  readonly id = 'stream' as const

  availability(ctx: EngineContext): Promise<Availability> {
    return availableWhenActive(ctx, 'stream-empty')
  }

  async plan(ctx: EngineContext): Promise<SessionPlan> {
    const active = await ctx.phrases.active()
    const now = ctx.clock.now()

    // rank = plays + (hard -6 | easy +4) + (loved -3) + (due -4), ascending.
    // `plays` dominates, which round-robins naturally: everything is heard before
    // anything repeats, and the offsets bias WHICH comes sooner without starving.
    const byId = new Map(active.map((phrase) => [phrase.id, phrase]))
    const ordered = ctx.core.orderStream(active, now).flatMap((id) => {
      const phrase = byId.get(id)
      return phrase === undefined ? [] : [phrase]
    })

    // One item per repetition, so the UI's repeat pips map 1:1 onto items.
    const items: PracticeItem[] = ordered.flatMap((phrase) => {
      const target = ctx.core.repeatTarget(phrase.difficulty)
      return Array.from({ length: target }, (_, rep) => ({
        itemId: `${phrase.id}#${rep}`,
        phraseId: phrase.id,
        mode: 'listen',
        prompt: { show: 'full' } as const,
        gate: { kind: 'listen' } as const,
        audio: { rate: 1.0, source: 'catalog' } as const,
        meta: { repIndex: rep, repeatTarget: target },
      }))
    })

    return {
      engineId: this.id,
      items,
      // ~4s per repetition plus the deliberate gap for shadowing.
      estimatedMs: items.length * 4_350,
      // The stream plays until stopped. It is the one open-ended engine.
      closed: false,
    }
  }

  next(session: SessionHandle): Promise<PracticeItem | null> {
    return itemAtCursor(session)
  }

  record(session: SessionHandle, attempt: Attempt, _ctx: EngineContext): Promise<ProgressDelta> {
    const item = itemFor(session, attempt)
    const repIndex = metaNumber(item, 'repIndex', 0)
    const repeatTarget = metaNumber(item, 'repeatTarget', 1)
    const finishedCycle = repIndex === repeatTarget - 1

    return Promise.resolve({
      ...universalDelta(item, attempt, {
        // A full listen cycle is a rep; individual repetitions are not.
        reps: finishedCycle ? 1 : 0,
        plays: finishedCycle ? 1 : 0,
        // Passive listening does not measure production latency, and we do not
        // invent one. Rule 4.
        latencyMs: null,
      }),
      // Rule 5: listening is exposure. No DSP score or FSRS
      // write — recognition without production is not a review.
    })
  }

  async summarize(session: SessionHandle): Promise<SessionSummary> {
    return Promise.resolve({
      engineId: this.id,
      phrasesTouched: distinctPhrases(workedItems(session)),
      phrasesProduced: 0,
      durationMs: session.cursor * 4_350,
      extra: {},
    })
  }
}

/** Counters the stream header shows: loved / difficult / learned. */
export function streamStats(phrases: readonly PhraseState[]): {
  loved: number
  hard: number
  learned: number
} {
  return {
    loved: phrases.filter((p) => p.loved && !p.learned).length,
    hard: phrases.filter((p) => p.difficulty === 'hard' && !p.learned).length,
    learned: phrases.filter((p) => p.learned).length,
  }
}
