import { StyleSheet, View } from 'react-native'
import { useLocale } from '../../../src/lib/i18n'
import { copy } from '../../../src/lib/copy'
import { haptics } from '../../../src/lib/haptics'
import {
  Arrival,
  EmojiTile,
  Equalizer,
  Pressable,
  PulseRing,
  Row,
  Stack,
  Text,
} from '../../../src/ui/primitives'
import { stationeryElevation } from '../../../src/ui/elevation'
import { accent, ink, line, onDark, radius, space, surface } from '../../../src/ui/theme'
import type { PhraseView } from '../../../src/store'
import { audioPlaybackNote } from '../../../src/lib/audioSpeech'
import type { CadenceLoop } from '../../../src/lib/streamCadence'
import { RatePills } from './RatePills'
import { useStreamCadence } from './useStreamCadence'
import {
  CADENCE_PAD_X,
  CADENCE_PAD_Y,
  COVER,
  COVER_BORDER,
  COVER_GLYPH,
  COVER_RADIUS,
  EDITORIAL_BORDER,
  EDITORIAL_MEANING,
  EDITORIAL_MEANING_LINE,
  EDITORIAL_MEANING_MT,
  EDITORIAL_MEANING_WEIGHT,
  EDITORIAL_PAD,
  EDITORIAL_PLAY,
  SIMPLE_PLAY,
  EDITORIAL_RADIUS,
  EDITORIAL_RESP,
  EDITORIAL_RESP_MT,
  EDITORIAL_RATE_GAP,
  EDITORIAL_TITLE,
  EDITORIAL_TITLE_LINE,
  EDITORIAL_TITLE_LINES,
  EDITORIAL_LOOP_FACE,
  EDITORIAL_LOOP_GAP,
  EDITORIAL_TRANSPORT,
  compactTransportFace,
  queueHeroTransportGap,
  queueHeroTransportMt,
  LOOP_GLYPH,
  SIMPLE_TITLE,
  SIMPLE_TITLE_LINE,
  SECTION_KICKER,
  SECTION_KICKER_PAD_X,
  PULSE_DOT,
  queueCoverRadius,
  queuePulseDot,
  queuePulseGap,
  queueHeroElevation,
  queueHeroCopyPadEnd,
  queueHeroPad,
  queueHeroRadius,
  queueHeroRuleMt,
  queueHeroRulePt,
  COMPACT_PAUSE_H,
  COMPACT_PAUSE_W,
  EDITORIAL_PAUSE_H,
  EDITORIAL_PAUSE_W,
  COMPACT_PLAY_TRI_H,
  COMPACT_PLAY_TRI_W,
  EDITORIAL_PLAY_TRI_H,
  EDITORIAL_PLAY_TRI_W,
  PAUSE_GAP,
  type QueueDressing,
} from './geometry'
import { PauseMark, PlayMark } from './marks'

