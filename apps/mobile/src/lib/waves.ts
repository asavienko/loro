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
 *   • **Claim a wave was completed.** Nothing persists per-wave completion yet — plan 64 owns
 *     that — so a wave whose time has gone by is `passed`, a fact about the clock, and never
 *     `done`, which would be a fact about the learner this app cannot know (non-negotiable 2).
 *     The authored day row draws `passed` with the receding ink it uses for `done`
 *     (`--day-done-ink`), and prints no status word beside it.
 *   • **Enforce the schedule.** `next` is presentation. The Refrain stays reachable at any hour,
 *     exactly as it was before; timed enforcement is plan 64's, together with wave persistence.
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
