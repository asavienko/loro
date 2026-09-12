import { useCallback, useEffect, useMemo, useRef } from 'react'
import {
  DEFAULT_REP_TARGET,
  repsToday as repsTodayOf,
  userPhraseId,
  warmBand,
  type RefrainMode,
} from '@loro/core'
import { warming } from '../../src/ui/theme'
import {
  engineContext,
  refrainEngine,
  toView,
  useApp,
  type PhraseView,
  type ProductionWave,
} from '../../src/store'
import { rustCoreFacade } from '../../src/store/coreFacade'
import { copy } from '../../src/lib/copy'
import { deviceClock } from '../../src/lib/clock'
import { refrainSessionMatchesFocus, sessionCoversDaySet } from '../../src/lib/practiceFocus'

export type WarmingStyle = (typeof warming)[ReturnType<typeof warmBand>]

export interface RefrainSession {
  wave: ProductionWave
  clozeMask: readonly number[]
  /** Today's frozen set, in the order the learner will see it. */
  set: PhraseView[]
  /** The phrase on screen. `undefined` while the engine's plan is still resolving. */
  phrase: PhraseView | undefined
  /** Which phrase of the set is on screen, 1-based. */
  phraseNumber: number
  mode: RefrainMode
  /** Reps recorded for this phrase TODAY, read from the store. */
  dayReps: number
  auto: number
  bandStyle: WarmingStyle
  locked: boolean
  /** The learner tapped through the set, or the plan had nothing left to do. */
  finished: boolean
  doRep: () => void
  nextPhrase: () => void
}

/**
 * The engine plans the session; this hook holds the plan and hands the deltas back.
 * The mode sequence, the rep target, and which reps remain today are all the
 * RefrainEngine's decisions — the screen used to re-derive them, which is how the
 * card's warmth and the stored value came to disagree.
 */
