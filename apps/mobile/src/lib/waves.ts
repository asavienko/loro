/**
 * Which of the day's waves the learner is on.
 *
 * The day still has three named slots (`scheduling.md` wave times). A wave is a
 * record that the learner showed up — not a gate. Practice stays open before the
 * first hour, after a wave is done, and after every slot is marked complete.
 *
 * A wave completes when ten distinct phrases have been listened to three times
 * each today. Further listens keep counting toward later slots. Clock-elapsed
 * hours never invent a completion.
 *
 * Times are zero-padded 24-hour `HH:MM` — the shape `EngineContext.settings.waveTimes`
 * stores and `clock.localTimeLabel()` returns — so they compare as plain strings
 * and neither side is parsed.
 */

/** Distinct phrases that must reach the listen target to finish one wave. */
export const WAVE_LISTEN_PHRASE_COUNT = 10
/** Listens one phrase needs before it counts toward wave completion. */
export const WAVE_LISTEN_REPEATS = 3

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
 * The wave the day is offering. Completion never locks the next slot, and the
 * clock never locks the first one. `complete` means every scheduled wave is
 * marked done — practice remains open.
 */
export type WaveEntry<Key extends string> =
  { readonly kind: 'ready'; readonly wave: ScheduledWave<Key> } | { readonly kind: 'complete' }

/**
 * The persisted session is the authority while it is valid for today. Every surface uses this
 * projection, so a learner who pauses a morning wave at 13:00 is offered that same morning work
 * by Today, the spine and Refrain instead of three contradictory actions.
 */
export interface RefrainCheckpoint<Key extends string> {
  readonly session: object | null
  readonly wave?: Key
  readonly done: boolean
}

export type ResumableWaveEntry<Key extends string> =
  WaveEntry<Key> | { readonly kind: 'resume'; readonly wave: Key }

export function incrementWaveListen(
  counts: Readonly<Record<string, number>>,
  phraseId: string,
  amount = 1,
): Record<string, number> {
  if (amount <= 0) return { ...counts }
  return { ...counts, [phraseId]: (counts[phraseId] ?? 0) + amount }
}

/** How many phrases have already been heard the required number of times. */
export function qualifiedWaveListenCount(counts: Readonly<Record<string, number>>): number {
  return Object.values(counts).filter((n) => n >= WAVE_LISTEN_REPEATS).length
}

/** Whole waves today's listens have paid for, ignoring who else finished a slot. */
function waveListenCredits(counts: Readonly<Record<string, number>>): number {
  return Math.floor(qualifiedWaveListenCount(counts) / WAVE_LISTEN_PHRASE_COUNT)
}

/**
 * One listen, and the waves it finishes.
 *
 * Credit is what the listen ADDS, not what the totals would justify on their own. A
 * finished Refrain set already owns a slot, so re-deriving "ten qualified phrases means
 * the first wave" would hand the listener a key they already had and silently spend the
 * same ten phrases twice. Each newly crossed multiple of ten takes the earliest slot
 * still unfinished; listens past the last slot are kept but invent no fourth wave.
 */
export function recordWaveListen(
  keys: readonly string[],
  completed: readonly string[],
  counts: Readonly<Record<string, number>>,
  phraseId: string,
  plays = 1,
): { counts: Record<string, number>; completed: string[] } {
  if (plays <= 0) return { counts: { ...counts }, completed: [...completed] }
  const next = incrementWaveListen(counts, phraseId, plays)
  const earned = waveListenCredits(next) - waveListenCredits(counts)
  const finished = [...completed]
  for (let i = 0; i < earned; i += 1) {
    const slot = keys.find((key) => !finished.includes(key))
    if (slot === undefined) break
    finished.push(slot)
  }
  return { counts: next, completed: finished }
}

/** Listens already counted toward the next unfinished wave. */
export function waveListenProgress(counts: Readonly<Record<string, number>>): number {
  return qualifiedWaveListenCount(counts) % WAVE_LISTEN_PHRASE_COUNT
}

export function waveEntryWithResume<Key extends string>(
  keys: readonly Key[],
  times: readonly string[],
  now: string,
  completed: readonly Key[],
  resume: RefrainCheckpoint<Key>,
): ResumableWaveEntry<Key> {
  const scheduled = waveEntry(keys, times, now, completed)
  if (resume.session === null || resume.done) return scheduled

  // A completed wave is still a valid resume: finishing the listen quota must
  // not throw away an in-progress Refrain. Legacy records predate `wave` and
  // fall back to the current ready slot.
  const wave = resume.wave ?? (scheduled.kind === 'ready' ? scheduled.wave.key : undefined)
  if (wave === undefined || !keys.includes(wave)) return scheduled
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

  // Prefer the newest arrived unfinished slot so missed morning work moves
  // forward with the clock. If every arrived slot is done — or none has
  // arrived yet — offer the next unfinished wave immediately. Never lock.
  const open = scheduled.filter((wave) => wave.time <= now)
  const openUnfinished = open
    .slice()
    .reverse()
    .find((wave) => !wave.completed)
  if (openUnfinished !== undefined) return { kind: 'ready', wave: openUnfinished }

  const unfinished = scheduled.find((wave) => !wave.completed)
  return unfinished === undefined ? { kind: 'complete' } : { kind: 'ready', wave: unfinished }
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
