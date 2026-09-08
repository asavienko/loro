import type { TextStyle } from 'react-native'
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
