import { rustCoreFacade } from '../coreFacade'
import { EMPTY_REFRAIN_RESUME } from '../state'
/**
 * Today's Refrain set: chosen once, then FROZEN. "You always see today."
 *
 * The day comes from the injected `Clock`, never from a `Date` — this is the action a wrong
 * day key reaches first, and from here it reaches every engine at once.
 */

import { DEFAULT_REP_TARGET, repsToday, selectRefrainSet } from '@loro/core'
import type { Slice } from '../types'

export const createRefrainSlice: Slice<'ensureRefrainSet'> = ({
  set,
  get,
  deps,
  loadRefrainDay,
}) => ({
  ensureRefrainSet: () => {
    const day = deps.clock.localDay()
    const st = get()
    const size = rustCoreFacade.refrainSetSize(st.dailyMinutes)

    // A new day (or the first ever): choose today's set once, then freeze it.
    if (st.refrainDay !== day) {
      const saved = loadRefrainDay(day, st.targetLocale)
      set({
        refrainResume: EMPTY_REFRAIN_RESUME,
        refrainSet: saved?.setIds ?? [...selectRefrainSet(rustCoreFacade, st.phrases, size)],
        refrainDay: day,
        refrainSubstituted: saved?.substituted ?? [],
      })
      // A timezone change can revisit a frozen day. Restore its membership, then
      // repair any phrases deleted since that day was last visible.
      if (saved) get().ensureRefrainSet()
      return
    }

    const liveIds = new Set(st.phrases.map((phrase) => phrase.id as string))
    if (st.refrainSet.some((id) => !liveIds.has(id))) {
      set({
        refrainResume: EMPTY_REFRAIN_RESUME,
        refrainSet: st.refrainSet.filter((id) => liveIds.has(id)),
        refrainSubstituted: st.refrainSubstituted.filter((id) => liveIds.has(id)),
      })
      get().ensureRefrainSet()
      return
    }

    // Same day, so the set is FROZEN — it may only be topped up. The old guard was
    // `refrainDay === day && refrainSet.length > 0`, which fell through on an emptied
    // set and re-rolled the whole day, including phrases already practised. Backfill
    // instead: existing members keep their place.
    if (st.refrainSet.length >= size) return

    const inSet = new Set(st.refrainSet)
    const candidates = st.phrases.filter(
      // Not already in today's set, and not something the learner already finished
      // today — substituting in a phrase that is already at 6/6 offers no work.
      (p) => !inSet.has(p.id) && repsToday(p, day) < DEFAULT_REP_TARGET,
    )
    const fill = selectRefrainSet(rustCoreFacade, candidates, size - st.refrainSet.length)
    if (fill.length === 0) return

    set({
      refrainResume: EMPTY_REFRAIN_RESUME,
      refrainSet: [...st.refrainSet, ...fill],
      refrainSubstituted: [...st.refrainSubstituted, ...fill],
    })
  },
})
