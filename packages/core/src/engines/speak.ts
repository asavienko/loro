/** P3-20/P3-25. On-device production, with an honest non-production reveal fallback. */
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
} from './types.js'
import {
  availableWhenActive,
  itemAtCursor,
  itemFor,
  universalDelta,
  workedItems,
  distinctPhrases,
} from './common.js'
import { LadderRung } from '../domain/phrase.js'

export class SpeakEngine implements PracticeEngine {
  readonly id = 'speak' as const
  availability(ctx: EngineContext): Promise<Availability> {
    return availableWhenActive(ctx, 'speak-empty')
  }
  async plan(ctx: EngineContext): Promise<SessionPlan> {
    const phrases = await ctx.phrases.active()
    return {
      engineId: this.id,
      items: phrases.map((phrase) => ({
        itemId: `${phrase.id}#speak`,
        phraseId: phrase.id,
        mode: 'speak',
        prompt: { show: 'meaning' },
        gate: { kind: 'asr-full' },
        audio: null,
        meta: {},
      })),
      // No estimated duration is displayed to learners.
      estimatedMs: 0,
      closed: true,
    }
  }
  next(session: SessionHandle): Promise<PracticeItem | null> {
    return itemAtCursor(session)
  }
  async record(
    session: SessionHandle,
    attempt: Attempt,
    ctx?: EngineContext,
  ): Promise<ProgressDelta> {
    const item = itemFor(session, attempt)
    const produced =
      attempt.outcome === 'success' &&
      attempt.hintsUsed === 0 &&
      (attempt.transcript?.trim().length ?? 0) > 0
    if (!produced) {
      // Revealing/reading is not evidence of production, recall, mastery, or an FSRS review.
      return { phraseId: item.phraseId }
    }
    if (ctx === undefined) throw new Error('Speak requires its canonical engine context')
    const phrase = await ctx.phrases.byId(item.phraseId)
    if (phrase === null) throw new Error('Speak phrase no longer exists')
    const srs = ctx.core.fsrsReview(phrase, 3, attempt.at)
    return {
      ...universalDelta(item, attempt, { reps: 1, latencyMs: attempt.latencyMs }),
      ...(srs === undefined ? {} : { srs }),
      rung: Math.max(phrase.rung, LadderRung.Bent),
      staleReset: true,
    }
  }
  summarize(session: SessionHandle): Promise<SessionSummary> {
    return Promise.resolve({
      engineId: this.id,
      phrasesTouched: distinctPhrases(workedItems(session)),
      phrasesProduced: 0,
      durationMs: 0,
      extra: {},
    })
  }
}
