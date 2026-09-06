/**
 * The surfaces a screen is built on: the screen itself, the two cards, the divider.
 */

import type { ReactNode } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { border as borderToken, line, radius, space, surface } from '../theme'

export function Screen({ children }: { children: ReactNode }) {
  return <View style={s.screen}>{children}</View>
}

/**
 * A white surface with a hairline border.
 *
 * The four appearance props default to exactly what `Card` used to hardcode, so every existing
 * call site is unaffected. They exist because a dozen bordered boxes across the screens are the
 * same surface at a different radius or with a heavier border — the add sheet's focused search
 * field, phrase detail's word cards — and each was hand-rolling the whole style.
 *
 * `elevation` from the inventory is deliberately absent: `shadow.*` are CSS shadow STRINGS
 * (`packages/design-tokens/out/tokens.ts:249`), and there is no token→RN mapping for them yet.
 * Adding one is a design-system change, not a refactor.
 */
export function Card({
  padding = space['3.5'],
  radius: corner = radius.xl,
  background = surface.card,
  border = line.default,
  borderWidth = borderToken.hairline,
  children,
  style,
  accessible,
  accessibilityLabel,
}: {
  padding?: number | undefined
  radius?: number | undefined
  background?: string | undefined
  /** A border colour, or `false` for no border at all. */
  border?: string | false | undefined
  borderWidth?: number | undefined
  children: ReactNode
  style?: StyleProp<ViewStyle>
  /** Set both together when the card's contents only make sense read as one phrase. */
  accessible?: boolean | undefined
  accessibilityLabel?: string | undefined
}) {
  return (
    <View
      style={[
        {
          backgroundColor: background,
          borderRadius: corner,
          padding,
          ...(border === false ? null : { borderWidth, borderColor: border }),
        },
        style,
      ]}
      accessible={accessible}
      accessibilityLabel={accessibilityLabel}
      aria-label={accessibilityLabel}
    >
      {children}
    </View>
  )
}

export function DarkCard({
  children,
  style,
}: {
  children: ReactNode
  style?: StyleProp<ViewStyle>
}) {
  return <View style={[s.darkCard, style]}>{children}</View>
}

export function Divider() {
  return <View style={s.divider} />
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: surface.app },
  darkCard: {
    backgroundColor: surface.dark,
    borderRadius: radius['3xl'],
    padding: space['5'],
  },
  divider: { height: 1, backgroundColor: line.subtle },
})
