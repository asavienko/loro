/**
 * `PhraseRow` — the bilingual row every list in the app is made of.
 *
 * ── The rules it exists to hold ──
 * • ONE focusable element. The row is the button; whatever `trailing` renders must not be a
 *   second tab stop (accessibility.md#every-phrase-row).
 * • The Spanish line carries `lang="es"`, always. A screen reader that reads it in English
 *   mangles it, and that is the highest-impact accessibility detail in the app.
 * • Both lines ellipsise at one line, so a long phrase cannot reflow the row.
 * • The label is the CALLER's, because it differs by list: the stream announces the
 *   difficulty too, Add announces only the phrase.
 *
 * ── Why not a `phrase` prop ──
 * The two lists it serves hold different types — Add maps over `CatalogPhrase`, the stream
 * over the store's view — and their only common ground is these three strings. Taking the
 * strings keeps the component out of the business of knowing which id space it was handed.
 */

import type { ReactNode } from 'react'
import { View } from 'react-native'
import { Pressable, Text } from '../primitives'
import { border, ink, line, phraseRow, radius, surface } from '../theme'

export function PhraseRow({
  es,
  en,
  emoji,
  variant = 'queue',
  onPress,
  accessibilityLabel,
  accessibilityHint,
  trailing,
}: {
  es: string
  en: string
  emoji: string
  /** `queue` is the stream's "up next"; `suggestion` is Add's list — a step larger. */
  variant?: keyof typeof phraseRow | undefined
  onPress: () => void
  accessibilityLabel: string
  accessibilityHint?: string | undefined
  /** The row's right-hand slot: a difficulty pill, an add affordance. Not focusable. */
  trailing?: ReactNode
}) {
  const m = phraseRow[variant]

  return (
    <Pressable
      feedback="row"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: m.gap,
        backgroundColor: surface.card,
        borderWidth: border.hairline,
        borderColor: line.default,
        borderRadius: radius.lg,
        padding: m.padding,
      }}
    >
      <Text style={{ fontSize: m.emojiSize }}>{emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text
          variant={variant === 'suggestion' ? 'bodySm' : 'caption'}
          color={ink.ink}
          numberOfLines={1}
          lang="es"
        >
          {es}
        </Text>
        <Text variant="captionSm" color={ink.muted} numberOfLines={1}>
          {en}
        </Text>
      </View>
      {trailing}
    </Pressable>
  )
}
