/**
 * Text, and the components that are only text: the section label, its header, a chart's summary.
 */

import { currentNativeLanguage, currentTargetLocale, useLocale } from '../../lib/i18n'
import type { NativeLanguage, TargetLocale } from '@loro/core'
import { Platform } from 'react-native'
import type { ReactNode } from 'react'
import { StyleSheet, Text as RNText, type StyleProp, type TextStyle } from 'react-native'
import { scaleTextStyle } from '../runtimeStyles'
import { ink, space, type, type TypeVariant } from '../theme'
import { useTheme } from '../ThemeProvider'

export type { TypeVariant }

export function Text({
  variant = 'caption',
  color = ink.ink2,
  align,
  lang,
  numberOfLines,
  style,
  children,
}: {
  // `| undefined` on every optional prop, deliberately — the same reason it is spelled out on
  // `Pressable`. Under `exactOptionalPropertyTypes` a bare `?:` means "absent", not "may be
  // undefined", so a composite forwarding its own optional prop (`PhraseRow` → `Text`) would not
  // typecheck. Widening at the point props are RECEIVED keeps the strict setting everywhere else,
  // where it catches real bugs.
  variant?: TypeVariant | undefined
  color?: string | undefined
  align?: 'left' | 'center' | 'right' | undefined
  /**
   * Set `lang="es"` on ALL Spanish text. Without it a screen reader pronounces it
   * in English and mangles it — the highest-impact a11y detail in the app.
   */
  lang?: 'target' | 'es' | NativeLanguage | TargetLocale | undefined
  numberOfLines?: number | undefined
  style?: StyleProp<TextStyle>
  children: ReactNode
}) {
  useLocale()
  const language =
    lang === 'target' || lang === 'es' ? currentTargetLocale() : (lang ?? currentNativeLanguage())
  const { textScale } = useTheme()
  const resolvedStyle = StyleSheet.flatten([
    type[variant],
    { color },
    align ? { textAlign: align } : null,
    style,
  ])
  return (
    <RNText
      accessibilityLanguage={language}
      {...(Platform.OS === 'web' ? { lang: language } : {})}
      numberOfLines={numberOfLines}
      style={scaleTextStyle(resolvedStyle, textScale)}
    >
      {children}
    </RNText>
  )
}

/**
 * The uppercase label above a section, and the same treatment one step down.
 *
 * `size="sm"` is `labelSm` — the 10 px form. It is a size and not a second component because
 * fourteen places in the app wrote `<Text variant="labelSm" color={ink.muted}>` by hand, which is
 * this component with a different step of the scale.
 */
export function SectionLabel({
  size = 'md',
  color = ink.muted,
  children,
}: {
  size?: 'md' | 'sm' | undefined
  color?: string | undefined
  children: ReactNode
}) {
  return (
    <Text variant={size === 'sm' ? 'labelSm' : 'label'} color={color}>
      {children}
    </Text>
  )
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
