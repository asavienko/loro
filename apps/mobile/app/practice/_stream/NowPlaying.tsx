import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useLocale } from '../../../src/lib/i18n'
import { copy, themeLabel } from '../../../src/lib/copy'
import { haptics } from '../../../src/lib/haptics'
import {
  Arrival,
  EmojiTile,
  Equalizer,
  Pressable,
  Row,
  Stack,
  Text,
} from '../../../src/ui/primitives'
import { audioPlaybackNote } from '../../../src/lib/audioSpeech'
import { stationeryElevation, stationeryElevations } from '../../../src/ui/elevation'
import { accent, ink, line, onDark, radius, space, surface } from '../../../src/ui/theme'
import type { PhraseView } from '../../../src/store'
import type { Difficulty } from '@loro/core'
import { CadenceBar } from './CadenceBar'
import { RatePills } from './RatePills'
import { RatingCapsule } from './RatingCapsule'
import { useStreamCadence } from './useStreamCadence'
import {
  HERO_RADIUS,
  LOVE_FACE,
  LOVE_HIT,
  LOVE_GLYPH,
  STAGE_BORDER,
  PAUSE_BAR_H,
  PAUSE_BAR_W,
  PAUSE_GAP,
  PLAY_TRI_H,
  PLAY_TRI_W,
  STAGE,
  STAGE_GLYPH,
  STAGE_TITLE,
  STAGE_TITLE_LINE,
  STAGE_TITLE_TRACK,
  STAGE_TITLE_GAP,
  STAGE_WRAP_Y,
  TITLE_COUNTER_GAP,
  COUNTER_WEIGHT,
  THEME_TRACK,
  COUNTER_NOTE_GAP,
  NOTE_TRANSPORT_GAP,
  TITLE_PAD_BOTTOM,
  TITLE_PAD_END,
  TITLE_PAD_TOP,
  TITLE_ROW_GAP,
  STAGE_MEANING,
  STAGE_MEANING_LINE,
  STAGE_PANEL_MAX,
  STAGE_PANEL_PAD,
  STAGE_PANEL_RADIUS,
  STAGE_PILL_ARROW,
  STAGE_PILL_CLOSED,
  STAGE_PILL_FACE,
  STAGE_PILL_GRAMMAR,
  STAGE_PILL_MARK_GAP,
  STAGE_PILL_MNEMONIC,
  STAGE_PILL_OPEN,
  STAGE_PILL_PHONETICS,
  STAGE_PILL_WEIGHT,
  STAGE_PILL_WEIGHT_ON,
  STAGE_PILL_TOP,
  STAGE_PILL_X,
  STAGE_PILL_Y,
  stagePillShadows,
} from './geometry'
import { PauseMark, PlayMark } from './marks'
import { stageNoteFields, type StagePane } from './stageNotes'

