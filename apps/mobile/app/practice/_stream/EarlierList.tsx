import { StyleSheet, View } from 'react-native'
import { useLocale } from '../../../src/lib/i18n'
import { copy } from '../../../src/lib/copy'
import { useAudioSpeech } from '../../../src/lib/audioSpeech'
import { playbackSource } from '../../../src/lib/catalogAudio'
import { haptics } from '../../../src/lib/haptics'
import { Arrival, Pressable, Row, Stack, Text } from '../../../src/ui/primitives'
import { stationeryElevation } from '../../../src/ui/elevation'
import { accent, ink, line, space, surface } from '../../../src/ui/theme'
import { useApp, type PhraseView } from '../../../src/store'
import {
  EARLIER_MARK,
  earlierMarkRadius,
  earlierOpacity,
  earlierReplayHit,
  earlierPhraseFace,
  earlierPhraseLine,
  EARLIER_REPLAY_GLYPH,
  EARLIER_ROW_GAP,
  EARLIER_TOGGLE_FACE,
  EARLIER_TOGGLE_TRACK,
  EARLIER_TOGGLE_WEIGHT,
  QUEUE_MEANING,
  HEARD_FACE,
  HEARD_GLYPH,
  REPLAY_GLYPH,
  queueRowPadX,
  queueRowRadius,
  ROW_PAD,
  SECTION_KICKER,
  SECTION_KICKER_PAD_X,
  type QueueDressing,
} from './geometry'

export function EarlierList({
  phrases,
  hidden,
  dressing = 'editorial',
  onToggle,
  onReplay,
}: {
  phrases: readonly PhraseView[]
  hidden: boolean
  dressing?: QueueDressing | undefined
  onToggle: () => void
  onReplay: (index: number) => void
}) {
  useLocale()
  const locale = useApp((state) => state.targetLocale)
  const { apiReady } = useAudioSpeech(locale)
  const replay = earlierReplayHit(dressing)
  const replayBox = {
    width: replay,
    height: replay,
    minWidth: replay,
    minHeight: replay,
    borderRadius: replay,
  } as const
  if (phrases.length === 0) return null
  return (
    <Arrival kind="fadeIn">
      <Stack gap={space['1.5']}>
        <View testID="stream-earlier-kicker" style={styles.kickerRow}>
        <Row justify="space-between" align="center" wrap>
          <Text variant="labelSm" color={ink.ink2} style={styles.heading}>
            {copy.stream.queue.earlier(phrases.length)}
          </Text>
          <Pressable
            feedback="row"
            accessibilityLabel={hidden ? copy.stream.queue.show : copy.stream.queue.hide}
            onPress={() => {
              haptics.select()
              onToggle()
            }}
          >
            <View testID="stream-earlier-toggle">
              <Text variant="labelSm" color={accent.accentInk} style={styles.toggle}>
                {hidden ? copy.stream.queue.show : copy.stream.queue.hide}
              </Text>
            </View>
          </Pressable>
        </Row>
        </View>
        {!hidden &&
          phrases.map((phrase, index) => (
            <View
              key={phrase.id}
              testID="stream-earlier-row"
              style={[
                styles.row,
                {
                  borderRadius: queueRowRadius(dressing),
                  paddingHorizontal: queueRowPadX(dressing),
                  opacity: earlierOpacity(dressing),
                },
              ]}
            >
            <Row align="center" gap={EARLIER_ROW_GAP} style={styles.hit}>
            <Pressable
              feedback="row"
              pressMotion="deboss"
              accessibilityLabel={copy.a11y.stream.jumpTo(phrase.targetText)}
              onPress={() => {
                haptics.select()
                onReplay(index)
              }}
              style={styles.lead}
            >
              <View
                testID="stream-earlier-mark"
                style={[styles.mark, { borderRadius: earlierMarkRadius(dressing) }]}
              >
                <Text color={ink.ink2} style={styles.heard}>
                  {HEARD_GLYPH}
                </Text>
              </View>
              <View style={styles.copy}>
                <View testID="stream-earlier-phrase">
                <Text
                  variant="body"
                  color={ink.ink2}
                  lang="target"
                  numberOfLines={1}
                  style={[
                    styles.phrase,
                    {
                      fontSize: earlierPhraseFace(dressing),
                      lineHeight: earlierPhraseLine(dressing),
                    },
                  ]}
                >
                  {phrase.targetText}
                </Text>
                </View>
                {phrase.translation.length > 0 && (
                  <View testID="stream-earlier-meaning">
                  <Text
                    variant="caption"
                    color={ink.muted}
                    numberOfLines={1}
                    style={styles.meaningFace}
                  >
                    {copy.stream.quotedTranslation(phrase.translation)}
                  </Text>
                  </View>
                )}
              </View>
            </Pressable>
            {playbackSource(phrase.catalog?.audio, apiReady) !== 'unavailable' ? (
              <View testID="stream-earlier-replay" style={[styles.replayHit, replayBox]}>
                <Pressable
                  feedback="icon"
                  pressMotion="deboss"
                  accessibilityLabel={copy.a11y.stream.replay(phrase.targetText)}
                  onPress={() => {
                    haptics.select()
                    onReplay(index)
                  }}
                  style={[styles.replayHit, replayBox]}
                >
                  <View testID="stream-earlier-replay-mark">
                    <Text color={ink.ink2} style={styles.replayGlyph}>
                      {REPLAY_GLYPH}
                    </Text>
                  </View>
                </Pressable>
              </View>
            ) : null}
            </Row>
            </View>
          ))}
      </Stack>
    </Arrival>
  )
}

const styles = StyleSheet.create({
  kickerRow: { paddingHorizontal: SECTION_KICKER_PAD_X },
  heading: {
    textTransform: 'uppercase',
    fontWeight: '700',
    fontSize: SECTION_KICKER,
  },
  toggle: {
    fontSize: EARLIER_TOGGLE_FACE,
    fontWeight: EARLIER_TOGGLE_WEIGHT,
    letterSpacing: EARLIER_TOGGLE_TRACK,
    textTransform: 'none',
  },
  row: {
    paddingVertical: ROW_PAD,
    backgroundColor: surface.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: line.default,
    ...stationeryElevation('queueSoft'),
  },
  hit: { width: '100%' },
  lead: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: EARLIER_ROW_GAP,
  },
  mark: {
    width: EARLIER_MARK,
    height: EARLIER_MARK,
    backgroundColor: surface.sunken2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heard: { fontSize: HEARD_FACE, lineHeight: HEARD_FACE },
  copy: { flex: 1, minWidth: 0 },
  phrase: { fontStyle: 'italic', fontWeight: '500' },
  meaningFace: { fontSize: QUEUE_MEANING },
  replayHit: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  replayGlyph: { fontSize: EARLIER_REPLAY_GLYPH, lineHeight: EARLIER_REPLAY_GLYPH },
})
