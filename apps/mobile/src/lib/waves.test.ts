import { describe, expect, it } from 'vitest'
import {
  WAVE_LISTEN_PHRASE_COUNT,
  WAVE_LISTEN_REPEATS,
  incrementWaveListen,
  qualifiedWaveListenCount,
  recordWaveListen,
  waveEntry,
  waveEntryWithResume,
  waveListenProgress,
  waveSchedule,
} from './waves'

const KEYS = ['morning', 'midday', 'evening'] as const
const TIMES = ['08:00', '13:00', '19:00'] as const

const positionsAt = (now: string): string[] =>
  waveSchedule(KEYS, TIMES, now).map((wave) => wave.position)

describe('waveSchedule', () => {
  it('makes the first wave next before any of them has arrived', () => {
    expect(positionsAt('06:30')).toEqual(['next', 'later', 'later'])
  })

  it('makes a wave next the minute its time arrives', () => {
    expect(positionsAt('08:00')).toEqual(['next', 'later', 'later'])
    expect(positionsAt('12:59')).toEqual(['next', 'later', 'later'])
    expect(positionsAt('13:00')).toEqual(['passed', 'next', 'later'])
  })

  it('keeps the last wave of the day available until midnight', () => {
    expect(positionsAt('19:00')).toEqual(['passed', 'passed', 'next'])
    expect(positionsAt('23:59')).toEqual(['passed', 'passed', 'next'])
  })

  it('has exactly one next wave at every minute of the day', () => {
    for (let hour = 0; hour < 24; hour += 1) {
      for (const minute of ['00', '30', '59']) {
        const now = `${String(hour).padStart(2, '0')}:${minute}`
        const next = positionsAt(now).filter((position) => position === 'next')
        expect(next, `at ${now}`).toEqual(['next'])
      }
    }
  })

  it('carries each wave its own scheduled time', () => {
    expect(waveSchedule(KEYS, TIMES, '09:00')).toEqual([
      { key: 'morning', time: '08:00', position: 'next' },
      { key: 'midday', time: '13:00', position: 'later' },
      { key: 'evening', time: '19:00', position: 'later' },
    ])
  })

  it('carries only recorded completions as learner facts', () => {
    expect(waveSchedule(KEYS, TIMES, '14:00', ['morning'])).toEqual([
      { key: 'morning', time: '08:00', position: 'passed', completed: true },
      { key: 'midday', time: '13:00', position: 'next' },
      { key: 'evening', time: '19:00', position: 'later' },
    ])
  })

  it('drops a wave the scheduler has no time for rather than inventing one', () => {
    expect(waveSchedule(KEYS, ['08:00'], '09:00')).toEqual([
      { key: 'morning', time: '08:00', position: 'next' },
    ])
    expect(waveSchedule(KEYS, [], '09:00')).toEqual([])
  })

  it('ignores settings times beyond the day’s waves', () => {
    expect(waveSchedule(['morning'], TIMES, '20:00')).toEqual([
      { key: 'morning', time: '08:00', position: 'next' },
    ])
  })
})

