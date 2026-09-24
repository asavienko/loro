import { StyleSheet, View } from 'react-native'
import { useLocale } from '../../../src/lib/i18n'
import { copy } from '../../../src/lib/copy'
import { haptics } from '../../../src/lib/haptics'
import { Pressable, Row, Text } from '../../../src/ui/primitives'
import { stationeryElevation } from '../../../src/ui/elevation'
import { accent, ink, onDark, radius, space } from '../../../src/ui/theme'
import type { PhraseView } from '../../../src/store'
import { useStreamCadence } from './useStreamCadence'
import {
  COMPACT_PAUSE_H,
  COMPACT_PAUSE_W,
  COMPACT_PLAY_TRI_H,
  COMPACT_PLAY_TRI_W,
  EDITORIAL_MEANING,
  EDITORIAL_MEANING_LINE,
  PAUSE_GAP,
  QUEUE_PHRASE,
  SIMPLE_PLAY,
} from './geometry'
import { PauseMark, PlayMark } from './marks'

export function SimpleQueueFooter({ phrase }: { phrase: PhraseView }) {
  useLocale()
  const cadence = useStreamCadence(phrase)
  return (
    <View testID="stream-simple-footer">
      <Row align="center" justify="space-between" gap={space['3']}>
        <View style={styles.copy}>
          <Text
            variant="title3"
            color={ink.ink}
            lang="target"
            numberOfLines={1}
            style={styles.phrase}
          >
            {phrase.targetText}
          </Text>
          {phrase.translation.length > 0 ? (
            <Text variant="caption" color={ink.ink2} numberOfLines={1} style={styles.meaning}>
              {copy.stream.quotedTranslation(phrase.translation)}
            </Text>
          ) : null}
        </View>
        {cadence.audio.canPlay ? (
          <View testID="stream-simple-footer-play" style={stationeryElevation('emblemSoft')}>
            <Pressable
              feedback="button"
              pressMotion="deboss"
              accessibilityLabel={cadence.playing ? copy.audioSpeech.stop : copy.audioSpeech.play}
              onPress={() => {
                haptics.confirm()
                cadence.playOrStop()
              }}
              style={styles.play}
            >
              {cadence.playing ? (
                <PauseMark
                  width={COMPACT_PAUSE_W}
                  height={COMPACT_PAUSE_H}
                  gap={PAUSE_GAP}
                  color={onDark.primary}
                />
              ) : (
                <PlayMark
                  wide={COMPACT_PLAY_TRI_W}
                  half={COMPACT_PLAY_TRI_H}
                  color={onDark.primary}
                />
              )}
            </Pressable>
          </View>
        ) : null}
      </Row>
    </View>
  )
}

const styles = StyleSheet.create({
  copy: { flex: 1, minWidth: 0, gap: space['0.5'] },
  phrase: {
    fontSize: QUEUE_PHRASE,
    fontWeight: '600',
    fontStyle: 'italic',
  },
  meaning: {
    fontStyle: 'italic',
    fontSize: EDITORIAL_MEANING,
    lineHeight: EDITORIAL_MEANING_LINE,
  },
  play: {
    width: SIMPLE_PLAY,
    height: SIMPLE_PLAY,
    minWidth: SIMPLE_PLAY,
    minHeight: SIMPLE_PLAY,
    borderRadius: radius.pill,
    backgroundColor: accent.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