export function EditorialNowPlaying({
  phrase,
  track,
  dressing = 'editorial',
  onPrevious,
  onNext,
  onOpen,
}: {
  phrase: PhraseView
  track: string
  dressing?: QueueDressing | undefined
  onPrevious: () => void
  onNext: () => void
  onOpen: () => void
}) {
  useLocale()
  const cadence = useStreamCadence(phrase)
  const resp = phrase.catalog?.resp ?? phrase.catalog?.respIpa
  const heroRadius = queueHeroRadius(dressing)
  const heroPad = queueHeroPad(dressing)
  const copyPadEnd = queueHeroCopyPadEnd(dressing)
  const coverRadius = queueCoverRadius(dressing)
  const title = dressing === 'simple' ? SIMPLE_TITLE : EDITORIAL_TITLE
  const titleLine = dressing === 'simple' ? SIMPLE_TITLE_LINE : EDITORIAL_TITLE_LINE
  const ruleMt = queueHeroRuleMt(dressing)
  const rulePt = queueHeroRulePt(dressing)
  const pulse = queuePulseDot(dressing)
  const pulseGap = queuePulseGap(dressing)
  return (
    <Arrival kind="fadeIn">
      <Stack gap={space['1.5']}>
        <View testID="stream-now-kicker" style={styles.kickerRow}>
        <Row justify="space-between" align="center" wrap>
          <View testID="stream-now-pulse-row" style={[styles.pulseRow, { gap: pulseGap }]}>
            <View
              testID="stream-now-pulse"
              style={[styles.pulse, { width: pulse, height: pulse }]}
            >
              <PulseRing active>
                <View style={[styles.dot, { width: pulse, height: pulse, borderRadius: pulse }]} />
              </PulseRing>
            </View>
            <Text variant="labelSm" color={accent.accentInk} style={styles.heading}>
              {copy.stream.queue.nowPlayingTrack(track)}
            </Text>
          </View>
          <View testID="stream-now-target">
            <Text variant="labelSm" color={ink.ink2} style={styles.kicker}>
              {copy.stream.queue.target}
            </Text>
          </View>
        </Row>
        </View>
        <View
          testID={dressing === 'simple' ? 'stream-simple-hero' : 'stream-editorial-hero'}
          style={[
            styles.cardLift,
            { borderRadius: heroRadius },
            stationeryElevation(queueHeroElevation(dressing)),
          ]}
        >
        <View style={[styles.card, { borderRadius: heroRadius, padding: heroPad }]}>
          <Pressable
            feedback="row"
            pressMotion="deboss"
            accessibilityLabel={copy.a11y.stream.openNowPlaying}
            onPress={() => {
              haptics.select()
              onOpen()
            }}
            style={[styles.lead, { gap: heroPad }]}
          >
            <View
              testID="stream-editorial-cover"
              style={[
                styles.coverLift,
                { borderRadius: coverRadius },
                stationeryElevation('emblemSoft'),
              ]}
            >
            <View style={[styles.cover, { borderRadius: coverRadius }]}>
              <EmojiTile
                emoji={phrase.emoji}
                size={COVER}
                fontSize={COVER_GLYPH}
                radius={coverRadius}
                background={accent.wash}
              />
              <View
                pointerEvents="none"
                style={[styles.coverEdge, { borderRadius: coverRadius }]}
              />
              {cadence.playing ? (
                <View style={styles.eq}>
                  <Equalizer active color={accent.accent} />
                </View>
              ) : null}
            </View>
            </View>
            <View
              testID="stream-editorial-copy"
              style={[styles.copy, { paddingEnd: copyPadEnd }]}
            >
              <View testID="stream-editorial-title">
              <Text
                variant="title3"
                color={ink.ink}
                lang="target"
                numberOfLines={EDITORIAL_TITLE_LINES}
                style={[styles.phrase, { fontSize: title, lineHeight: titleLine }]}
              >
                {phrase.targetText}
              </Text>
              </View>
              {phrase.translation.length > 0 ? (
                <View testID="stream-editorial-meaning" style={styles.meaningWrap}>
                <Text variant="caption" color={ink.ink2} numberOfLines={1} style={styles.meaning}>
                  {copy.stream.quotedTranslation(phrase.translation)}
                </Text>
                </View>
              ) : null}
              {resp !== undefined && resp.length > 0 ? (
                <View testID="stream-editorial-resp" style={styles.respWrap}>
                <Text variant="labelSm" color={accent.accentInk} numberOfLines={1} style={styles.resp}>
                  {resp}
                </Text>
                </View>
              ) : null}
            </View>
          </Pressable>
          <View
            testID="stream-hero-rule"
            style={[styles.rule, { marginTop: ruleMt, paddingTop: rulePt }]}
          />
          <CompactCadence
            dressing={dressing}
            loop={cadence.loop}
            canPlay={cadence.audio.canPlay}
            playing={cadence.playing}
            onLoop={cadence.onLoop}
            onPrevious={() => {
              cadence.resetPlay()
              onPrevious()
            }}
            onNext={() => {
              cadence.resetPlay()
              onNext()
            }}
            onPlay={cadence.playOrStop}
          />
          <View testID="stream-editorial-rate-row" style={styles.rateRow}>
            <RatePills rate={cadence.rate} onRate={cadence.setRate} />
          </View>
          <Text variant="captionSm" color={ink.ink2} style={styles.note}>
            {!cadence.audio.canPlay
              ? copy.stream.audioNote
              : audioPlaybackNote(
                  cadence.audio.source,
                  cadence.audio.playback,
                  cadence.audio.playbackError,
                )}
          </Text>
        </View>
        </View>
      </Stack>
    </Arrival>
  )
}

