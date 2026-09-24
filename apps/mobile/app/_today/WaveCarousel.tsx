import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native'
import { useLocale } from '../../src/lib/i18n'
import { copy } from '../../src/lib/copy'
import { haptics } from '../../src/lib/haptics'
import { Arrival, Pressable, Row, Text } from '../../src/ui/primitives'
import { stationeryElevation } from '../../src/ui/elevation'
import { accent, ink, radius, space, surface } from '../../src/ui/theme'
import type { ProductionWave } from '../../src/store'
import { WAVE_LISTEN_PHRASE_COUNT, type ScheduledWave } from '../../src/lib/waves'
import { waveClockParts } from './rhythm'
import {
  CARD_GLOW,
  DUE_BADGE_PY,
  PLAY_TRI_H,
  PLAY_TRI_W,
  START_LABEL,
  START_LABEL_LINE,
  START_LABEL_TRACK,
  START_PILL_GAP,
  START_PILL_PX,
  START_PILL_PY,
  WAVE_BLEED,
  WAVE_CARD_MAX,
  WAVE_CARD_VW,
  WAVE_SNAP_GAP,
  WAVE_TRACK_PB,
  WAVE_FOOTER_PT,
  WAVE_HEADING,
  WAVE_HEADING_LINE,
  WAVE_LATER_OPACITY,
  WAVE_MANNER,
  WAVE_MANNER_LINE,
  WAVE_MANNER_LINES,
  WAVE_PASSED_OPACITY,
  WAVE_CARD_GAP,
  WAVE_CARD_PAD,
  WAVE_CARD_RADIUS,
  WAVE_HEAD_GAP,
  WAVE_TITLE,
  WAVE_TITLE_GAP,
  WAVE_TITLE_LINE,
  WAVE_TITLE_MT,
  WAVEFORM_ACTIVE,
  WAVEFORM_BAR_W,
  WAVEFORM_GAP,
  WAVEFORM_H,
  WAVEFORM_IDLE,
  WAVEFORM_MY,
  WAVEFORM_PAD,
  WAVEFORM_RADIUS,
  LABEL_BOLD_WEIGHT,
} from './geometry'

type WaveKey = ProductionWave

export function WaveCarousel({
  waves,
  setSize,
  totalReps,
  listenProgress,
  onStartWave,
}: {
  waves: readonly ScheduledWave<WaveKey>[]
  setSize: number
  totalReps: number
  listenProgress: number | undefined
  onStartWave: ((wave: WaveKey) => void) | undefined
}) {
  useLocale()
  const { width } = useWindowDimensions()
  const cardWidth = Math.min(WAVE_CARD_MAX, Math.round(width * WAVE_CARD_VW))
  return (
    <View testID="today-day-list" style={styles.block}>
      <Row justify="space-between" align="center" wrap>
        <View testID="today-wave-heading">
          <Text variant="title3" color={ink.ink} style={styles.heading}>
            {copy.today.day.heading}
          </Text>
        </View>
        <View testID="today-wave-mixes">
          <Text variant="labelSm" color={ink.ink2} style={styles.mixes}>
            {copy.today.rhythm.mixes(waves.length)}
          </Text>
        </View>
      </Row>
      <View style={styles.scrollerClip}>
      <ScrollView
        testID="today-wave-track"
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        snapToInterval={cardWidth + WAVE_SNAP_GAP}
        snapToAlignment="start"
        decelerationRate="fast"
        contentContainerStyle={styles.track}
        style={styles.scroller}
      >
        {waves.map((wave, index) => (
          <WaveCard
            key={wave.key}
            wave={wave}
            index={index + 1}
            width={cardWidth}
            setSize={setSize}
            onStartWave={onStartWave}
          />
        ))}
      </ScrollView>
      </View>
      <View style={styles.repsRow}>
        <Text variant="label" color={ink.ink2} style={styles.now}>
          {copy.today.day.now}
        </Text>
        <View style={styles.grow}>
          <Text variant="body" color={ink.ink}>
            {copy.today.day.reps(totalReps)}
          </Text>
          {listenProgress !== undefined && (
            <Text variant="caption" color={ink.ink2} style={styles.listen}>
              {copy.today.day.waveListenProgress(listenProgress, WAVE_LISTEN_PHRASE_COUNT)}
            </Text>
          )}
        </View>
      </View>
    </View>
  )
}

