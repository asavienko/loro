import { describe, expect, it } from 'vitest'
import {
  isPressableUnavailable,
  resolveForcedInteractionState,
  resolvePressScale,
  scaleTextStyle,
} from './runtimeStyles'

describe('runtime inspection styles', () => {
  it('scales glyph metrics while leaving unrelated layout values unchanged', () => {
    expect(
      scaleTextStyle({ fontSize: 17, lineHeight: 24, letterSpacing: 0.2, marginTop: 8 }, 2),
    ).toEqual({ fontSize: 34, lineHeight: 48, letterSpacing: 0.4, marginTop: 8 })
  })

  it('preserves the authored style object at the default text scale', () => {
    const style = { fontSize: 17, lineHeight: 24 }
    expect(scaleTextStyle(style, 1)).toBe(style)
  })

  it('suppresses spatial press feedback when reduced motion is active', () => {
    expect(
      resolvePressScale({ pressed: true, disabled: false, reducedMotion: true, scale: 0.98 }),
    ).toBeNull()
    expect(
      resolvePressScale({ pressed: true, disabled: false, reducedMotion: false, scale: 0.98 }),
    ).toBe(0.98)
  })

  it('holds the real pressed and focused feedback for a specimen without enabling it', () => {
    expect(resolveForcedInteractionState('pressed-focused')).toEqual({
      pressed: true,
      focused: true,
    })
    expect(resolveForcedInteractionState(undefined)).toEqual({ pressed: false, focused: false })
  })

  it('treats loading as unavailable independently of an explicit disabled prop', () => {
    expect(isPressableUnavailable(false, false)).toBe(false)
    expect(isPressableUnavailable(true, false)).toBe(true)
    expect(isPressableUnavailable(false, true)).toBe(true)
  })
})
