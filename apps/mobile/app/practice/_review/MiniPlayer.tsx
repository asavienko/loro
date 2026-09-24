import { StyleSheet, View } from 'react-native'
import { copy } from '../../../src/lib/copy'
import { haptics } from '../../../src/lib/haptics'
import { useLocale } from '../../../src/lib/i18n'
import { EmojiTile, Pressable, Row, Text } from '../../../src/ui/primitives'
import { stationeryElevation } from '../../../src/ui/elevation'
import { useTheme } from '../../../src/ui/ThemeProvider'
import { onDark, radius, space, surface } from '../../../src/ui/theme'
import type { PhraseView } from '../../../src/store'
import {
  MINI_COPY_GAP,
  MINI_KICKER_WEIGHT,
  MINI_LEAD_GAP,
  MINI_PAUSE_H,
  MINI_PAUSE_W,
  MINI_PLAY,
  MINI_PLAY_ML,
  PLAYER_GAP,
  PLAYER_PAD,
  PLAY_TRI_H,
  PLAY_TRI_W,
  THUMB,
  THUMB_RADIUS,
} from './geometry'

export function MiniPlayer({
  phrase,
  canPlay,
  playing,
  onPlay,
}: {
  phrase: PhraseView
  canPlay: boolean
  playing: boolean
  onPlay: () => void
}) {
  useLocale()
  const { accent } = useTheme()
  return (
    <View testID="review-mini" style={[styles.player, stationeryElevation('playerFloat')]}>
      <View testID="review-mini-lead" style={styles.lead}>
        <View testID="review-mini-thumb" style={styles.thumb}>
          <EmojiTile
            emoji={phrase.emoji}
            size={THUMB}
            radius={THUMB_RADIUS}
            background={surface.sunken}
          />
        </View>
        <View testID="review-mini-copy" style={styles.copy}>
          <View testID="review-mini-kicker">
            <Text variant="labelSm" color={onDark.primary} style={styles.kicker}>
              {copy.review.nowRepeating}
            </Text>
          </View>
          <Text variant="title3" color={onDark.primary} numberOfLines={1} lang="target">
            {phrase.targetText}
          </Text>
          <Text variant="captionSm" color={onDark.muted} numberOfLines={1}>
            {phrase.translation}
          </Text>
        </View>
      </View>
      {canPlay ? (
        <View testID="review-mini-play" style={styles.playWrap}>
        <Pressable
          feedback="icon"
          pressMotion="deboss"
          accessibilityLabel={playing ? copy.audioSpeech.stop : copy.audioSpeech.play}
          onPress={() => {
            haptics.confirm()
            onPlay()
          }}
          style={[styles.play, { backgroundColor: accent.accentOnDark }]}
        >
          {playing ? <PauseMark /> : <PlayMark />}
        </Pressable>
        </View>
      ) : null}
    </View>
  )
}

function PlayMark() {
  return <View testID="review-mini-play-tri" style={styles.tri} />
}

function PauseMark() {
  return (
    <View testID="review-mini-pause">
      <Row gap={space['1']}>
        <View testID="review-mini-pause-bar" style={styles.pause} />
        <View style={styles.pause} />
      </Row>
    </View>
  )
}

const styles = StyleSheet.create({
  player: {
    width: '100%',
    borderRadius: radius.xl,
    backgroundColor: surface.dark,
    padding: PLAYER_PAD,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: PLAYER_GAP,
  },
  thumb: { width: THUMB, height: THUMB, borderRadius: THUMB_RADIUS, overflow: 'hidden' },
  lead: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: MINI_LEAD_GAP,
  },
  copy: { flex: 1, minWidth: 0, gap: MINI_COPY_GAP },
  kicker: { textTransform: 'uppercase', fontWeight: MINI_KICKER_WEIGHT },
  playWrap: { marginLeft: MINI_PLAY_ML },
  play: {
    width: MINI_PLAY,
    height: MINI_PLAY,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tri: {
    width: 0,
    height: 0,
    marginLeft: space['0.5'],
    borderTopWidth: PLAY_TRI_H,
    borderBottomWidth: PLAY_TRI_H,
    borderLeftWidth: PLAY_TRI_W,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: surface.dark,
  },
  pause: {
    width: MINI_PAUSE_W,
    height: MINI_PAUSE_H,
    borderRadius: radius.pill,
    backgroundColor: surface.dark,
  },
})
