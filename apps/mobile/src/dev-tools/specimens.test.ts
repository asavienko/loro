import { describe, expect, it } from 'vitest'
import {
  PENDING_NAVIGATION_SPECIMENS,
  PLAN_80_PENDING_NAVIGATION,
  PRODUCTION_COMPONENT_NAMES,
  SPECIMEN_STATE_MATRIX,
} from './specimenContract'

describe('production specimen registry', () => {
  it('DEV-SPECIMENS-01 registers every production component name once', () => {
    expect(new Set(PRODUCTION_COMPONENT_NAMES).size).toBe(PRODUCTION_COMPONENT_NAMES.length)
  })

  it('DEV-SPECIMENS-02 explicitly classifies every required state', () => {
    expect(new Set(SPECIMEN_STATE_MATRIX.map((state) => state.id)).size).toBe(
      SPECIMEN_STATE_MATRIX.length,
    )
    expect(SPECIMEN_STATE_MATRIX.find((state) => state.id === 'loading')).toEqual({
      id: 'loading',
      status: 'available',
    })
    expect(SPECIMEN_STATE_MATRIX.find((state) => state.id === 'pressed-focused')).toEqual({
      id: 'pressed-focused',
      status: 'available',
    })
  })

  it('DEV-SPECIMENS-03 reports the exact plan-80 navigation entries as pending plan 81', () => {
    expect(PENDING_NAVIGATION_SPECIMENS.map((entry) => entry.name)).toEqual([
      'Spine',
      'ScreenHeader',
      'SwitcherSheet',
      'ExitSheet',
      'ResumeStrip',
      'TransportStrip',
    ])
    expect(PENDING_NAVIGATION_SPECIMENS.map((entry) => entry.status)).toEqual(
      PLAN_80_PENDING_NAVIGATION.map(() => 'pending-plan-81'),
    )
    expect(PENDING_NAVIGATION_SPECIMENS).toHaveLength(PLAN_80_PENDING_NAVIGATION.length)
  })
})
