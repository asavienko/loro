/**
 * Practice outcomes — the single write path for a progress field.
 *
 * `applyDelta` takes what an engine produced and nothing else. The whole point of keeping
 * it to one action in one file is that "who wrote this number?" has one answer; an action
 * that computed a progress field itself would make rule 5 unenforceable.
 */

import { applyDeltaToPhrase } from '../delta'
import { structuralEqual } from '../../lib/structuralEqual'
import { addPracticeDay } from '../state'
import { PRODUCTION_WAVES } from '../engines'
import { recordWaveListen } from '../../lib/waves'
import type { Slice } from '../types'
import type { UserPhraseId } from '@loro/core'

function withWaveListens<T extends { waveListens: Record<string, number>; refrainWaves: string[] }>(
  course: T,
  phraseId: string,
  plays: number,
): T {
  if (plays <= 0) return course
  const listened = recordWaveListen(
    PRODUCTION_WAVES,
    course.refrainWaves,
    course.waveListens,
    phraseId,
    plays,
  )
  return { ...course, waveListens: listened.counts, refrainWaves: listened.completed }
}

export const createPracticeSlice: Slice<'recordPlay' | 'applyDelta' | 'setStreamCursor'> = ({
  set,
  get,
  deps,
}) => ({
  setStreamCursor: (streamCursor) => {
    set({ streamCursor })
  },

  recordPlay: (id) => {
    // A play is an observation, not a computed score, so it goes through the same
    // single write path as everything else. Roll the frozen day first so a listen
    // just after midnight counts toward today's wave, not yesterday's.
    get().ensureRefrainSet()
    get().applyDelta({
      phraseId: id as UserPhraseId,
      plays: 1,
      lastPracticedAt: deps.clock.now(),
    })
  },

  applyDelta: (delta, context) => {
    const day = context?.localDay ?? deps.clock.localDay()
    // A rep is what makes a day count towards the streak — a play in the stream is
    // listening, not production. Keyed on the STREAK day, so a 01:30 session extends
    // the evening it continues rather than starting a new day.
    const practised = (delta.reps ?? 0) > 0 ? (context?.streakDay ?? deps.clock.streakDay()) : null

    set((st) => {
      const destination = context?.targetLocale ?? st.targetLocale
      const active =
        destination === st.targetLocale && st.phrases.some((p) => p.id === delta.phraseId)
      const saved = Object.entries(st.courses).find(
        ([locale, course]) =>
          locale !== st.targetLocale &&
          (!context?.targetLocale || locale === destination) &&
          course.phrases.some((p) => p.id === delta.phraseId),
      )
      if (!active && !saved) {
        if (context?.attemptId) throw new Error('Practice phrase is no longer available')
        return st
      }
      const currentPhrase = (active ? st.phrases : saved?.[1].phrases)?.find(
        (p) => p.id === delta.phraseId,
      )
      if (context?.expectedPhrase && !structuralEqual(context.expectedPhrase, currentPhrase))
        throw new Error('Practice phrase has changed')
      const resume = active ? st.refrainResume : saved?.[1].refrainResume
      if (context?.sessionId && resume?.session?.sessionId !== context.sessionId)
        throw new Error('Practice session has changed')
      if (context?.expectedCursor !== undefined && resume?.cursor !== context.expectedCursor)
        throw new Error('Practice cursor has changed')
      const checkpoint =
        context?.checkpoint ??
        (context?.refrainCursor === undefined
          ? undefined
          : {
              ...(resume ?? st.refrainResume),
              cursor: context.refrainCursor,
              // The engine receives the session cursor when it records the next
              // attempt. Keep that immutable snapshot in lockstep with the displayed
              // cursor so a durable resume cannot replay a different item.
              session:
                resume?.session === null || resume?.session === undefined
                  ? null
                  : { ...resume.session, cursor: context.refrainCursor },
            })
      const update = (phrases: typeof st.phrases): typeof st.phrases =>
        phrases.map((p) => (p.id === delta.phraseId ? applyDeltaToPhrase(p, delta, day) : p))
      const plays = delta.plays ?? 0
      const listened = active
        ? withWaveListens(
            { waveListens: st.waveListens, refrainWaves: st.refrainWaves },
            delta.phraseId,
            plays,
          )
        : null
      return {
        ...(checkpoint && active ? { refrainResume: checkpoint } : {}),
        ...(listened ?? {}),
        phrases: active ? update(st.phrases) : st.phrases,
        courses:
          !active && saved
            ? {
                ...st.courses,
                [saved[0]]: withWaveListens(
                  {
                    ...saved[1],
                    phrases: update(saved[1].phrases),
                    ...(checkpoint ? { refrainResume: checkpoint } : {}),
                  },
                  delta.phraseId,
                  plays,
                ),
              }
            : st.courses,
        practiceDays:
          practised === null ? st.practiceDays : addPracticeDay(st.practiceDays, practised),
      }
    })
  },
})
