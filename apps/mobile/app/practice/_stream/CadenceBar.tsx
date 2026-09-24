import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { useLocale } from '../../../src/lib/i18n'
import { copy } from '../../../src/lib/copy'
import { haptics } from '../../../src/lib/haptics'
import { Pressable, Row, Text } from '../../../src/ui/primitives'
import { stationeryElevation } from '../../../src/ui/elevation'
import { accent, ink, line, radius, space, surface } from '../../../src/ui/theme'
import type { CadenceLoop } from '../../../src/lib/streamCadence'
import {
  LOOP_BADGE_END,
  LOOP_BADGE_FACE,
  LOOP_BADGE_LETTER,
  LOOP_BADGE_LINE,
  LOOP_BADGE_PX,
  LOOP_BADGE_TOP,
  LOOP_FACE,
  LOOP_GLYPH,
  PLAY_SIZE,
  TRANSPORT,
  TRANSPORT_GLYPH,
  TRANSPORT_MARGIN_TOP,
  TRANSPORT_PAD_X,
  TRANSPORT_PAD_Y,
} from './geometry'

export function CadenceBar({
  loop,
  onLoop,
  onPrevious,
  onNext,
  canPlay,
  playing,
  onPlay,
  playMark,
}: {
  loop: CadenceLoop
  onLoop: () => void
  onPrevious: () => void
  onNext: () => void
  canPlay: boolean
  playing: boolean
  onPlay: () => void
  playMark: ReactNode
}) {
  useLocale()
  return (
    <View testID="stream-cadence-bar" style={styles.row}>
    <Row justify="space-between" align="center">
      <View style={styles.transport} />
      <View testID="stream-transport" style={styles.transport}>
      <Pressable
        feedback="icon"
        accessibilityLabel={copy.a11y.stream.previous}
        onPress={() => {
          haptics.select()
          onPrevious()
        }}
        style={styles.transport}
      >
        <View testID="stream-transport-face">
          <Text color={ink.ink} style={styles.transportGlyph}>
            {copy.stream.controls.prev}
          </Text>
        </View>
      </Pressable>
      </View>
      {canPlay ? (
        <View testID="stream-play" style={stationeryElevation('playGlow')}>
        <Pressable
          feedback="button"
          pressMotion="deboss"
          accessibilityLabel={playing ? copy.audioSpeech.stop : copy.audioSpeech.play}
          onPress={() => {
            haptics.confirm()
            onPlay()
          }}
          style={styles.play}
        >
          {playMark}
        </Pressable>
        </View>
      ) : (
        <View
          testID="stream-play"
          style={[styles.playSlot, stationeryElevation('playGlow')]}
        />
      )}
      <View testID="stream-transport" style={styles.transport}>
      <Pressable
        feedback="icon"
        accessibilityLabel={copy.a11y.stream.next}
        onPress={() => {
          haptics.select()
          onNext()
        }}
        style={styles.transport}
      >
        <View testID="stream-transport-face">
          <Text color={ink.ink} style={styles.transportGlyph}>
            {copy.stream.controls.skip}
          </Text>
        </View>
      </Pressable>
      </View>
      <Pressable
        feedback="smallButton"
        pressMotion="deboss"
        accessibilityLabel={copy.a11y.stream.loop(loop)}
        onPress={() => {
          haptics.select()
          onLoop()
        }}
        style={styles.loop}
      >
        <View testID="stream-loop-mark">
          <Text color={ink.ink} style={styles.loopGlyph}>
            {LOOP_GLYPH}
          </Text>
        </View>
        <View testID="stream-loop-face" style={styles.loopBadge}>
        <Text variant="labelSm" color={ink.ink} style={styles.loopLabel}>
          {copy.stream.cadence.loop(loop)}
        </Text>
        </View>
      </Pressable>
    </Row>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    marginTop: TRANSPORT_MARGIN_TOP,
    width: '100%',
    paddingHorizontal: TRANSPORT_PAD_X,
    paddingVertical: TRANSPORT_PAD_Y,
  },
  transport: {
    width: TRANSPORT,
    height: TRANSPORT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transportGlyph: { fontSize: TRANSPORT_GLYPH, lineHeight: TRANSPORT_GLYPH },
  play: {
    width: PLAY_SIZE,
    height: PLAY_SIZE,
    minHeight: PLAY_SIZE,
    minWidth: PLAY_SIZE,
    borderRadius: radius.pill,
    backgroundColor: accent.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: space['1.5'],
  },
  playSlot: {
    width: PLAY_SIZE,
    height: PLAY_SIZE,
  },
  loop: {
    position: 'relative',
    width: TRANSPORT,
    height: TRANSPORT,
    borderRadius: radius.pill,
    backgroundColor: surface.sunken,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: line.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loopGlyph: { fontSize: LOOP_FACE, lineHeight: LOOP_FACE },
  loopBadge: {
    position: 'absolute',
    top: LOOP_BADGE_TOP,
    right: LOOP_BADGE_END,
    paddingHorizontal: LOOP_BADGE_PX,
  },
  loopLabel: {
    fontSize: LOOP_BADGE_FACE,
    lineHeight: LOOP_BADGE_LINE,
    fontWeight: '700',
    letterSpacing: LOOP_BADGE_LETTER,
    textTransform: 'none',
  },
})
