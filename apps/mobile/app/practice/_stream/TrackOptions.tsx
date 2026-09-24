import { StyleSheet, View, type ViewStyle } from 'react-native'
import type { Difficulty } from '@loro/core'
import { useLocale } from '../../../src/lib/i18n'
import { copy } from '../../../src/lib/copy'
import { haptics } from '../../../src/lib/haptics'
import { DifficultySelector } from '../../../src/ui/components'
import { Pressable, Sheet, Stack, Text } from '../../../src/ui/primitives'
import { ink, radius, space } from '../../../src/ui/theme'
import type { PhraseView } from '../../../src/store'
import {
  OPTIONS_FACE,
  OPTIONS_FACE_HORIZ,
  OPTIONS_GLYPH,
  OPTIONS_GLYPH_HORIZ,
} from './geometry'
import { OptionsMark } from './marks'

export function TrackOptionsButton({
  label,
  size,
  corner,
  axis,
  testID,
  onPress,
  style,
}: {
  label: string
  size: number
  corner: number
  axis: 'horiz' | 'vert'
  testID: string
  onPress: () => void
  style?: ViewStyle
}) {
  return (
    <View testID={testID} style={[{ width: size, height: size, borderRadius: corner }, style]}>
      <Pressable
        feedback="icon"
        pressMotion="deboss"
        accessibilityLabel={label}
        onPress={() => {
          haptics.select()
          onPress()
        }}
        style={{
          width: size,
          height: size,
          borderRadius: corner,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <OptionsMark
          glyph={axis === 'vert' ? OPTIONS_GLYPH : OPTIONS_GLYPH_HORIZ}
          face={axis === 'vert' ? OPTIONS_FACE : OPTIONS_FACE_HORIZ}
          color={ink.ink2}
        />
      </Pressable>
    </View>
  )
}

export function TrackOptionsSheet({
  visible,
  phrase,
  showJump,
  onDismiss,
  onLove,
  onLearned,
  onRate,
  onJump,
}: {
  visible: boolean
  phrase: PhraseView | undefined
  showJump: boolean
  onDismiss: () => void
  onLove: () => void
  onLearned: () => void
  onRate: (difficulty: Difficulty) => void
  onJump: () => void
}) {
  useLocale()
  return (
    <Sheet visible={visible} onDismiss={onDismiss} dismissLabel={copy.a11y.stream.dismissOptions}>
      {phrase === undefined ? null : (
        <View testID="stream-options-sheet">
          <Stack gap={space['3']}>
            <Text variant="title3" color={ink.ink} lang="target" numberOfLines={3}>
              {phrase.targetText}
            </Text>
            <Stack gap={space['1']}>
              <OptionsAction
                label={
                  phrase.loved ? copy.a11y.common.removeFromLoved : copy.a11y.stream.loveThisPhrase
                }
                onPress={() => {
                  haptics.select()
                  onLove()
                }}
              />
              <OptionsAction
                label={
                  phrase.learned ? copy.a11y.phrase.markStillLearning : copy.common.markLearned
                }
                onPress={() => {
                  haptics.confirm()
                  onLearned()
                }}
              />
              {showJump ? (
                <OptionsAction
                  label={copy.a11y.stream.jumpTo(phrase.targetText)}
                  onPress={() => {
                    haptics.select()
                    onJump()
                  }}
                />
              ) : null}
            </Stack>
            <DifficultySelector
              layout="segmented"
              value={phrase.difficulty}
              labels={copy.difficulty}
              onChange={(difficulty) => {
                haptics.select()
                onRate(difficulty)
              }}
            />
          </Stack>
        </View>
      )}
    </Sheet>
  )
}

function OptionsAction({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      feedback="row"
      pressMotion="deboss"
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.action}
    >
      <Text variant="body" color={ink.ink}>
        {label}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  action: {
    minHeight: 48,
    justifyContent: 'center',
    borderRadius: radius.md,
    paddingHorizontal: space['2'],
  },
})
