/**
 * Design-system primitives. Nothing here knows what a phrase is.
 *
 * See docs/design/component-inventory.md
 *
 * ── Accessibility props are set in BOTH forms, on purpose ──
 * react-native-web 0.21 forwards the FLAT `aria-*` props and a handful of deprecated
 * `accessibility*` aliases. It does not read the NESTED objects at all:
 * `accessibilityState` appears nowhere in its `createDOMProps`, and `accessibilityValue`
 * is not mapped either. So on web, `accessibilityState={{ checked }}` and
 * `accessibilityValue={{ now }}` are silently dropped — every radio in the app announced
 * no checked state and every progress bar announced no value, while the source looked
 * correct and the source-scanning gates in `scripts/a11yChecks.ts` had nothing to catch.
 *
 * The nested form is still the canonical one on iOS and Android, so both are set: the
 * object for the platforms the app ships on, the flat `aria-*` for the one the E2E suite
 * can actually inspect. React Native has accepted `aria-*` as aliases since 0.71, so
 * neither form is web-only.
 *
 * When adding an accessibility prop here, check it against
 * `react-native-web/src/modules/createDOMProps/index.js` — silence is the failure mode.
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
  const checkable = accessibilityRole === 'radio' || accessibilityRole === 'checkbox'
  return (
    <RNPressable
      onPress={onPress}
      disabled={disabled}
      accessible
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      // BOTH FORMS, and both are load-bearing. See the note at the top of this file:
      // react-native-web reads the flat `aria-*` props and ignores nested
      // `accessibilityState` entirely, while `accessibilityState` is the canonical form a
      // native reader expects. `checked` is emitted only for the roles that define it — a
      // button carrying `aria-checked` is its own violation.
      accessibilityState={{
        disabled: Boolean(disabled),
        ...(checkable ? { checked: Boolean(selected) } : {}),
      }}
      {...(checkable ? { 'aria-checked': Boolean(selected) } : {})}
      hitSlop={8}
      style={({ pressed }) => [
        // An icon button is sized by its glyph, so it gets the 44×44 floor here rather
        // than at each call site. The love toggle on phrase detail rendered 17×23 — 33×39
        // even with `hitSlop` — and `scripts/a11yChecks.ts` could not see it, because that
        // check looks for a DECLARED width or height under 44 and this element declared
        // none. Caller styles come after, so a call site can still be more generous.
        feedback === 'icon' ? iconTapTarget : null,
        style,
        pressed && !disabled ? { transform: [{ scale: press[feedback] }] } : null,
        disabled ? { opacity: 0.55 } : null,
      ]}
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

// ─────────────────────────────────────────────────────────────────────────────

export function Card({
  padding = space['3.5'],
  children,
  style,
  accessible,
  accessibilityLabel,
}: {
  padding?: number
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

/**
 * A progress bar — either NAMED or invisible to assistive tech, never in between.
 *
 * `role="progressbar"` requires an accessible name, and every bar in the app was
 * announced as an unnamed one with a number. Which of the two is right depends on the
 * caller, and both cases are real here:
 *
 *   • `label` given — the bar carries the signal itself, like the Refrain's automaticity,
 *     which accessibility.md requires be "a progress bar with a percentage".
 *   • `label` omitted — the bar restates something the surrounding row already says. A
 *     Today row's own label is already "…, 0 percent automatic.", so a second unnamed
 *     announcement is noise, and the bar is hidden from the tree rather than left unnamed.
 */
export function ProgressBar({
  value,
  color = accent.accent,
  height = 6,
  track = line.default,
  label,
}: {
  /** 0..1 */
  value: number
  color?: string
  height?: number
  track?: string
  label?: string | undefined
}) {
  const pct = Math.max(0, Math.min(1, value)) * 100
  const rounded = Math.round(pct)
  const semantics =
    label === undefined
      ? ({ 'aria-hidden': true, importantForAccessibility: 'no-hide-descendants' } as const)
      : ({
          accessible: true,
          accessibilityRole: 'progressbar',
          accessibilityLabel: label,
          // Both forms — see the note at the top of this file. The nested
          // `accessibilityValue` is what a native reader reads and what
          // react-native-web silently drops, which is why every bar in the app
          // announced no value at all on web.
          accessibilityValue: { now: rounded, min: 0, max: 100, text: `${rounded}%` },
          'aria-valuenow': rounded,
          'aria-valuemin': 0,
          'aria-valuemax': 100,
          'aria-valuetext': `${rounded}%`,
        } as const)
  return (
    <View
      {...semantics}
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

/**
 * A number with its label.
 *
 * `accessible` with a combined label, the same way the Progress week row groups its seven
 * cells (`app/progress.tsx:120`): read as two separate nodes, a tile announces a bare "2"
 * and then "reps today", and the number arrives before anything says what it counts.
 * Grouping also gives the value a semantic handle, so a test can ask for
 * `getByLabel('reps today: 2')` instead of walking the DOM to find which child holds it.
 */
export function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <Card
      padding={space['3.5']}
      style={{ flex: 1, alignItems: 'center' }}
      accessible
      accessibilityLabel={`${label}: ${value}`}
    >
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
