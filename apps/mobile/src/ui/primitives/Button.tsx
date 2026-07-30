/**
 * The full-width action button. Three variants, two sizes, and the disabled look is its own
 * pairing.
 */

import { StyleSheet } from 'react-native'
import { MIN_TAP, accent, ink, line, onDark, radius, semantic, space, surface } from '../theme'
import { Pressable } from './Pressable'
import { Text } from './Text'

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled,
  accessibilityHint,
}: {
  label: string
  onPress?: (() => void) | undefined
  variant?: 'primary' | 'secondary' | 'destructive' | undefined
  /**
   * `lg` is the Refrain's rep button — the one control the whole screen exists for, at 56 px with
   * `title3` on it. Everything else is `md`, whose floor is `MIN_TAP`.
   */
  size?: 'md' | 'lg' | undefined
  disabled?: boolean | undefined
  accessibilityHint?: string | undefined
}) {
  const bg = disabled === true ? line.default : variant === 'primary' ? accent.accent : surface.card
  const fg =
    disabled === true
      ? ink.muted
      : variant === 'primary'
        ? onDark.primary
        : variant === 'destructive'
          ? semantic.danger.text
          : ink.ink2

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      style={[
        s.button,
        size === 'lg' ? s.lg : null,
        { backgroundColor: bg },
        variant !== 'primary' ? { borderWidth: 1, borderColor: line.strong } : null,
      ]}
    >
      {/* >=17px semibold on the accent fill — the contrast floor for white on accent. */}
      <Text
        variant={size === 'lg' ? 'title3' : 'body'}
        color={fg}
        align={size === 'lg' ? undefined : 'center'}
      >
        {label}
      </Text>
    </Pressable>
  )
}

const s = StyleSheet.create({
  button: {
    minHeight: MIN_TAP,
    paddingVertical: 15,
    paddingHorizontal: space['4'],
    borderRadius: radius.lg,
    justifyContent: 'center',
  },
  /**
   * The Refrain's rep button, exactly as that screen draws it: a 56 px box with NO padding of its
   * own, so the label centres in the box rather than inside a padded box. Zeroing `md`'s padding
   * is deliberate — with 16 px of horizontal padding a long mode label ("Say it cold") would wrap
   * one text-scale step earlier and the button would grow to two lines.
   */
  lg: { minHeight: 56, paddingVertical: 0, paddingHorizontal: 0, alignItems: 'center' },
})
