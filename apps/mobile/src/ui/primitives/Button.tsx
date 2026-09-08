/**
 * The full-width action button. Three variants, two sizes, and the disabled look is its own
 * pairing.
 */

import { ActivityIndicator, Platform, StyleSheet } from 'react-native'
import { MIN_TAP, ink, line, onDark, radius, semantic, space, surface } from '../theme'
import { useTheme } from '../ThemeProvider'
import { Pressable } from './Pressable'
import { Text } from './Text'

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled,
  loading,
  forcedState,
  accessibilityHint,
}: {
  label: string
  onPress?: (() => void) | undefined
  variant?: 'primary' | 'secondary' | 'destructive' | undefined
  /**
   * `lg` is the Refrain's rep button — the one control the whole screen exists for, at 56 px with
   * `title3` on it. `cta` is the v1.1 screen CTA: the single filled control a surface is allowed,
   * at the authored `--cta-h` / `--cta-radius`. Everything else is `md`, whose floor is `MIN_TAP`.
   */
  size?: 'md' | 'lg' | 'cta' | undefined
  disabled?: boolean | undefined
  /** Shows pending feedback while the underlying action is unavailable. */
  loading?: boolean | undefined
  /** Holds the real pressed/focused presentation for an inspection specimen. */
  forcedState?: 'pressed-focused' | undefined
  accessibilityHint?: string | undefined
}) {
  const { accent } = useTheme()
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
      loading={loading}
      forcedState={forcedState}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      style={[
        s.button,
        size === 'lg' ? s.lg : null,
        size === 'cta' ? s.cta : null,
        { backgroundColor: bg },
        variant !== 'primary' ? { borderWidth: 1, borderColor: line.strong } : null,
      ]}
    >
      {/* >=17px semibold on the accent fill — the contrast floor for white on accent. */}
      {loading ? (
        <ActivityIndicator color={fg} accessible={false} />
      ) : (
        <Text
          variant={size === 'lg' ? 'title3' : 'body'}
          color={fg}
          // F-08: web text-only zoom must grow multiline CTA line boxes with the glyphs.
          style={size === 'cta' && Platform.OS === 'web' ? { lineHeight: undefined } : undefined}
          align={size === 'lg' ? undefined : 'center'}
        >
          {label}
        </Text>
      )}
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
  /**
   * The v1.1 screen CTA, at the authored navigation tokens: `--cta-h: 56px` and
   * `--cta-radius: 22px` (`design/…/tokens/navigation.css`). Rounder and taller than `md`
   * because the design system allows exactly one filled control per screen and this is it.
   * `body` text, not `lg`'s `title3`: the authored CTA label is 15 px
   * (`Navigation.dc.html:160`).
   */
  cta: { minHeight: 56, borderRadius: 22, paddingVertical: 0, alignItems: 'center' },
})
