/**
 * The two tiles: a decorative emoji square, and a number with its label.
 */

import { Platform, Text as RNText, View } from 'react-native'
import { ink, radius, size as designSize, space, surface } from '../theme'
import { Card } from './surfaces'
import { Text } from './Text'

/**
 * The rounded emoji tile.
 *
 * The glyph is `0.48 × size`, which is the ratio the blueprint draws at every size it uses — except
 * where it does not, and `fontSize` is the escape hatch for those. The Refrain's finish tile is
 * 88 px with a 42 px glyph (0.477) and Progress's milestone tiles are 38 with 18 (0.474); rounding
 * either to the ratio would move the glyph by a quarter of a pixel, which is a change nobody asked
 * for.
 */
export function EmojiTile({
  emoji,
  size = designSize.emojiTile.lg,
  radius: corner = radius.lg,
  background = surface.sunken,
  fontSize,
}: {
  emoji: string
  size?: number | undefined
  radius?: number | undefined
  background?: string | undefined
  /** Overrides `0.48 × size`. */
  fontSize?: number | undefined
}) {
  return (
    <View
      // Decorative: the row's label already carries the meaning.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: corner,
        backgroundColor: background,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <RNText style={{ fontSize: fontSize ?? size * 0.48 }}>{emoji}</RNText>
    </View>
  )
}

/**
 * A single dot.
 *
 * `borderRadius` is `ceil(size / 2)`, which is what both call sites wrote by hand: 5 for a 9 px dot
 * and 4 for a 7 px one. `Dots` does NOT use this — its pips round at `size / 2`, so a 7 px pip
 * there is 3.5 — and unifying the two would move a corner on the Refrain's rep strip.
 */
export function Dot({ size, color }: { size: number; color: string }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: Math.ceil(size / 2),
        backgroundColor: color,
      }}
    />
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
 *
 * NOT for the Refrain's two finish cards (`app/practice/refrain.tsx:262-277`). They look identical
 * and are not: they use `title3` where this uses `title2`, and they are deliberately NOT one
 * accessible node. Routing them through here would change both the type size and the accessibility
 * tree.
 */
export function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <Card
      padding={space['3.5']}
      style={{
        flex: 1,
        ...(Platform.OS === 'web' ? { minWidth: 'auto' as const } : {}),
      }}
      accessible
      accessibilityLabel={`${label}: ${value}`}
    >
      <Text variant="title1" color={ink.ink}>
        {value}
      </Text>
      <Text
        variant="labelSm"
        color={ink.muted}
        style={{ textTransform: 'uppercase', marginTop: space['1'] }}
      >
        {label}
      </Text>
    </Card>
  )
}
