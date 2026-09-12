/**
 * The full-width action button. Four variants, two sizes, and the disabled look is its own
 * pairing.
 */

import { useState } from 'react'
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native'
import { stationeryElevation } from '../elevation'
import { pressScale } from '../motion'
import { ghostUnderlineStyle } from '../runtimeStyles'
import { MIN_TAP, ink, line, motion, radius, semantic, space, surface } from '../theme'
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
  forcedHover,
  accessibilityHint,
}: {
  label: string
  onPress?: (() => void) | undefined
  variant?: 'primary' | 'secondary' | 'destructive' | 'ghost' | undefined
  /**
   * `lg` is the 56 px `title3` control with no own padding. `cta` is the v1.2 primary pill
   * (Refrain's rep, Today, Account). Everything else is `md`, whose floor is `MIN_TAP`.
   */
  size?: 'md' | 'lg' | 'cta' | undefined
  disabled?: boolean | undefined
  /** Shows pending feedback while the underlying action is unavailable. */
  loading?: boolean | undefined
  /** Holds the real pressed/focused presentation for an inspection specimen. */
  forcedState?: 'pressed-focused' | undefined
  /** Holds the ghost hover underline for an inspection specimen. */
  forcedHover?: boolean | undefined
  accessibilityHint?: string | undefined
}) {
  const { accent, reducedMotion } = useTheme()
  const [hovered, setHovered] = useState(false)
  const ghost = variant === 'ghost'
  const primary = variant === 'primary' && disabled !== true
  const bg = ghost
    ? 'transparent'
    : disabled === true
      ? line.default
      : variant === 'primary'
        ? accent.accent
        : variant === 'destructive'
          ? surface.card
          : surface.track
  const fg =
    disabled === true
      ? ink.muted
      : variant === 'primary'
        ? surface.app
        : variant === 'destructive'
          ? semantic.danger.text
          : ghost
            ? accent.accentInk
            : ink.ink
  const ghostUnderline = ghostUnderlineStyle({
    color: fg,
    expanded:
      Platform.OS !== 'web' ||
      hovered ||
      forcedHover === true ||
      forcedState === 'pressed-focused' ||
      disabled === true,
    reducedMotion,
    web: Platform.OS === 'web',
    durationMs: pressScale('button').durationMs,
    easing: motion.easing.press.value,
  })

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      loading={loading}
      forcedState={forcedState}
      pressMotion={primary ? 'deboss' : 'scale'}
      elevation={primary ? 'raised' : undefined}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      onHoverIn={
        ghost
          ? () => {
              setHovered(true)
            }
          : undefined
      }
      onHoverOut={
        ghost
          ? () => {
              setHovered(false)
            }
          : undefined
      }
      style={[
        s.button,
        size === 'lg' ? s.lg : null,
        size === 'cta' ? s.cta : null,
        { backgroundColor: bg },
        variant === 'destructive' ? { borderWidth: 1.5, borderColor: line.strong } : null,
        ghost ? s.ghost : null,
        primary ? stationeryElevation('raised') : null,
      ]}
    >
      {/* >=17px semibold on the accent fill — the contrast floor for white on accent. */}
      {loading ? (
        <ActivityIndicator color={fg} accessible={false} />
      ) : ghost ? (
        <View style={s.ghostInner} pointerEvents="none">
          <Text
            variant={size === 'lg' ? 'title3' : 'body'}
            color={fg}
            style={ghostUnderline}
            align="center"
          >
            {label}
          </Text>
        </View>
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
    borderRadius: radius.pill,
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
   * v1.2 primary docked CTA: 56 px, fully rounded pill (`DESIGN.md` primary action).
   */
  cta: { minHeight: 56, borderRadius: radius.pill, paddingVertical: 0, alignItems: 'center' },
  ghost: { backgroundColor: 'transparent', paddingVertical: space['2'], alignItems: 'center' },
  /**
   * Shrink-wraps the label so the 1px hover underline is the glyph width, not the 44 px target.
   * The Pressable keeps `MIN_TAP`; this wrapper is not the hit target.
   */
  ghostInner: {
    alignSelf: 'center',
    maxWidth: '100%',
    ...(Platform.OS === 'web' ? { width: 'fit-content' as unknown as number } : null),
  },
})
