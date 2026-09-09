/**
 * The one pressable. Every tappable thing in the app goes through it.
 *
 * ── Accessibility props are set in BOTH forms, on purpose ──
 * The full explanation is at the top of `./index.ts`. The short version: react-native-web
 * reads the FLAT `aria-*` props and ignores nested `accessibilityState` entirely, so
 * `accessibilityState={{ checked }}` alone announced nothing on web, while the nested form
 * is the canonical one on iOS and Android. Both are set. When adding an accessibility prop
 * here, check it against `react-native-web/src/modules/createDOMProps/index.js` — silence is
 * the failure mode.
 */

import { useState, type ReactNode } from 'react'
import { Pressable as RNPressable, type StyleProp, type ViewStyle } from 'react-native'
import {
  isPressableUnavailable,
  resolveForcedInteractionState,
  resolvePressScale,
} from '../runtimeStyles'
import { HIT_SLOP, MIN_TAP, press } from '../theme'
import { useTheme } from '../ThemeProvider'

export function Pressable({
  onPress,
  feedback = 'button',
  disabled,
  loading,
  forcedState,
  selected,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole = 'button',
  style,
  children,
}: {
  // `| undefined` on every optional prop, deliberately. Under
  // `exactOptionalPropertyTypes` a bare `?:` means "absent", not "may be undefined",
  // so a wrapper forwarding its own optional prop (Button → Pressable) would not
  // typecheck. Widening here — the one place props are received — keeps the strict
  // setting everywhere else, where it catches real bugs.
  onPress?: (() => void) | undefined
  feedback?: keyof typeof press | undefined
  disabled?: boolean | undefined
  /**
   * A pending action cannot be activated twice. The control remains named, announces busy, and
   * receives the disabled state on native and web. Wrappers choose the visible busy treatment.
   */
  loading?: boolean | undefined
  /**
   * Holds real press and focus feedback for an inspection specimen. This is presentation-only:
   * it neither focuses the element nor changes its action semantics.
   */
  forcedState?: 'pressed-focused' | undefined
  /**
   * REQUIRED whenever the role is `radio` or `checkbox`.
   *
   * Those roles promise a checked state and this primitive used to have no way to carry
   * one, so every difficulty selector, every onboarding answer, and every tag toggle in
   * the app announced its role and its label and then said nothing about whether it was
   * the chosen one — the selection existed only as a background colour. That is both a
   * WCAG failure (`aria-checked` is required on `role="radio"`) and the thing
   * accessibility.md forbids twice over: "state is in `accessibilityValue`, not appended
   * to the label", and "no information by colour alone".
   */
  selected?: boolean | undefined
  accessibilityLabel?: string | undefined
  accessibilityHint?: string | undefined
  accessibilityRole?: 'button' | 'link' | 'radio' | 'checkbox' | undefined
  style?: StyleProp<ViewStyle> | undefined
  children: ReactNode
}) {
  const { accent, reducedMotion } = useTheme()
  const checkable = accessibilityRole === 'radio' || accessibilityRole === 'checkbox'
  const unavailable = isPressableUnavailable(Boolean(disabled), Boolean(loading))
  const forced = resolveForcedInteractionState(forcedState)
  const [focused, setFocused] = useState(false)
  return (
    <RNPressable
      onPress={onPress}
      disabled={unavailable}
      onFocus={() => {
        setFocused(true)
      }}
      onBlur={() => {
        setFocused(false)
      }}
      accessible
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      // BOTH FORMS, and both are load-bearing. See the note at the top of `./index.ts`:
      // react-native-web reads the flat `aria-*` props and ignores nested
      // `accessibilityState` entirely, while `accessibilityState` is the canonical form a
      // native reader expects. `checked` is emitted only for the roles that define it — a
      // button carrying `aria-checked` is its own violation.
      accessibilityState={{
        disabled: unavailable,
        ...(loading ? { busy: true } : {}),
        ...(checkable ? { checked: Boolean(selected) } : {}),
      }}
      aria-disabled={unavailable}
      {...(loading ? { 'aria-busy': true } : {})}
      {...(checkable ? { 'aria-checked': Boolean(selected) } : {})}
      hitSlop={HIT_SLOP}
      style={({ pressed }) => {
        const activePress = pressed || forced.pressed
        const activeFocus = focused || forced.focused
        const scale = resolvePressScale({
          pressed: activePress,
          disabled: unavailable,
          reducedMotion,
          scale: press[feedback],
        })
        return [
          // An icon button is sized by its glyph, so it gets the 44×44 floor here rather
          // than at each call site. The love toggle on phrase detail rendered 17×23 — 33×39
          // even with `hitSlop` — and `scripts/a11yChecks.ts` could not see it, because that
          // check looks for a DECLARED width or height under 44 and this element declared
          // none. Caller styles come after, so a call site can still be more generous.
          feedback === 'icon' ? iconTapTarget : null,
          style,
          scale === null ? null : { transform: [{ scale }] },
          activeFocus && !unavailable
            ? {
                outlineWidth: 2,
                outlineStyle: 'solid',
                outlineColor: accent.accent,
                outlineOffset: 2,
              }
            : null,
          unavailable ? { opacity: 0.55 } : null,
        ]
      }}
    >
      {children}
    </RNPressable>
  )
}

/** The 44×44 floor for glyph-sized buttons. `MIN_TAP` is the one place the number lives. */
const iconTapTarget = {
  minWidth: MIN_TAP,
  minHeight: MIN_TAP,
  alignItems: 'center',
  justifyContent: 'center',
} as const
