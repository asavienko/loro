/**
 * Learner-facing formatting.
 *
 * These live here rather than inline in components because they encode blueprint
 * contracts, and a contract that lives in a component gets quietly reinvented on the
 * next screen.
 */

/**
 * Interval formatting, from the blueprint (`Loro.dc.html:3009`).
 *
 * The blueprint's FIXED interval labels are a display model; these format FSRS's real
 * computed output. See docs/architecture/adr/0004-fsrs-scheduler.md
 */
export function formatInterval(days: number): string {
  if (days < 0.9) return '~10 min'
  if (days < 1.6) return 'tomorrow'
  if (days < 30) return `${Math.round(days)} days`
  return `${Math.round(days / 7)} wks`
}

/**
 * A measured latency, or `null` when speech onset was never detected.
 *
 * RULE 4: every number shown to a learner is real. `null` renders as nothing — the
 * read-out is HIDDEN rather than filled with a plausible estimate.
 * See docs/architecture/audio-speech.md#recording-and-latency
 */
export function formatLatency(ms: number | null): string | null {
  if (ms === null) return null
  // Clamped for DISPLAY only; the raw value is what gets stored.
  const clamped = Math.min(Math.max(ms, 300), 5000)
  return `${(clamped / 1000).toFixed(1)}s`
}

/** The countdown's days-to-go, from two local dates. */
export function daysUntil(fromLocalDay: string, toLocalDay: string): number {
  const day = (s: string): number => {
    const [y = 0, m = 1, d = 1] = s.split('-').map(Number)
    return Date.UTC(y, m - 1, d) / 86_400_000
  }
  return day(toLocalDay) - day(fromLocalDay)
}

/** `38 / 100` readiness, as a percentage for the ring. */
export function ownershipPct(owned: number, target: number): number {
  if (target <= 0) return 0
  return Math.min(100, Math.round((owned / target) * 100))
}

/**
 * Difficulty labels. Note the middle one: "Learning" is a STATUS, not a rating, and
 * "Difficult" describes the phrase rather than the learner.
 */
export function difficultyLabel(d: 'easy' | 'med' | 'hard'): string {
  return { easy: 'Easy', med: 'Learning', hard: 'Difficult' }[d]
}

/** Tag labels, exactly as the blueprint writes them. */
export function tagLabel(t: 'pron' | 'remember' | 'useful' | 'words'): string {
  return {
    pron: 'Pronunciation',
    remember: 'Hard to remember',
    useful: 'Very useful',
    words: 'Tricky words',
  }[t]
}
