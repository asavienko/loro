import { describe, expect, it } from 'vitest'
import { shadow, surface } from '@loro/design-tokens'
import {
  formatWebStationeryShadow,
  mixStationeryShadow,
  nativeStationeryShadow,
  parseStationeryShadow,
  parseStationeryShadowLayers,
  reduceStationeryShadow,
} from './stationeryShadow'

describe('parseStationeryShadow', () => {
  it('reads the resting stationery contact recipe', () => {
    expect(parseStationeryShadow(shadow.card)).toEqual({
      inset: false,
      offsetX: 0,
      offsetY: 2,
      blur: 8,
      r: 35,
      g: 30,
      b: 24,
      opacity: 0.04,
    })
  })

  it('reads an inset parchment well', () => {
    expect(parseStationeryShadow(shadow.fieldInset)).toMatchObject({
      inset: true,
      offsetX: 0,
      offsetY: 1,
      blur: 2,
      opacity: 0.05,
    })
  })

  it('rejects a recipe the mapper cannot honour', () => {
    expect(() => parseStationeryShadow('none')).toThrow(/unrecognised stationery shadow/)
  })
})

describe('nativeStationeryShadow', () => {
  it('colours the contact shadow from the recipe pigment, matching shadowInk', () => {
    expect(nativeStationeryShadow(shadow.card)).toEqual({
      shadowColor: surface.shadowInk,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 8,
      elevation: 2,
    })
  })

  it('drops inset wells — RN has no inset shadow', () => {
    expect(nativeStationeryShadow(shadow.fieldInset)).toEqual({})
  })

  it('parses every generated recipe', () => {
    for (const recipe of Object.values(shadow)) {
      expect(() => parseStationeryShadow(recipe)).not.toThrow()
    }
  })

  it('reads the raised interactive dual recipe as two layers', () => {
    expect(parseStationeryShadowLayers(shadow.interactive)).toEqual([
      {
        inset: false,
        offsetX: 0,
        offsetY: 4,
        blur: 16,
        r: 35,
        g: 30,
        b: 24,
        opacity: 0.08,
      },
      {
        inset: false,
        offsetX: 0,
        offsetY: 1,
        blur: 3,
        r: 35,
        g: 30,
        b: 24,
        opacity: 0.04,
      },
    ])
  })
})

describe('reduceStationeryShadow', () => {
  it('settles the resting card recipe to a 1px reduced contact shadow', () => {
    const reduced = reduceStationeryShadow(parseStationeryShadow(shadow.card))
    expect(reduced).toMatchObject({ offsetY: 1, blur: 4, opacity: 0.02 })
    expect(formatWebStationeryShadow(reduced)).toBe(
      `${reduced.offsetX}px ${reduced.offsetY}px ${reduced.blur}px rgba(${reduced.r},${reduced.g},${reduced.b},${reduced.opacity})`,
    )
  })

  it('leaves inset parchment wells unchanged', () => {
    const inset = parseStationeryShadow(shadow.fieldInset)
    expect(reduceStationeryShadow(inset)).toEqual(inset)
  })

  it('mixes toward the pressed recipe at t=1', () => {
    const resting = parseStationeryShadow(shadow.raised)
    const pressed = reduceStationeryShadow(resting)
    expect(mixStationeryShadow(resting, pressed, 1)).toEqual(pressed)
    expect(mixStationeryShadow(resting, pressed, 0)).toEqual(resting)
  })
})
