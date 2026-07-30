/**
 * The full-width action button. Three variants, and the disabled look is its own pairing.
 */

import { StyleSheet } from 'react-native'
import { MIN_TAP, accent, ink, line, onDark, radius, semantic, space, surface } from '../theme'
import { Pressable } from './Pressable'
import { Text } from './Text'

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  accessibilityHint,
}: {
  label: string
  onPress?: (() => void) | undefined
  variant?: 'primary' | 'secondary' | 'destructive' | undefined
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
        { backgroundColor: bg },
        variant !== 'primary' ? { borderWidth: 1, borderColor: line.strong } : null,
      ]}
    >
      {/* >=17px semibold on the accent fill — the contrast floor for white on accent. */}
      <Text variant="body" color={fg} align="center">
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
})
