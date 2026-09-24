import { describe, expect, it } from 'vitest'
import { nextDueIsNow, rhythmBandFromSchedule, waveClockParts } from './rhythm'

describe('rhythmBandFromSchedule', () => {
  it('follows the wave the clock has marked next', () => {
    expect(
      rhythmBandFromSchedule([
        { key: 'morning', position: 'passed' },
        { key: 'midday', position: 'next' },
        { key: 'evening', position: 'later' },
      ]),
    ).toBe('midday')
  })

  it('uses the last real band when nothing is next', () => {
    expect(rhythmBandFromSchedule([{ key: 'evening', position: 'passed' }])).toBe('evening')
  })
})

describe('nextDueIsNow', () => {
  it('is now once the scheduled time has arrived', () => {
    expect(nextDueIsNow('13:00', '13:00')).toBe(true)
    expect(nextDueIsNow('13:00', '12:59')).toBe(false)
  })
})

describe('waveClockParts', () => {
  it('reads the scheduler HH:MM without inventing a slot', () => {
    expect(waveClockParts('08:00')).toEqual({ hour: 8, minute: '00', period: 'am' })
    expect(waveClockParts('13:00')).toEqual({ hour: 1, minute: '00', period: 'pm' })
    expect(waveClockParts('19:00')).toEqual({ hour: 7, minute: '00', period: 'pm' })
    expect(waveClockParts('00:00')).toEqual({ hour: 12, minute: '00', period: 'am' })
    expect(waveClockParts('12:00')).toEqual({ hour: 12, minute: '00', period: 'pm' })
    expect(waveClockParts('not-a-clock')).toBeNull()
  })
})
