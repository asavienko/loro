/**
 * Design-system primitives. Nothing here knows what a phrase is.
 *
 * See docs/design/component-inventory.md
 */

import type { ReactNode } from 'react'
import {
  Pressable as RNPressable,
  Text as RNText,
  View,
  StyleSheet,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import {
  accent,
  ink,
  line,
  MIN_TAP,
  onDark,
  press,
  radius,
  semantic,
  space,
  surface,
  type,
} from './theme'

// ─────────────────────────────────────────────────────────────────────────────

type TypeVariant = keyof typeof type

export function Text({
  variant = 'caption',
  color = ink.ink2,
  align,
  lang,
  numberOfLines,
  style,
  children,
}: {
  variant?: TypeVariant
  color?: string
  align?: 'left' | 'center' | 'right'
  /**
   * Set `lang="es"` on ALL Spanish text. Without it a screen reader pronounces it
   * in English and mangles it — the highest-impact a11y detail in the app.
   */
  lang?: 'es' | 'en'
  numberOfLines?: number
  style?: StyleProp<TextStyle>
  children: ReactNode
}) {
  return (
    <RNText
      accessibilityLanguage={lang === 'es' ? 'es-ES' : undefined}
      numberOfLines={numberOfLines}
      style={[type[variant], { color }, align ? { textAlign: align } : null, style]}
    >
      {children}
    </RNText>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

export function Pressable({
  onPress,
  feedback = 'button',
  disabled,
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
  accessibilityLabel?: string | undefined
  accessibilityHint?: string | undefined
  accessibilityRole?: 'button' | 'link' | 'radio' | 'checkbox' | undefined
  style?: StyleProp<ViewStyle> | undefined
  children: ReactNode
}) {
  return (
    <RNPressable
      onPress={onPress}
      disabled={disabled}
      accessible
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: Boolean(disabled) }}
      hitSlop={8}
      style={({ pressed }) => [
        style,
        pressed && !disabled ? { transform: [{ scale: press[feedback] }] } : null,
        disabled ? { opacity: 0.55 } : null,
      ]}
    >
      {children}
    </RNPressable>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

export function Card({
  padding = space['3.5'],
  children,
  style,
}: {
  padding?: number
  children: ReactNode
  style?: StyleProp<ViewStyle>
}) {
  return <View style={[s.card, { padding }, style]}>{children}</View>
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

export function Row({
  gap = space['2'],
  align = 'center',
  justify,
  children,
  style,
}: {
  gap?: number
  align?: ViewStyle['alignItems']
  justify?: ViewStyle['justifyContent']
  children: ReactNode
  style?: StyleProp<ViewStyle>
}) {
  return (
    <View
      style={[{ flexDirection: 'row', gap, alignItems: align, justifyContent: justify }, style]}
    >
      {children}
    </View>
  )
}

export function Stack({
  gap = space['3'],
  children,
  style,
}: {
  gap?: number
  children: ReactNode
  style?: StyleProp<ViewStyle>
}) {
  return <View style={[{ gap }, style]}>{children}</View>
}

// ─────────────────────────────────────────────────────────────────────────────

export function Pill({
  label,
  color = ink.muted,
  background = surface.sunken,
}: {
  label: string
  color?: string
  background?: string
}) {
  return (
    <View style={[s.pill, { backgroundColor: background }]}>
      <Text variant="labelSm" color={color}>
        {label}
      </Text>
    </View>
  )
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <Text variant="label" color={ink.muted}>
      {children}
    </Text>
  )
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  accessibilityHint,
}: {
  label: string
  onPress?: () => void
  variant?: 'primary' | 'secondary' | 'destructive'
  disabled?: boolean
  accessibilityHint?: string
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

export function ProgressBar({
  value,
  color = accent.accent,
  height = 6,
  track = line.default,
}: {
  /** 0..1 */
  value: number
  color?: string
  height?: number
  track?: string
}) {
  const pct = Math.max(0, Math.min(1, value)) * 100
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ now: Math.round(pct), min: 0, max: 100 }}
      style={{ height, borderRadius: 2, backgroundColor: track, overflow: 'hidden' }}
    >
      <View style={{ width: `${pct}%`, height: '100%', borderRadius: 2, backgroundColor: color }} />
    </View>
  )
}

export function Dots({
  count,
  filled,
  size = 8,
}: {
  count: number
  filled: number
  size?: number
}) {
  return (
    <Row gap={5}>
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: i < filled ? accent.accent : line.default,
          }}
        />
      ))}
    </Row>
  )
}

export function EmojiTile({ emoji, size = 42 }: { emoji: string; size?: number }) {
  return (
    <View
      // Decorative: the row's label already carries the meaning.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: radius.lg,
        backgroundColor: surface.sunken,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <RNText style={{ fontSize: size * 0.48 }}>{emoji}</RNText>
    </View>
  )
}

export function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <Card padding={space['3.5']} style={{ flex: 1, alignItems: 'center' }}>
      <Text variant="title2" color={ink.ink}>
        {value}
      </Text>
      <Text variant="labelSm" color={ink.muted} align="center" style={{ marginTop: 3 }}>
        {label}
      </Text>
    </Card>
  )
}

export function Divider() {
  return <View style={{ height: 1, backgroundColor: line.subtle }} />
}

/**
 * A chart's text summary. Required beside every chart — the labs' feedback must be
 * available without sight, and it helps everyone.
 * See docs/architecture/accessibility.md#graphs-and-the-labs
 */
export function ChartSummary({ children }: { children: ReactNode }) {
  return (
    <Text variant="captionSm" color={ink.muted} style={{ marginTop: space['2'] }}>
      {children}
    </Text>
  )
}

export function Screen({ children }: { children: ReactNode }) {
  return <View style={s.screen}>{children}</View>
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
  pill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
  },
  button: {
    minHeight: MIN_TAP,
    paddingVertical: 15,
    paddingHorizontal: space['4'],
    borderRadius: radius.lg,
    justifyContent: 'center',
  },
})
