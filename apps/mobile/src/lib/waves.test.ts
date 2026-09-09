import { describe, expect, it } from 'vitest'
import { waveEntry, waveSchedule } from './waves'

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

describe('waveEntry', () => {
  it('locks entry before the first scheduled wave while retaining the next wave', () => {
    expect(waveEntry(KEYS, TIMES, '07:59')).toMatchObject({
      kind: 'locked',
      next: { key: 'morning', time: '08:00' },
    })
  })

  it('opens a wave exactly at its time and moves missed work to the latest open wave', () => {
    expect(waveEntry(KEYS, TIMES, '08:00')).toMatchObject({ kind: 'ready', wave: { key: 'morning' } })
    expect(waveEntry(KEYS, TIMES, '14:00')).toMatchObject({ kind: 'ready', wave: { key: 'midday' } })
  })

  it('does not re-open a persisted completion and waits for the next scheduled wave', () => {
    expect(waveEntry(KEYS, TIMES, '08:30', ['morning'])).toMatchObject({
      kind: 'locked',
      next: { key: 'midday', time: '13:00' },
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