export function NowPlaying({
  phrase,
  position,
  onPrevious,
  onNext,
  onToggleLoved,
  difficulty,
  onRate,
}: {
  phrase: PhraseView
  position: string
  onPrevious: () => void
  onNext: () => void
  onToggleLoved: () => void
  difficulty: Difficulty
  onRate: (difficulty: Difficulty) => void
}) {
  useLocale()
  const cadence = useStreamCadence(phrase)
  return (
    <Arrival kind="fadeIn">
      <Stack gap={NOTE_TRANSPORT_GAP}>
        <Stack gap={COUNTER_NOTE_GAP}>
        <Stack gap={TITLE_COUNTER_GAP}>
        <Stack gap={STAGE_TITLE_GAP}>
        <View testID="stream-stage-wrap" style={styles.stageWrap}>
          <View testID="stream-stage" style={[styles.stageLift, stationeryElevation('playRaised')]}>
            <View style={styles.stage}>
            <EmojiTile
              emoji={phrase.emoji}
              size={STAGE}
              fontSize={STAGE_GLYPH}
              radius={HERO_RADIUS}
              background={accent.wash}
            />
            <View pointerEvents="none" style={styles.stageEdge} />
            {cadence.playing && (
              <View style={styles.eq}>
                <Equalizer active color={accent.accent} />
              </View>
            )}
            </View>
            <StageNotes phrase={phrase} />
          </View>
        </View>
        <View testID="stream-title-row" style={styles.titleRow}>
        <Row align="flex-start" justify="space-between" gap={TITLE_ROW_GAP}>
          <View testID="stream-title-copy" style={styles.copy}>
            <View testID="stream-phrase-title">
              <Text variant="title2" color={ink.ink} lang="target" numberOfLines={4} style={styles.phrase}>
                {phrase.targetText}
              </Text>
            </View>
            {phrase.translation.length > 0 && (
              <View testID="stream-stage-meaning">
              <Text variant="caption" color={ink.ink2} numberOfLines={2} style={styles.meaning}>
                {copy.stream.quotedTranslation(phrase.translation)}
              </Text>
              </View>
            )}
            <View testID="stream-theme">
              <Text variant="captionSm" color={ink.ink} numberOfLines={1} style={styles.theme}>
                {themeLabel(phrase.theme)}
              </Text>
            </View>
          </View>
          <View testID="stream-love" style={styles.love}>
          <Pressable
            feedback="smallButton"
            accessibilityLabel={
              phrase.loved ? copy.a11y.common.removeFromLoved : copy.a11y.stream.loveThisPhrase
            }
            selected={phrase.loved}
            onPress={() => {
              haptics.select()
              onToggleLoved()
            }}
            style={styles.love}
          >
            <View testID="stream-love-face">
              <Text color={ink.ink} style={styles.loveGlyph}>
                {LOVE_GLYPH}
              </Text>
            </View>
          </Pressable>
          </View>
        </Row>
        </View>
        </Stack>
        <View testID="stream-counter">
        <Text variant="labelSm" color={ink.ink2} style={styles.counter}>
          {position}
        </Text>
        </View>
        </Stack>
        <View testID="stream-audio-note" style={styles.note}>
          <Text variant="captionSm" color={ink.ink2}>
            {!cadence.audio.canPlay
              ? copy.stream.audioNote
              : audioPlaybackNote(
                  cadence.audio.source,
                  cadence.audio.playback,
                  cadence.audio.playbackError,
                )}
          </Text>
        </View>
        </Stack>
        <View>
          <CadenceBar
            loop={cadence.loop}
            canPlay={cadence.audio.canPlay}
            playing={cadence.playing}
            playMark={
              cadence.playing ? (
                <PauseMark
                  width={PAUSE_BAR_W}
                  height={PAUSE_BAR_H}
                  gap={PAUSE_GAP}
                  color={surface.app}
                />
              ) : (
                <PlayMark wide={PLAY_TRI_W} half={PLAY_TRI_H} color={surface.app} />
              )
            }
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
          <RatingCapsule value={difficulty} onRate={onRate} />
          <RatePills rate={cadence.rate} onRate={cadence.setRate} />
        </View>
      </Stack>
    </Arrival>
  )
}

const styles = StyleSheet.create({
  stageWrap: { alignItems: 'center', paddingVertical: STAGE_WRAP_Y },
  stageLift: {
    position: 'relative',
    width: STAGE,
    height: STAGE,
    borderRadius: HERO_RADIUS,
  },
  stage: {
    position: 'relative',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    borderRadius: HERO_RADIUS,
  },
  stageEdge: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: HERO_RADIUS,
    borderWidth: STAGE_BORDER,
    borderColor: line.default,
  },
  stageNotes: {
    position: 'absolute',
    top: STAGE_PILL_TOP,
    left: space['2.5'],
    right: space['2.5'],
    gap: space['1.5'],
    zIndex: 2,
  },
  stagePills: { width: '100%' },
  stagePill: {
    paddingHorizontal: STAGE_PILL_X,
    paddingVertical: STAGE_PILL_Y,
    borderRadius: radius.pill,
    backgroundColor: surface.dark,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: onDark.line,
  },
  stagePillOn: {
    backgroundColor: accent.accent,
    borderColor: accent.accent,
  },
  stagePillLabel: { fontSize: STAGE_PILL_FACE },
  stagePillArrow: { fontSize: STAGE_PILL_ARROW, lineHeight: STAGE_PILL_ARROW },
  stagePanel: {
    borderRadius: STAGE_PANEL_RADIUS,
    backgroundColor: surface.dark,
    padding: STAGE_PANEL_PAD,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: onDark.line,
    maxHeight: STAGE_PANEL_MAX,
  },
  eq: {
    position: 'absolute',
    right: space['2'],
    bottom: space['2'],
  },
  titleRow: { paddingTop: TITLE_PAD_TOP, paddingBottom: TITLE_PAD_BOTTOM },
  copy: { flex: 1, minWidth: 0, gap: space['0.5'], paddingRight: TITLE_PAD_END },
  phrase: {
    fontSize: STAGE_TITLE,
    lineHeight: STAGE_TITLE_LINE,
    letterSpacing: STAGE_TITLE_TRACK,
    fontWeight: '700',
    fontStyle: 'italic',
  },
  love: {
    width: LOVE_HIT,
    height: LOVE_HIT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loveGlyph: { fontSize: LOVE_FACE, lineHeight: LOVE_FACE },
  meaning: {
    fontStyle: 'italic',
    fontSize: STAGE_MEANING,
    lineHeight: STAGE_MEANING_LINE,
  },
  counter: { textTransform: 'none', fontWeight: COUNTER_WEIGHT },
  theme: { letterSpacing: THEME_TRACK },
  note: {
    paddingHorizontal: space['2'],
    paddingVertical: space['1'],
    borderRadius: radius.md,
    backgroundColor: surface.sunken,
  },
})