export function useRefrainSession(
  wave: ProductionWave,
  enabled: boolean,
  options?: {
    readonly setIds?: readonly string[]
    readonly completeWave?: boolean
    readonly replaceSession?: boolean
  },
): RefrainSession {
  const phrases = useApp((s) => s.phrases)
  const refrainSet = useApp((s) => s.refrainSet)
  const applyDelta = useApp((s) => s.applyDelta)
  const ensureRefrainSet = useApp((s) => s.ensureRefrainSet)
  const beginRefrainSession = useApp((s) => s.beginRefrainSession)
  const saveRefrainCheckpoint = useApp((s) => s.saveRefrainCheckpoint)
  const completeRefrainWave = useApp((s) => s.completeRefrainWave)
  const showToast = useApp((s) => s.showToast)
  const { session, cursor, done, wave: resumedWave } = useApp((state) => state.refrainResume)
  const activeWave = resumedWave ?? wave
  const targetLocale = useApp((state) => state.targetLocale)
  const setIds = options?.setIds
  const shouldCompleteWave = options?.completeWave !== false
  const replaceSession = options?.replaceSession === true
  const setKey = setIds?.join('\0') ?? ''
  const setIdsRef = useRef(setIds)
  setIdsRef.current = setIds
  const busy = useRef(false)
  // Entering the Refrain is one of the moments the day must be re-checked: a learner who
  // opened the app before midnight and starts practising after it needs today's set.
  useEffect(() => {
    ensureRefrainSet()
  }, [ensureRefrainSet])
  useEffect(() => {
    if (!enabled) return
    const scoped = setIdsRef.current?.map(userPhraseId)
    let cancelled = false
    void refrainEngine
      .plan(engineContext(scoped !== undefined ? { refrainSet: scoped } : undefined))
      .then((plan) => {
        if (cancelled) return
        const resume = useApp.getState().refrainResume
        const existing = resume.session
        const sameFocus = refrainSessionMatchesFocus(
          existing?.plan.items.map((item) => item.phraseId) ?? [],
          setIdsRef.current,
        )
        if (existing !== null && !resume.done) {
          // Remaining-work re-plans drop finished phrases. That is not a new focus.
          if (sameFocus || !replaceSession || plan.items.length === 0) return
        }
        // A just-finished drill must not be replaced by the in-flight remaining-work plan.
        // That empty begin looked like a live wave resume on Today.
        if (resume.done && (sameFocus || plan.items.length === 0)) return
        beginRefrainSession(plan, wave)
      })
      .catch(() => {
        if (!cancelled) showToast(`${copy.persistence.error} ${copy.persistence.retry}`)
      })
    return () => {
      cancelled = true
    }
    // `setKey` stands in for `setIds`: a new array identity on every render must not
    // re-plan, or the last targeted rep looks like an empty set and finishes the day.
  }, [
    enabled,
    refrainSet,
    setKey,
    targetLocale,
    beginRefrainSession,
    showToast,
    wave,
    replaceSession,
  ])
  const item = session?.plan.items[cursor]
  const storePhrase = useMemo(
    () => (item === undefined ? undefined : phrases.find((p) => p.id === item.phraseId)),
    [item, phrases],
  )
  const phrase = storePhrase === undefined ? undefined : toView(storePhrase)
  const mode = (item?.mode ?? 'echo') as RefrainMode
  /**
   * Automaticity comes from the STORE's rep count for TODAY, not from a counter local to
   * this visit. The two disagree the moment a learner returns to a phrase later the same
   * day: local state starts at 0 while the store says 4 of 6, and the number on screen
   * was the wrong one. `repsToday` is read through the day guard, so a stale counter from
   * yesterday reads as 0 rather than inflating the card.
   */
  const dayReps = storePhrase === undefined ? 0 : repsTodayOf(storePhrase, deviceClock.localDay())
  const auto = rustCoreFacade.automaticity(dayReps, DEFAULT_REP_TARGET)
  const band = warmBand(auto)
  const bandStyle = warming[band]
  const locked = auto >= 100
  // A foreground event covers wake-up; a tap also covers staying awake across midnight.
  // Re-plan first, so yesterday's absolute rep index cannot become today's progress.
  const ensureCurrentDay = useCallback(() => {
    if (useApp.getState().refrainDay === deviceClock.localDay()) return true
    try {
      ensureRefrainSet()
    } catch {
      showToast(`${copy.persistence.error} ${copy.persistence.retry}`)
    }
    return false
  }, [ensureRefrainSet, showToast])
  const doRep = useCallback(() => {
    if (busy.current || !ensureCurrentDay()) return
    if (session === null || item === undefined || storePhrase === undefined || locked) return
    busy.current = true
    const scoped = setIdsRef.current?.map(userPhraseId)
    const ctx = engineContext(scoped !== undefined ? { refrainSet: scoped } : undefined)
    const at = deviceClock.now()
    const localDay = deviceClock.localDay()
    const streakDay = deviceClock.streakDay()
    // Keep the last rep visible for the lock-in moment. The checkpoint and outcome
    // commit together; a failed write leaves this exact attempt available to retry.
    const nextCursor =
      session.plan.items[cursor + 1]?.phraseId === item.phraseId ? cursor + 1 : cursor
    void refrainEngine
      .record(
        { ...session, cursor },
        { itemId: item.itemId, outcome: 'success', latencyMs: null, hintsUsed: 0, at },
        ctx,
      )
      .then((delta) => {
        applyDelta(delta, {
          attemptId: `${session.sessionId}:${item.itemId}`,
          targetLocale,
          localDay,
          streakDay,
          sessionId: session.sessionId,
          expectedCursor: cursor,
          expectedPhrase: storePhrase,
          checkpoint: {
            wave: activeWave,
            lastLatency: null,
            history: [],
            session: { ...session, cursor: nextCursor },
            cursor: nextCursor,
            done: false,
          },
        })
      })
      .catch(() => {
        showToast(`${copy.persistence.error} ${copy.persistence.retry}`)
      })
      .finally(() => {
        busy.current = false
      })
  }, [
    session,
    item,
    cursor,
    locked,
    applyDelta,
    targetLocale,
    storePhrase,
    ensureCurrentDay,
    showToast,
    activeWave,
  ])
  /** Jump to the first item of the next phrase in the plan. */
  const nextPhrase = useCallback(() => {
    if (busy.current || !ensureCurrentDay() || session === null) return
    const current = session.plan.items[cursor]?.phraseId
    const nextIndex = session.plan.items.findIndex((i, n) => n > cursor && i.phraseId !== current)
    const nextCursor = nextIndex < 0 ? cursor : nextIndex
    try {
      const checkpoint = {
        wave: activeWave,
        lastLatency: null,
        history: [],
        session: { ...session, cursor: nextCursor },
        cursor: nextCursor,
        done: nextIndex < 0,
      }
      if (
        nextIndex < 0 &&
        shouldCompleteWave &&
        sessionCoversDaySet(
          session.plan.items.map((item) => item.phraseId),
          refrainSet,
        )
      ) {
        completeRefrainWave(activeWave, checkpoint)
      } else {
        saveRefrainCheckpoint(checkpoint)
      }
    } catch {
      showToast(`${copy.persistence.error} ${copy.persistence.retry}`)
    }
  }, [
    session,
    cursor,
    ensureCurrentDay,
    completeRefrainWave,
    saveRefrainCheckpoint,
    activeWave,
    showToast,
    shouldCompleteWave,
    refrainSet,
  ])
  const set = useMemo(
    () =>
      (setIds ?? refrainSet)
        .map((id) => phrases.find((p) => p.id === id))
        .filter((p): p is NonNullable<typeof p> => p !== undefined)
        .map(toView),
    [setIds, refrainSet, phrases],
  )
  // Which phrase of the day's set is on screen. Read from the frozen set rather than
  // counted locally, so it stays right when a session resumes part-way through.
  const phraseNumber =
    item === undefined ? 1 : Math.max(1, set.findIndex((p) => p.id === item.phraseId) + 1)
  // The plan is the day's remaining work. Empty means the set is already warmed up —
  // a distinct state from "nothing in rotation", and the learner should see the finish,
  // not an empty screen.
  const exhausted = session !== null && cursor >= session.plan.items.length
  return {
    wave: activeWave,
    set,
    phrase,
    phraseNumber,
    mode,
    clozeMask: item?.prompt.clozeMask ?? [],
    dayReps,
    auto,
    bandStyle,
    locked,
    finished: done || exhausted,
    doRep,
    nextPhrase,
  }
}
