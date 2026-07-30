/**
 * The surfaces a screen is built on: the screen itself, the two cards, the divider.
 */

import type { ReactNode } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { line, radius, space, surface } from '../theme'

export function Screen({ children }: { children: ReactNode }) {
  return <View style={s.screen}>{children}</View>
}

export function Card({
  padding = space['3.5'],
  children,
  style,
  accessible,
  accessibilityLabel,
}: {
  padding?: number | undefined
  children: ReactNode
  style?: StyleProp<ViewStyle>
  /** Set both together when the card's contents only make sense read as one phrase. */
  accessible?: boolean | undefined
  accessibilityLabel?: string | undefined
}) {
  return (
    <View
      style={[s.card, { padding }, style]}
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
  card: {
    backgroundColor: surface.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: line.default,
  },
  darkCard: {
    backgroundColor: surface.dark,
    borderRadius: radius['3xl'],
    padding: space['5'],
  },
  divider: { height: 1, backgroundColor: line.subtle },
})
