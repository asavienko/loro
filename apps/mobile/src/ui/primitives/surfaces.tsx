/**
 * The surfaces a screen is built on: the screen itself, the two cards, the divider.
 */

import type { ReactNode } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { stationeryElevation } from '../elevation'
import { border as borderToken, line, radius, space, surface } from '../theme'

export function Screen({ children }: { children: ReactNode }) {
  return <View style={s.screen}>{children}</View>
}

/**
 * A resting stationery card: v1.2 keyline (`line.default`) plus the contact shadow.
 *
 * The four appearance props default to exactly what `Card` used to hardcode, so every existing
 * call site is unaffected. They exist because a dozen bordered boxes across the screens are the
 * same surface at a different radius or with a heavier border — the add sheet's focused search
 * field, phrase detail's word cards — and each was hand-rolling the whole style.
 *
 * Elevation comes from `stationeryElevation`: the generated CSS recipe on web, a token-derived
 * RN shadow on iOS/Android. Caller `overflow: 'hidden'` is lifted onto an inner clip so it
 * cannot swallow the native contact shadow.
 */
export function Card({
  padding = space['3.5'],
  radius: corner = radius.xl,
  background = surface.card,
  border = line.default,
  borderWidth = borderToken.hairline,
  elevate = true,
  children,
  style,
  accessible,
  accessibilityLabel,
}: {
  padding?: number | undefined
  radius?: number | undefined
  background?: string | undefined
  /** A border colour, or `false` to rest on shadow alone (sunken wells, nested cards). */
  border?: string | false | undefined
  borderWidth?: number | undefined
  /** Resting stationery contact shadow. Off for nested/transparent cards. */
  elevate?: boolean | undefined
  children: ReactNode
  style?: StyleProp<ViewStyle>
  /** Set both together when the card's contents only make sense read as one phrase. */
  accessible?: boolean | undefined
  accessibilityLabel?: string | undefined
}) {
  const flat = style == null ? undefined : StyleSheet.flatten(style)
  const overflow = flat?.overflow
  const rest = overflow === undefined || flat === undefined ? style : omitOverflow(flat)
  return (
    <View
      style={[
        elevate && background !== 'transparent' ? stationeryElevation('card') : null,
        {
          backgroundColor: background,
          borderRadius: corner,
          padding,
          ...(border === false ? null : { borderWidth, borderColor: border }),
        },
        rest,
      ]}
      accessible={accessible}
      accessibilityLabel={accessibilityLabel}
      aria-label={accessibilityLabel}
    >
      {overflow === undefined ? (
        children
      ) : (
        <View style={{ overflow, borderRadius: corner }}>{children}</View>
      )}
    </View>
  )
}

function omitOverflow(style: ViewStyle): ViewStyle {
  const rest = { ...style }
  delete rest.overflow
  return rest
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
    padding: space['6'],
    ...stationeryElevation('float'),
  },
  divider: { height: 1, backgroundColor: line.subtle },
})
