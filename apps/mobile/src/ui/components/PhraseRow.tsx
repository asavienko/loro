/**
 * `PhraseRow` — the bilingual row every list in the app is made of.
 *
 * ── The rules it exists to hold ──
 * • ONE focusable element. The row is the button; whatever `trailing` renders must not be a
 *   second tab stop (accessibility.md#every-phrase-row).
 * • The Spanish line carries `lang="target"`, always. A screen reader that reads it in English
 *   mangles it, and that is the highest-impact accessibility detail in the app.
 * • Both languages wrap, so narrow screens and enlarged text do not hide the phrase to learn.
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
import { stationeryElevation } from '../elevation'
import { ink, line, phraseRow, radius, space, surface, type as typeScale } from '../theme'

// Reserve most of the row for language; an enlarged badge must wrap before squeezing it.
const PHRASE_TEXT_BASIS = '60%'

export function PhraseRow({
  targetText,
  translation,
  emoji,
  eyebrow,
  variant = 'queue',
  onPress,
  accessibilityLabel,
  accessibilityHint,
  trailing,
}: {
  targetText: string
  translation: string
  emoji: string
  /** Optional real catalog meta above the phrase — Discover's theme, never invented rank. */
  eyebrow?: string | undefined
  /** `queue` is Stream "up next"; `suggestion` is Add's list. Both are stationery cards. */
  variant?: keyof typeof phraseRow | undefined
  onPress: () => void
  accessibilityLabel: string
  accessibilityHint?: string | undefined
  /** The row's right-hand slot: a difficulty pill, an add affordance. Not focusable. */
  trailing?: ReactNode
}) {
  const m = phraseRow[variant]
  const suggestion = variant === 'suggestion'
  const hasEyebrow = eyebrow !== undefined && eyebrow.length > 0
  return (
    <Pressable
      feedback="row"
      pressMotion="deboss"
      elevation="card"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={{
        gap: m.gap,
        backgroundColor: surface.card,
        borderRadius: radius.xl,
        padding: m.padding,
        borderWidth: 1,
        borderColor: line.default,
        ...stationeryElevation('card'),
      }}
    >
      {hasEyebrow ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space['1.5'] }}>
          {emoji.length > 0 ? <Text style={{ fontSize: m.emojiSize }}>{emoji}</Text> : null}
          {/* Theme names stay authored case — v1.2 queue cards are "Café", not "CAFÉ". */}
          <Text variant="labelSm" color={ink.muted} style={{ textTransform: 'none' }}>
            {eyebrow}
          </Text>
        </View>
      ) : null}
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          gap: m.gap,
        }}
      >
        <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: PHRASE_TEXT_BASIS }}>
          <Text variant="title3" color={ink.ink} lang="target">
            {targetText}
          </Text>
          <Text
            variant="caption"
            color={ink.ink2}
            style={{
              fontFamily: typeScale.prose.fontFamily,
              fontStyle: 'italic',
              marginTop: space['1'],
            }}
          >
            {translation}
          </Text>
        </View>
        {hasEyebrow ? null : emoji.length > 0 ? (
          <Text style={{ fontSize: m.emojiSize }}>{emoji}</Text>
        ) : null}
        {suggestion ? null : trailing}
      </View>
      {suggestion && trailing !== undefined ? (
        <View
          style={{
            marginTop: space['1'],
            flexDirection: 'row',
            justifyContent: 'flex-end',
          }}
        >
          {trailing}
        </View>
      ) : null}
    </Pressable>
  )
}