describe('wave listen completion', () => {
  it('counts a phrase only after three listens', () => {
    let counts = incrementWaveListen({}, 'a')
    counts = incrementWaveListen(counts, 'a')
    expect(qualifiedWaveListenCount(counts)).toBe(0)
    counts = incrementWaveListen(counts, 'a')
    expect(qualifiedWaveListenCount(counts)).toBe(1)
    expect(WAVE_LISTEN_REPEATS).toBe(3)
  })

  /** Listen to `phrases` phrases `WAVE_LISTEN_REPEATS` times each, from `state`. */
  const hear = (
    state: { counts: Record<string, number>; completed: string[] },
    phrases: number,
    offset = 0,
  ): { counts: Record<string, number>; completed: string[] } => {
    let current = state
    for (let i = offset; i < offset + phrases; i += 1) {
      for (let rep = 0; rep < WAVE_LISTEN_REPEATS; rep += 1) {
        current = recordWaveListen(KEYS, current.completed, current.counts, `p${i}`)
      }
    }
    return current
  }

  const fresh = { counts: {} as Record<string, number>, completed: [] as string[] }

  it('completes one wave at ten qualified phrases and leaves later slots open', () => {
    const ten = hear(fresh, WAVE_LISTEN_PHRASE_COUNT)
    expect(ten.completed).toEqual(['morning'])
    expect(waveListenProgress(ten.counts)).toBe(0)

    // An eleventh listen on a phrase already counted changes nothing it has not earned.
    const again = recordWaveListen(KEYS, ten.completed, ten.counts, 'p0')
    expect(again.completed).toEqual(['morning'])
    expect(again.counts['p0']).toBe(WAVE_LISTEN_REPEATS + 1)
  })

  it('earns later waves from further qualified phrases without inventing a fourth', () => {
    const all = hear(fresh, WAVE_LISTEN_PHRASE_COUNT * 4)
    expect(all.completed).toEqual([...KEYS])
  })

  it('credits a quota earned after another source finished a wave', () => {
    // A finished Refrain set already recorded the morning slot. Ten phrases heard three
    // times each is a second showing-up, so it takes the next slot rather than the one
    // that was already done.
    const after = hear({ counts: {}, completed: ['morning'] }, WAVE_LISTEN_PHRASE_COUNT)
    expect(after.completed).toEqual(['morning', 'midday'])
  })

  it('reports progress toward the next wave, not the whole day', () => {
    const partial = hear(fresh, 4)
    expect(waveListenProgress(partial.counts)).toBe(4)
    const over = hear(partial, 8, 4)
    expect(over.completed).toEqual(['morning'])
    expect(waveListenProgress(over.counts)).toBe(2)
  })
})

describe('waveEntry', () => {
  it('keeps the first wave ready before its scheduled time', () => {
    expect(waveEntry(KEYS, TIMES, '07:59')).toMatchObject({
      kind: 'ready',
      wave: { key: 'morning', time: '08:00' },
    })
  })

  it('opens a wave exactly at its time and moves missed work to the latest open wave', () => {
    expect(waveEntry(KEYS, TIMES, '08:00')).toMatchObject({
      kind: 'ready',
      wave: { key: 'morning' },
    })
    expect(waveEntry(KEYS, TIMES, '14:00')).toMatchObject({
      kind: 'ready',
      wave: { key: 'midday' },
    })
  })

  it('offers the next wave immediately after a completion instead of waiting on the clock', () => {
    expect(waveEntry(KEYS, TIMES, '08:30', ['morning'])).toMatchObject({
      kind: 'ready',
      wave: { key: 'midday', time: '13:00' },
    })
  })

  it('reports a finished day only when every scheduled wave was persisted as complete', () => {
    expect(waveEntry(KEYS, TIMES, '20:00', ['morning', 'midday'])).toMatchObject({
      kind: 'ready',
      wave: { key: 'evening' },
    })
    expect(waveEntry(KEYS, TIMES, '20:00', KEYS)).toEqual({ kind: 'complete' })
  })

  it('keeps an earlier persisted gap resumable after a later wave is complete', () => {
    expect(waveEntry(KEYS, TIMES, '20:00', ['evening'])).toMatchObject({
      kind: 'ready',
      wave: { key: 'midday' },
    })
  })
})

describe('waveEntryWithResume', () => {
  const paused = { session: { id: 'session' }, wave: 'morning' as const, done: false }

  it('keeps a valid paused wave authoritative after a later wave opens', () => {
    expect(waveEntryWithResume(KEYS, TIMES, '13:00', [], paused)).toEqual({
      kind: 'resume',
      wave: 'morning',
    })
  })

  it('keeps a paused wave after listen-quota completion and preserves safe legacy fallback', () => {
    expect(waveEntryWithResume(KEYS, TIMES, '13:00', ['morning'], paused)).toEqual({
      kind: 'resume',
      wave: 'morning',
    })
    expect(
      waveEntryWithResume(KEYS, TIMES, '13:00', [], { session: { id: 'legacy' }, done: false }),
    ).toEqual({ kind: 'resume', wave: 'midday' })
  })
})
