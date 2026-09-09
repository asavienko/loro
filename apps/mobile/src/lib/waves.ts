/**
 * Which of the day's waves the learner is on.
 *
 * The rule is [scheduling.md](../../../../docs/architecture/scheduling.md#wave-times): a wave
 * becomes ready at its time, is locked before it, and the day's LAST ready wave stays available
 * until midnight. So the wave to practise now is the last one whose time has arrived, and before
 * the first one arrives it is the first.
 *
 * Two things this deliberately does NOT do:
 *
 *   • **Infer completion from the clock.** Only the persisted completed-wave keys set
 *     `completed`; an elapsed hour alone remains `passed`, never a learner achievement.
 *   • **Enforce the schedule.** `next` is presentation. The Refrain stays reachable at any hour,
 *     exactly as it was before; timed enforcement remains plan 64's next slice.
 *
 * Times are zero-padded 24-hour `HH:MM` — the shape `EngineContext.settings.waveTimes` stores and
 * `clock.localTimeLabel()` returns — so they compare as plain strings and neither side is parsed.
 */

/** Where a wave sits relative to now. Exactly one wave in a day is `next`. */
export type WavePosition = 'passed' | 'next' | 'later'

export interface ScheduledWave<Key extends string> {
  readonly key: Key
  /** `HH:MM`, from the engine settings. */
  readonly time: string
  readonly position: WavePosition
  /** Present only when the persisted day row records this wave as finished. */
  readonly completed?: true
}

/**
 * The one wave a learner may enter at this instant.
 *
 * `waveSchedule` is deliberately a presentation projection: before the first scheduled time it
 * still marks the first row as `next`, so Today can show what is coming. Entry has a stricter
 * rule. Before a wave opens it is locked, and a persisted completion is never permission to run
 * the same wave again. If time moves on, unfinished work moves to the newest open wave; elapsed
 * time never creates a completion.
 */
export type WaveEntry<Key extends string> =
  | { readonly kind: 'ready'; readonly wave: ScheduledWave<Key> }
  | { readonly kind: 'locked'; readonly next: ScheduledWave<Key> }
  | { readonly kind: 'complete' }

/**
 * The persisted session is the authority while it is valid for today. Every surface uses this
 * projection, so a learner who pauses a morning wave at 13:00 is offered that same morning work
 * by Today, the spine and Refrain instead of three contradictory actions.
 */
export type RefrainCheckpoint<Key extends string> = {
  readonly session: unknown | null
  readonly wave?: Key
  readonly done: boolean
}

export type ResumableWaveEntry<Key extends string> =
  WaveEntry<Key> | { readonly kind: 'resume'; readonly wave: Key }

export function waveEntryWithResume<Key extends string>(
  keys: readonly Key[],
  times: readonly string[],
  now: string,
  completed: readonly Key[],
  resume: RefrainCheckpoint<Key>,
): ResumableWaveEntry<Key> {
  const scheduled = waveEntry(keys, times, now, completed)
  if (resume.session === null || resume.done) return scheduled

  // Legacy records predate `wave`. They can only safely resume when the scheduler can identify
  // their current open wave; never guess one from a locked or completed day.
  const wave = resume.wave ?? (scheduled.kind === 'ready' ? scheduled.wave.key : undefined)
  if (wave === undefined || !keys.includes(wave) || completed.includes(wave)) return scheduled
  return { kind: 'resume', wave }
}

export function waveEntry<Key extends string>(
  keys: readonly Key[],
  times: readonly string[],
  now: string,
  completed: readonly Key[] = [],
): WaveEntry<Key> {
  const scheduled = waveSchedule(keys, times, now, completed)
  const first = scheduled[0]
  if (first === undefined) return { kind: 'complete' }

  const open = scheduled.filter((wave) => wave.time <= now)
  if (open.length === 0) return { kind: 'locked', next: first }

  // A completed later wave does not erase an earlier persisted gap. Work backwards so the
  // newest available unfinished wave remains resumable; elapsed time never fills that gap.
  const openUnfinished = open
    .slice()
    .reverse()
    .find((wave) => !wave.completed)
  if (openUnfinished !== undefined) return { kind: 'ready', wave: openUnfinished }

  const next = scheduled.find((wave) => wave.time > now && !wave.completed)
  return next === undefined ? { kind: 'complete' } : { kind: 'locked', next }
}

/**
 * Zip the day's wave keys with the scheduler's times and mark where now falls.
 *
 * `keys` is structure (Loop B has three waves, in this order) and `times` is settings, so the two
 * arrive from different places and can disagree in length. A key with no time is not a wave the
 * scheduler knows about, so it is dropped rather than drawn at an invented hour.
 */
export function waveSchedule<Key extends string>(
  keys: readonly Key[],
  times: readonly string[],
  now: string,
  completed: readonly Key[] = [],
): ScheduledWave<Key>[] {
  const scheduled = keys.flatMap((key, i) => {
    const time = times[i]
    return time === undefined ? [] : [{ key, time }]
  })
  const arrived = scheduled.filter((wave) => wave.time <= now).length
  // Before the first wave's time nothing has arrived, and the first one is what is next.
  const current = Math.max(0, arrived - 1)
  const finished = new Set(completed)
  return scheduled.map((wave, i) => ({
    ...wave,
    position: i < current ? 'passed' : i === current ? 'next' : 'later',
    ...(finished.has(wave.key) ? { completed: true as const } : {}),
  }))
}
