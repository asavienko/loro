/**
 * Circadian band from the real wave schedule. Never invents a named hour
 * ("Golden Hour") or a countdown lock — waves are not gates.
 */

export type RhythmBand = 'morning' | 'midday' | 'evening'

export function isRhythmBand(key: string): key is RhythmBand {
  return key === 'morning' || key === 'midday' || key === 'evening'
}

export function rhythmBandFromSchedule(
  waves: readonly { key: string; position: 'passed' | 'next' | 'later' }[],
): RhythmBand {
  const next = waves.find((wave) => wave.position === 'next')
  if (next !== undefined && isRhythmBand(next.key)) return next.key
  const last = waves[waves.length - 1]
  return last !== undefined && isRhythmBand(last.key) ? last.key : 'evening'
}

/** A scheduled slot that has already arrived is due now. Later slots keep their clock time. */
export function nextDueIsNow(waveTime: string, now: string): boolean {
  return waveTime <= now
}

/** Split a scheduler `HH:MM` for the HTML `8:00 AM ·` face. Invents nothing. */
export function waveClockParts(
  hhmm: string,
): { hour: number; minute: string; period: 'am' | 'pm' } | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm)
  if (match === null) return null
  const hour24 = Number(match[1])
  const minute = match[2]
  return {
    hour: hour24 % 12 === 0 ? 12 : hour24 % 12,
    minute,
    period: hour24 < 12 ? 'am' : 'pm',
  }
}