const STAGE_PILL_MARK: Record<StagePane, string> = {
  mnemonic: STAGE_PILL_MNEMONIC,
  grammar: STAGE_PILL_GRAMMAR,
  phonetics: STAGE_PILL_PHONETICS,
}

function StageNotes({ phrase }: { phrase: PhraseView }) {
  useLocale()
  const fields = stageNoteFields(phrase)
  const [open, setOpen] = useState<StagePane | null>(null)
  const empty = {
    mnemonic: copy.stream.stage.mnemonicEmpty,
    grammar: copy.stream.stage.grammarEmpty,
    phonetics: copy.stream.stage.phoneticsEmpty,
  }
  const body = open === null ? undefined : (fields[open] ?? empty[open])
  return (
    <View style={styles.stageNotes} pointerEvents="box-none">
      <Row gap={space['1.5']} justify="center" wrap style={styles.stagePills}>
        <StagePill
          pane="mnemonic"
          open={open}
          mark={STAGE_PILL_MARK.mnemonic}
          accessibilityLabel={copy.a11y.stream.mnemonic}
          onToggle={setOpen}
        />
        <StagePill
          pane="grammar"
          open={open}
          mark={STAGE_PILL_MARK.grammar}
          accessibilityLabel={copy.a11y.stream.grammar}
          onToggle={setOpen}
        />
        <StagePill
          pane="phonetics"
          open={open}
          mark={STAGE_PILL_MARK.phonetics}
          accessibilityLabel={copy.a11y.stream.phonetics}
          onToggle={setOpen}
        />
      </Row>
      {body !== undefined && body.length > 0 ? (
        <View
          testID="stream-stage-panel"
          style={[styles.stagePanel, stationeryElevation('playerFloat')]}
        >
          <Text variant="caption" color={onDark.primary} numberOfLines={8}>
            {body}
          </Text>
        </View>
      ) : null}
    </View>
  )
}

function StagePill({
  pane,
  open,
  mark,
  accessibilityLabel,
  onToggle,
}: {
  pane: StagePane
  open: StagePane | null
  mark: string
  accessibilityLabel: string
  onToggle: (next: StagePane | null | ((current: StagePane | null) => StagePane | null)) => void
}) {
  const selected = open === pane
  const ink = selected ? accent.accentOnDark : onDark.primary
  return (
    <View testID="stream-stage-pill" style={stationeryElevations(stagePillShadows(selected))}>
      <Pressable
        feedback="smallButton"
        pressMotion="deboss"
        accessibilityLabel={accessibilityLabel}
        selected={selected}
        onPress={() => {
          haptics.select()
          onToggle((current) => (current === pane ? null : pane))
        }}
        style={[styles.stagePill, selected && styles.stagePillOn]}
      >
        <Row align="center" gap={STAGE_PILL_MARK_GAP}>
          <View testID={`stream-stage-mark-${pane}`}>
            <Text
              variant="labelSm"
              color={ink}
              style={[
                styles.stagePillLabel,
                { fontWeight: selected ? STAGE_PILL_WEIGHT_ON : STAGE_PILL_WEIGHT },
              ]}
            >
              {mark}
            </Text>
          </View>
          <Text
            color={ink}
            style={[
              styles.stagePillArrow,
              { fontWeight: selected ? STAGE_PILL_WEIGHT_ON : STAGE_PILL_WEIGHT },
            ]}
          >
            {selected ? STAGE_PILL_OPEN : STAGE_PILL_CLOSED}
          </Text>
        </Row>
      </Pressable>
    </View>
  )
}
