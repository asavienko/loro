import { describe, expect, it } from 'vitest'
import { cadenceRateLabel, nextCadenceLoop, nextCadenceRate } from './streamCadence'

describe('nextCadenceLoop', () => {
  it('cycles the real 1–3 play counts', () => {
    expect(nextCadenceLoop(1)).toBe(2)
    expect(nextCadenceLoop(2)).toBe(3)
    expect(nextCadenceLoop(3)).toBe(1)
  })
})

describe('nextCadenceRate', () => {
  it('cycles rates the play API already accepts', () => {
    expect(nextCadenceRate(0.92)).toBe(1)
    expect(nextCadenceRate(1)).toBe(0.8)
    expect(nextCadenceRate(0.8)).toBe(0.92)
  })
})

describe('cadenceRateLabel', () => {
  it('keeps the real tenths and writes 1 as 1.0', () => {
    expect(cadenceRateLabel(0.8)).toBe('0.8')
    expect(cadenceRateLabel(0.92)).toBe('0.92')
    expect(cadenceRateLabel(1)).toBe('1.0')
  })
})