function WaveCard({
  wave,
  index,
  width,
  setSize,
  onStartWave,
}: {
  wave: ScheduledWave<WaveKey>
  index: number
  width: number
  setSize: number
  onStartWave: ((wave: WaveKey) => void) | undefined
}) {
  useLocale()
  const { title, manner } = copy.today.waves[wave.key]
  const next = wave.position === 'next' && !wave.completed
  const detail = next ? copy.today.day.nextWave(manner, setSize) : manner
  const start = next && onStartWave !== undefined
  const receded = !next
  const lift = next ? 'emblemRaised' : 'emblemSoft'
  const card = (
    <View
      testID="today-wave-card"
      style={[styles.cardLift, { width }, stationeryElevation(lift)]}
    >
    <View
      style={[
        styles.card,
        next
          ? styles.cardNext
          : wave.position === 'later'
            ? [styles.cardLater, { opacity: WAVE_LATER_OPACITY }]
            : [styles.cardPassed, { opacity: WAVE_PASSED_OPACITY }],
      ]}
    >
      {next && <View pointerEvents="none" style={styles.glow} />}
      <View testID="today-wave-head" style={styles.head}>
        <Row justify="space-between" align="center" wrap>
          <View
            testID="today-wave-badge"
            style={[styles.badge, next ? styles.badgeNext : styles.badgeIdle]}
          >
            <Text
              variant="labelSm"
              color={next ? accent.accentInk : ink.ink2}
              style={styles.badgeText}
            >
              {next
                ? copy.today.rhythm.dueNow
                : wave.completed === true
                  ? copy.today.day.completed
                  : copy.today.rhythm.waveIndex(index)}
            </Text>
          </View>
        </Row>
        <View testID="today-wave-title" style={styles.titleRow}>
          <View testID="today-wave-title-line" style={styles.titleLine}>
            <Text
              variant="title3"
              color={receded ? ink.ink2 : ink.ink}
              style={styles.timeTitle}
            >
              {waveClockLabel(wave.time)}
            </Text>
            <Text variant="title3" color={receded ? ink.ink2 : ink.ink} style={styles.timeTitle}>
              {title}
            </Text>
          </View>
        </View>
        <View testID="today-wave-manner">
          <Text
            variant="caption"
            color={ink.ink2}
            numberOfLines={WAVE_MANNER_LINES}
            style={styles.manner}
          >
            {manner}
          </Text>
        </View>
      </View>
      <View>
        <Waveform
          active={next}
          well={next ? 'next' : wave.position === 'later' ? 'later' : 'passed'}
        />
        <View testID="today-wave-footer" style={styles.footer}>
          <Row justify="space-between" align="center" wrap>
            <View testID="today-wave-phrases">
              <Text variant="labelSm" color={ink.ink2} style={styles.phrases}>
                {copy.today.rhythm.wavePhrases(setSize)}
              </Text>
            </View>
            {start && (
              <View
                testID="today-wave-start"
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={[styles.startPill, stationeryElevation('emblemSoft')]}
              >
                <View
                  testID="today-wave-start-tri"
                  accessible={false}
                  importantForAccessibility="no-hide-descendants"
                  style={styles.startTri}
                />
                <Text variant="captionSm" color={surface.app} style={styles.startLabel}>
                  {copy.today.rhythm.startWave}
                </Text>
              </View>
            )}
          </Row>
        </View>
      </View>
    </View>
    </View>
  )
  if (start) {
    return (
      <Arrival kind="fadeIn">
        <Pressable
          feedback="row"
          pressMotion="deboss"
          accessibilityLabel={copy.a11y.today.nextWaveRow(title, detail)}
          onPress={() => {
            haptics.confirm()
            onStartWave(wave.key)
          }}
        >
          {card}
        </Pressable>
      </Arrival>
    )
  }
  return <Arrival kind="fadeIn">{card}</Arrival>
}

function waveClockLabel(hhmm: string): string {
  const parts = waveClockParts(hhmm)
  return parts === null
    ? hhmm
    : copy.today.rhythm.waveClock(parts.hour, parts.minute, parts.period)
}