function CompactCadence({
  dressing,
  loop,
  canPlay,
  playing,
  onLoop,
  onPrevious,
  onNext,
  onPlay,
}: {
  dressing: QueueDressing
  loop: CadenceLoop
  canPlay: boolean
  playing: boolean
  onLoop: () => void
  onPrevious: () => void
  onNext: () => void
  onPlay: () => void
}) {
  useLocale()
  const play = dressing === 'simple' ? SIMPLE_PLAY : EDITORIAL_PLAY
  const playLift = dressing === 'simple' ? 'emblemSoft' : 'emblemRaised'
  const playBox = { width: play, height: play, minWidth: play, minHeight: play } as const
  const skipFace = compactTransportFace(dressing)
  const skipGlyph = { fontSize: skipFace, lineHeight: skipFace }
  const transportGap = queueHeroTransportGap(dressing)
  const transportMt = queueHeroTransportMt(dressing)
  return (
    <View
      testID="stream-hero-transport"
      style={[styles.transportRow, { gap: transportGap, marginTop: transportMt }]}
    >
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
        <View
          testID={dressing === 'editorial' ? 'stream-editorial-loop-row' : 'stream-simple-loop-row'}
          style={[
            styles.loopRow,
            dressing === 'editorial' ? styles.editorialLoopRow : null,
          ]}
        >
          {dressing === 'editorial' ? (
            <View testID="stream-editorial-loop-mark">
              <Text color={ink.ink} style={styles.editorialLoopGlyph}>
                {LOOP_GLYPH}
              </Text>
            </View>
          ) : null}
          <View testID="stream-editorial-loop-face">
            <Text variant="labelSm" color={ink.ink} style={styles.loopLabel}>
              {copy.stream.cadence.loop(loop)}
            </Text>
          </View>
        </View>
      </Pressable>
      <View testID="stream-editorial-transport" style={styles.transport}>
      <Pressable
        feedback="icon"
        accessibilityLabel={copy.a11y.stream.previous}
        onPress={() => {
          haptics.select()
          onPrevious()
        }}
        style={styles.transport}
      >
        <View testID="stream-compact-skip-face">
          <Text color={ink.ink} style={skipGlyph}>
            {copy.stream.controls.prev}
          </Text>
        </View>
      </Pressable>
      </View>
      {canPlay ? (
        <View
          testID={dressing === 'simple' ? 'stream-simple-play' : 'stream-editorial-play'}
          style={stationeryElevation(playLift)}
        >
        <Pressable
          feedback="button"
          pressMotion="deboss"
          accessibilityLabel={playing ? copy.audioSpeech.stop : copy.audioSpeech.play}
          onPress={() => {
            haptics.confirm()
            onPlay()
          }}
          style={[styles.play, playBox]}
        >
          {playing ? (
            <PauseMark
              width={dressing === 'simple' ? COMPACT_PAUSE_W : EDITORIAL_PAUSE_W}
              height={dressing === 'simple' ? COMPACT_PAUSE_H : EDITORIAL_PAUSE_H}
              gap={PAUSE_GAP}
              color={onDark.primary}
            />
          ) : (
            <PlayMark
              wide={dressing === 'simple' ? COMPACT_PLAY_TRI_W : EDITORIAL_PLAY_TRI_W}
              half={dressing === 'simple' ? COMPACT_PLAY_TRI_H : EDITORIAL_PLAY_TRI_H}
              color={onDark.primary}
            />
          )}
        </Pressable>
        </View>
      ) : (
        <View
          testID={dressing === 'simple' ? 'stream-simple-play' : 'stream-editorial-play'}
          style={[styles.playSlot, playBox, stationeryElevation(playLift)]}
        />
      )}
      <View testID="stream-editorial-transport" style={styles.transport}>
      <Pressable
        feedback="icon"
        accessibilityLabel={copy.a11y.stream.next}
        onPress={() => {
          haptics.select()
          onNext()
        }}
        style={styles.transport}
      >
        <View testID="stream-compact-skip-face">
          <Text color={ink.ink} style={skipGlyph}>
            {copy.stream.controls.skip}
          </Text>
        </View>
      </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  kickerRow: { paddingHorizontal: SECTION_KICKER_PAD_X },
  pulseRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  heading: {
    textTransform: 'uppercase',
    fontWeight: '700',
    fontSize: SECTION_KICKER,
  },
  kicker: { fontSize: SECTION_KICKER, fontWeight: '500', textTransform: 'none' },
  pulse: {
    width: PULSE_DOT,
    height: PULSE_DOT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: PULSE_DOT,
    height: PULSE_DOT,
    borderRadius: PULSE_DOT,
    backgroundColor: accent.accent,
  },
  cardLift: {
    borderRadius: EDITORIAL_RADIUS,
  },
  card: {
    backgroundColor: surface.card,
    borderRadius: EDITORIAL_RADIUS,
    padding: EDITORIAL_PAD,
    borderWidth: EDITORIAL_BORDER,
    borderColor: accent.tintBorder,
    overflow: 'hidden',
  },
  lead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: EDITORIAL_PAD,
  },
  coverLift: {
    width: COVER,
    height: COVER,
    borderRadius: COVER_RADIUS,
  },
  cover: {
    position: 'relative',
    width: '100%',
    height: '100%',
    borderRadius: COVER_RADIUS,
    overflow: 'hidden',
  },
  coverEdge: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: COVER_RADIUS,
    borderWidth: COVER_BORDER,
    borderColor: line.default,
  },
  eq: {
    position: 'absolute',
    right: space['1'],
    bottom: space['1'],
  },
  copy: { flex: 1, minWidth: 0 },
  meaningWrap: { marginTop: EDITORIAL_MEANING_MT },
  respWrap: { marginTop: EDITORIAL_RESP_MT },
  phrase: {
    fontSize: EDITORIAL_TITLE,
    lineHeight: EDITORIAL_TITLE_LINE,
    fontWeight: '700',
    fontStyle: 'italic',
  },
  meaning: {
    fontSize: EDITORIAL_MEANING,
    lineHeight: EDITORIAL_MEANING_LINE,
    fontWeight: EDITORIAL_MEANING_WEIGHT,
  },
  resp: { fontSize: EDITORIAL_RESP },
  rule: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: line.default,
  },
  loop: {
    paddingHorizontal: CADENCE_PAD_X,
    paddingVertical: CADENCE_PAD_Y,
    borderRadius: radius.pill,
    backgroundColor: surface.sunken,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: line.default,
  },
  loopRow: { flexDirection: 'row', alignItems: 'center' },
  editorialLoopRow: { gap: EDITORIAL_LOOP_GAP },
  editorialLoopGlyph: { fontSize: EDITORIAL_LOOP_FACE, lineHeight: EDITORIAL_LOOP_FACE },
  loopLabel: { fontSize: SECTION_KICKER, fontWeight: '700' },
  transportRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  transport: {
    width: EDITORIAL_TRANSPORT,
    height: EDITORIAL_TRANSPORT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  play: {
    width: EDITORIAL_PLAY,
    height: EDITORIAL_PLAY,
    minHeight: EDITORIAL_PLAY,
    minWidth: EDITORIAL_PLAY,
    borderRadius: radius.pill,
    backgroundColor: accent.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playSlot: {
    width: EDITORIAL_PLAY,
    height: EDITORIAL_PLAY,
  },
  note: { textAlign: 'center' },
  rateRow: { marginTop: EDITORIAL_RATE_GAP },
})
