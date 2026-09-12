import type { TextStyle } from 'react-native'
import { DEBOSS_TRANSLATE_Y } from './stationeryShadow'
import type { TextScale } from './themeContext'

/** Text-only inspection scaling: geometry outside the glyph's own metrics stays unchanged. */
export function scaleTextStyle(style: TextStyle, scale: TextScale): TextStyle {
  if (scale === 1) return style
  return {
    ...style,
    ...(typeof style.fontSize === 'number' ? { fontSize: style.fontSize * scale } : null),
    ...(typeof style.lineHeight === 'number' ? { lineHeight: style.lineHeight * scale } : null),
    ...(typeof style.letterSpacing === 'number'
      ? { letterSpacing: style.letterSpacing * scale }
      : null),
  }
}

/** A reduced-motion press keeps colour/opacity feedback but removes spatial movement. */
export function resolvePressScale({
  pressed,
  disabled,
  reducedMotion,
  scale,
}: {
  pressed: boolean
  disabled: boolean
  reducedMotion: boolean
  scale: number
}): number | null {
  return pressed && !disabled && !reducedMotion ? scale : null
}

/** DESIGN.md stationery / primary press: 1px settle, no movement under Reduce Motion. */
export function resolveDeboss({
  pressed,
  disabled,
  reducedMotion,
}: {
  pressed: boolean
  disabled: boolean
  reducedMotion: boolean
}): { translateY: number; shadowT: number } {
  if (!pressed || disabled || reducedMotion) return { translateY: 0, shadowT: 0 }
  return { translateY: DEBOSS_TRANSLATE_Y, shadowT: 1 }
}

/** Ghost/tertiary: native is a static underline; web expands a 1px rule from the centre. */
export function ghostUnderlineStyle({
  color,
  expanded,
  reducedMotion,
  web,
  durationMs,
  easing,
}: {
  color: string
  expanded: boolean
  reducedMotion: boolean
  web: boolean
  durationMs: number
  easing: string
}): TextStyle {
  if (!web) return { textDecorationLine: 'underline' }
  return {
    textDecorationLine: 'none',
    ...({
      backgroundImage: `linear-gradient(${color}, ${color})`,
      backgroundPosition: 'center bottom',
      backgroundRepeat: 'no-repeat',
      backgroundSize: expanded ? '100% 1px' : '0% 1px',
      transitionProperty: 'background-size',
      transitionDuration: reducedMotion ? '0ms' : `${durationMs}ms`,
      transitionTimingFunction: easing,
    } as TextStyle),
  }
}

/**
 * A specimen may hold the same visual feedback a real control has while it is pressed and
 * focused. It deliberately changes presentation only; it never makes a control actionable.
 */
export function resolveForcedInteractionState(forcedState: 'pressed-focused' | undefined): {
  pressed: boolean
  focused: boolean
} {
  return forcedState === 'pressed-focused'
    ? { pressed: true, focused: true }
    : { pressed: false, focused: false }
}

/** A pending action is unavailable until it settles, even when its caller did not set disabled. */
export function isPressableUnavailable(disabled: boolean, loading: boolean): boolean {
  return disabled || loading
}
