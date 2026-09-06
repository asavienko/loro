/**
 * Practice outcomes — the single write path for a progress field.
 *
 * `applyDelta` takes what an engine produced and nothing else. The whole point of keeping
 * it to one action in one file is that "who wrote this number?" has one answer; an action
 * that computed a progress field itself would make rule 5 unenforceable.
 */

import { applyDeltaToPhrase } from '../delta'
import { addPracticeDay } from '../state'
import type { Slice } from '../types'
import type { UserPhraseId } from '@loro/core'

export const createPracticeSlice: Slice<'recordPlay' | 'applyDelta'> = ({ set, get, deps }) => ({
  recordPlay: (id) => {
    // A play is an observation, not a computed score, so it goes through the same
    // single write path as everything else.
    get().applyDelta({
      phraseId: id as UserPhraseId,
      plays: 1,
      lastPracticedAt: deps.clock.now(),
    })
  },

  applyDelta: (delta) => {
    const day = deps.clock.localDay()
    // A rep is what makes a day count towards the streak — a play in the stream is
    // listening, not production. Keyed on the STREAK day, so a 01:30 session extends
    // the evening it continues rather than starting a new day.
    const practised = (delta.reps ?? 0) > 0 ? deps.clock.streakDay() : null

    set((st) => {
      const active = st.phrases.some((p) => p.id === delta.phraseId)
      const saved = Object.entries(st.courses).find(
        ([locale, course]) =>
          locale !== st.targetLocale && course.phrases.some((p) => p.id === delta.phraseId),
      )
      if (!active && !saved) return st
      const update = (phrases: typeof st.phrases): typeof st.phrases =>
        phrases.map((p) => (p.id === delta.phraseId ? applyDeltaToPhrase(p, delta, day) : p))
      return {
        phrases: active ? update(st.phrases) : st.phrases,
        courses:
          !active && saved
            ? { ...st.courses, [saved[0]]: { ...saved[1], phrases: update(saved[1].phrases) } }
            : st.courses,
        practiceDays:
          practised === null ? st.practiceDays : addPracticeDay(st.practiceDays, practised),
      }
    })
  },
})