function Waveform({
  active,
  well,
}: {
  active: boolean
  well: 'next' | 'passed' | 'later'
}) {
  const heights = active ? WAVEFORM_ACTIVE : WAVEFORM_IDLE
  return (
    <View
      testID="today-waveform"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.waveform,
        well === 'next'
          ? styles.waveformNext
          : well === 'later'
            ? styles.waveformLater
            : styles.waveformPassed,
      ]}
    >
      {heights.map((height, index) => (
        <View
          key={index}
          style={{
            width: WAVEFORM_BAR_W,
            height,
            borderRadius: radius.pill,
            backgroundColor: active
              ? index < 7
                ? accent.accent
                : accent.tint
              : surface.sunken2,
          }}
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  block: { gap: space['2'] },
  heading: {
    fontSize: WAVE_HEADING,
    lineHeight: WAVE_HEADING_LINE,
    fontWeight: '600',
  },
  mixes: { textTransform: 'uppercase', fontWeight: LABEL_BOLD_WEIGHT },
  phrases: { fontWeight: LABEL_BOLD_WEIGHT },
  scrollerClip: { overflow: 'hidden', marginHorizontal: -WAVE_BLEED },
  scroller: { width: '100%' },
  track: {
    paddingHorizontal: WAVE_BLEED,
    gap: WAVE_SNAP_GAP,
    paddingBottom: WAVE_TRACK_PB,
  },
  cardLift: {
    borderRadius: WAVE_CARD_RADIUS,
  },
  card: {
    padding: WAVE_CARD_PAD,
    borderRadius: WAVE_CARD_RADIUS,
    gap: WAVE_CARD_GAP,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  head: { gap: WAVE_HEAD_GAP },
  cardNext: {
    backgroundColor: surface.card,
  },
  cardPassed: { backgroundColor: surface.sunken },
  cardLater: { backgroundColor: surface.card },
  glow: {
    position: 'absolute',
    right: -32,
    top: -32,
    width: CARD_GLOW,
    height: CARD_GLOW,
    borderRadius: CARD_GLOW,
    backgroundColor: accent.tint,
    opacity: 0.4,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: DUE_BADGE_PY,
    borderRadius: radius.pill,
  },
  badgeNext: { backgroundColor: accent.tint },
  badgeIdle: { backgroundColor: surface.sunken2 },
  badgeText: { textTransform: 'uppercase', fontWeight: LABEL_BOLD_WEIGHT },
  timeTitle: {
    fontSize: WAVE_TITLE,
    lineHeight: WAVE_TITLE_LINE,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  manner: {
    fontSize: WAVE_MANNER,
    lineHeight: WAVE_MANNER_LINE,
    fontWeight: '400',
  },
  titleRow: { marginTop: WAVE_TITLE_MT },
  titleLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    gap: WAVE_TITLE_GAP,
  },
  footer: { paddingTop: WAVE_FOOTER_PT },
  waveform: {
    height: WAVEFORM_H,
    marginVertical: WAVEFORM_MY,
    padding: WAVEFORM_PAD,
    boxSizing: 'border-box',
    overflow: 'hidden',
    borderRadius: WAVEFORM_RADIUS,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: WAVEFORM_GAP,
  },
  waveformNext: { backgroundColor: surface.card },
  waveformPassed: { backgroundColor: surface.sunken2 },
  waveformLater: { backgroundColor: surface.sunken },
  startPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: START_PILL_GAP,
    backgroundColor: accent.accent,
    paddingHorizontal: START_PILL_PX,
    paddingVertical: START_PILL_PY,
    borderRadius: radius.pill,
  },
  startTri: {
    width: 0,
    height: 0,
    borderTopWidth: PLAY_TRI_H,
    borderBottomWidth: PLAY_TRI_H,
    borderLeftWidth: PLAY_TRI_W,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: surface.app,
  },
  startLabel: {
    fontWeight: '600',
    fontSize: START_LABEL,
    lineHeight: START_LABEL_LINE,
    letterSpacing: START_LABEL_TRACK,
    textTransform: 'none',
  },
  repsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: space['1'],
  },
  now: {
    minWidth: 34,
    fontVariant: ['tabular-nums'],
    textTransform: 'none',
  },
  grow: { flex: 1 },
  listen: { marginTop: space['0.5'] },
})
