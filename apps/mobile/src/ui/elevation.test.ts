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
      spread: 0,
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
    expect(nativeStationeryShadow(shadow.methodInset)).toEqual({})
  })

  it('reads the v1.3 Stream focused play glow as a terracotta 6/18 layer', () => {
    expect(parseStationeryShadow(shadow.playGlow)).toMatchObject({
      offsetX: 0,
      offsetY: 6,
      blur: 18,
      r: 191,
      g: 84,
      b: 44,
      opacity: 0.35,
    })
  })

  it('reads the v1.3 Review mini-player as a warm 25/50 layer', () => {
    expect(parseStationeryShadow(shadow.playerFloat)).toMatchObject({
      offsetX: 0,
      offsetY: 25,
      blur: 50,
      r: 35,
      g: 30,
      b: 24,
      opacity: 0.25,
    })
  })

  it('reads the v1.3 Review dock float as a warm 8/24 layer', () => {
    expect(parseStationeryShadow(shadow.dockFloat)).toMatchObject({
      offsetX: 0,
      offsetY: 8,
      blur: 24,
      r: 35,
      g: 30,
      b: 24,
      opacity: 0.3,
    })
  })

  it('keeps the v1.3 terracotta glow pigment from the recipe', () => {
    expect(nativeStationeryShadow(shadow.accentGlow)).toMatchObject({
      shadowColor: '#c85a32',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
    })
    expect(nativeStationeryShadow(shadow.accentGlowStay)).toMatchObject({
      shadowColor: '#c85a32',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 6,
    })
  })

  it('parses every generated recipe', () => {
    for (const recipe of Object.values(shadow)) {
      expect(() => parseStationeryShadow(recipe)).not.toThrow()
    }
  })

  it('reads the v1.3 emblem badge as a warm dual-layer shadow-md', () => {
    expect(parseStationeryShadowLayers(shadow.emblemRaised)).toEqual([
      {
        inset: false,
        offsetX: 0,
        offsetY: 4,
        blur: 6,
        spread: 0,
        r: 35,
        g: 30,
        b: 24,
        opacity: 0.1,
      },
      {
        inset: false,
        offsetX: 0,
        offsetY: 2,
        blur: 4,
        spread: 0,
        r: 35,
        g: 30,
        b: 24,
        opacity: 0.1,
      },
    ])
  })

  it('reads the raised interactive dual recipe as two layers', () => {
    expect(parseStationeryShadowLayers(shadow.interactive)).toEqual([
      {
        inset: false,
        offsetX: 0,
        offsetY: 4,
        blur: 16,
        spread: 0,
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
        spread: 0,
        r: 35,
        g: 30,
        b: 24,
        opacity: 0.04,
      },
    ])
  })

  it('reads the v1.3 selected stage-pill ring-2 as a 2px primary-fixed spread', () => {
    expect(parseStationeryShadowLayers(shadow.pillRing)).toEqual([
      {
        inset: false,
        offsetX: 0,
        offsetY: 0,
        blur: 0,
        spread: 2,
        r: 255,
        g: 219,
        b: 208,
        opacity: 0.4,
      },
    ])
    expect(nativeStationeryShadow(shadow.pillRing)).toEqual({
      outlineWidth: 2,
      outlineColor: 'rgba(255,219,208,0.4)',
      outlineStyle: 'solid',
    })
    expect(nativeStationeryShadow(`${shadow.playRaised}, ${shadow.pillRing}`)).toMatchObject({
      shadowOffset: { width: 0, height: 10 },
      shadowRadius: 15,
      outlineWidth: 2,
    })
  })

  it('reads the v1.3 selected rate-pill ring-2 as a 2px full primary-fixed spread', () => {
    expect(parseStationeryShadowLayers(shadow.rateRing)).toEqual([
      {
        inset: false,
        offsetX: 0,
        offsetY: 0,
        blur: 0,
        spread: 2,
        r: 255,
        g: 219,
        b: 208,
        opacity: 1,
      },
    ])
    expect(nativeStationeryShadow(shadow.rateRing)).toEqual({
      outlineWidth: 2,
      outlineColor: 'rgba(255,219,208,1)',
      outlineStyle: 'solid',
    })
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
