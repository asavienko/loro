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
import type { PhraseState } from '../../domain/phrase.js'
import { LadderRung } from '../../domain/phrase.js'

export class StreamEngine implements PracticeEngine {
  readonly id = 'stream' as const

  availability(ctx: EngineContext): Promise<Availability> {
    return ctx.phrases
      .active()
      .then((active) =>
        active.length === 0
          ? ({ state: 'unavailable', reason: 'stream-empty' } as const)
          : ({ state: 'available' } as const),
      )
  }

  async plan(ctx: EngineContext): Promise<SessionPlan> {
    const active = await ctx.phrases.active()
    const now = ctx.clock.now()

    // rank = plays + (hard -6 | easy +4) + (loved -3) + (due -4), ascending.
    // `plays` dominates, which round-robins naturally: everything is heard before
    // anything repeats, and the offsets bias WHICH comes sooner without starving.
    const ordered = [...active].sort(
      (a, b) =>
        ctx.core.streamRank(a, now) - ctx.core.streamRank(b, now) || a.id.localeCompare(b.id),
    )

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
    return Promise.resolve(session.plan.items[session.cursor] ?? null)
  }

  record(session: SessionHandle, attempt: Attempt): Promise<ProgressDelta> {
    const item = session.plan.items.find((i) => i.itemId === attempt.itemId)
    if (item === undefined) {
      throw new Error(`unknown item ${attempt.itemId}`)
    }

    const repIndex = Number(item.meta.repIndex ?? 0)
    const repeatTarget = Number(item.meta.repeatTarget ?? 1)
    const finishedCycle = repIndex === repeatTarget - 1

    return Promise.resolve({
      phraseId: item.phraseId,
      plays: finishedCycle ? 1 : 0,
      // A full listen cycle is a rep; individual repetitions are not.
      reps: finishedCycle ? 1 : 0,
      lastPracticedAt: attempt.at,
      // Passive listening does not measure production latency, and we do not
      // invent one. Rule 4.
      latencySampleMs: null,
      // Rule 5: listening is exposure, so it advances perception only. No FSRS
      // write — recognition without production is not a review.
      axes: { perception: 1 },
    })
  }

  async summarize(session: SessionHandle): Promise<SessionSummary> {
    const unique = new Set(session.plan.items.slice(0, session.cursor).map((i) => i.phraseId))
    return Promise.resolve({
      engineId: this.id,
      phrasesTouched: unique.size,
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

/** The blueprint's toast copy. It explains the CONSEQUENCE, which is what teaches the model. */
export function rerateToast(to: 'easy' | 'med' | 'hard'): string {
  return {
    hard: 'Difficult — repeats more, comes back sooner',
    easy: 'Easy — drifting to the back',
    med: 'Back to normal',
  }[to]
}

export const STREAM_DEFAULT_RUNG = LadderRung.Accumulated
