/**
 * `IconButton` — a glyph or an emoji with a real accessibility label.
 *
 * Four screens wrote this by hand and the label is the reason it is worth a component: a glyph has
 * no accessible name of its own, so `◄◄` announces as "left-pointing double triangle" or as nothing
 * at all. The label is required here, not optional.
 *
 * The 44×44 floor comes from `Pressable`'s `feedback="icon"`, which is where the number lives —
 * these buttons are sized by their glyph and rendered as little as 17×23 without it, which
 * `scripts/a11yChecks.ts` cannot see because nothing declares a width.
 */

import { ActivityIndicator, type StyleProp, type ViewStyle } from 'react-native'
import { Pressable } from './Pressable'
import { Text, type TypeVariant } from './Text'

export function IconButton({
  glyph,
  label,
  onPress,
  loading,
  forcedState,
  color,
  variant = 'headline',
  style,
}: {
  glyph: string
  /** Required: the accessible name. A glyph carries none. */
  label: string
  onPress: () => void
  /** Shows pending feedback while the underlying action is unavailable. */
  loading?: boolean | undefined
  /** Holds the real pressed/focused presentation for an inspection specimen. */
  forcedState?: 'pressed-focused' | undefined
  color?: string | undefined
  /** The glyph's step on the type scale. `title3` for the chevrons, `headline` for the rest. */
  variant?: TypeVariant | undefined
  /** For a call site that needs asymmetric padding — onboarding's back chevron. */
  style?: StyleProp<ViewStyle> | undefined
}) {
  return (
    <Pressable
      feedback="icon"
      accessibilityLabel={label}
      onPress={onPress}
      loading={loading}
      forcedState={forcedState}
      style={style}
    >
      {loading ? (
        <ActivityIndicator color={color} accessible={false} />
      ) : (
        <Text variant={variant} color={color}>
          {glyph}
        </Text>
      )}
    </Pressable>
  )
}
