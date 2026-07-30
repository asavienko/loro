/**
 * The two tiles: a decorative emoji square, and a number with its label.
 */

import { Text as RNText, View } from 'react-native'
import { ink, radius, space, surface } from '../theme'
import { Card } from './surfaces'
import { Text } from './Text'

export function EmojiTile({ emoji, size = 42 }: { emoji: string; size?: number | undefined }) {
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
