import { useMemo, useRef, useState } from 'react'
import { PanResponder, Platform, StyleSheet, View } from 'react-native'
import { copy, themeLabel } from '../../../src/lib/copy'
import { haptics } from '../../../src/lib/haptics'
import { useLocale } from '../../../src/lib/i18n'
import { Arrival, Pressable, Row, Stack, Text } from '../../../src/ui/primitives'
import { stationeryElevation } from '../../../src/ui/elevation'
import { difficultyMeta, ink, line, space, surface } from '../../../src/ui/theme'
import type { PhraseView } from '../../../src/store'
import {
  QUEUE_CHIP_FACE,
  QUEUE_CHIP_LETTER,
  QUEUE_CHIP_WEIGHT,
  QUEUE_MEANING,
  QUEUE_MEANING_MT,
  QUEUE_PHRASE,
  QUEUE_PHRASE_LINES,
  QUEUE_TRACK_FACE,
  QUEUE_TRACK_LETTER,
  QUEUE_TRACK_WEIGHT,
  QUEUE_REORDER,
  QUEUE_REORDER_FACE,
  QUEUE_REORDER_GLYPH,
  QUEUE_TRAIL_GAP,
  queueChipPadX,
  queueChipPadY,
  queueChipRadius,
  queueRowPadX,
  queueStackGap,
  queueRowRadius,
  queueOptionsRadius,
  queueOptionsSize,
  queueTrack,
  ROW_PAD,
  SECTION_KICKER,
  SECTION_KICKER_PAD_X,
  TRACK_WIDTH,
  type QueueDressing,
} from './geometry'
import { TrackOptionsButton } from './TrackOptions'

const REORDER_INTENT = 6
const REORDER_COMMIT = 12

export function UpNext({
  upcoming,
  startIndex,
  remaining,
  dressing = 'editorial',
  onJump,
  onOpenOptions,
  onReorder,
}: {
  upcoming: readonly PhraseView[]
  /** 1-based queue index of the first upcoming row. */
  startIndex: number
  remaining: number
  dressing?: QueueDressing | undefined
  onJump: (queueIndex: number) => void
  onOpenOptions: (queueIndex: number) => void
  onReorder?: ((queueIndex: number, slots: number) => void) | undefined
}) {
  useLocale()
  const [rowHeight, setRowHeight] = useState(QUEUE_REORDER * 2)
  return (
    <Arrival kind="fadeIn">
      <Stack gap={space['2']}>
        <View testID="stream-upnext-kicker" style={styles.kickerRow}>
        <Text variant="labelSm" color={ink.ink2} style={styles.heading}>
          {copy.stream.upNext(remaining)}
        </Text>
        </View>
        <View testID="stream-upnext-stack" style={{ gap: queueStackGap(dressing) }}>
          {upcoming.map((phrase, offset) => (
            <View
              key={phrase.id}
              testID="stream-queue-row"
              style={[
                styles.row,
                {
                  borderRadius: queueRowRadius(dressing),
                  paddingHorizontal: queueRowPadX(dressing),
                },
              ]}
              onLayout={(event) => {
                const height = event.nativeEvent.layout.height
                if (height > 0) setRowHeight(height)
              }}
            >
            <Row align="center" gap={ROW_PAD} style={styles.hit}>
            <Pressable
              feedback="row"
              pressMotion="deboss"
              accessibilityLabel={copy.a11y.stream.queueRow(
                phrase.targetText,
                phrase.translation,
                copy.difficulty[phrase.difficulty],
              )}
              accessibilityHint={copy.a11y.stream.jumpTo(phrase.targetText)}
              onPress={() => {
                haptics.select()
                onJump(startIndex + offset)
              }}
              style={styles.lead}
            >
              <View testID="stream-queue-track">
                <Text variant="label" color={ink.ink2} style={styles.track}>
                  {queueTrack(startIndex + offset + 1)}
                </Text>
              </View>
              <View style={styles.copy}>
                <View testID="stream-queue-phrase-row">
                <Row align="center" gap={space['2']} wrap>
                  <View testID="stream-queue-phrase" style={styles.phraseWrap}>
                  <Text
                    variant="body"
                    color={ink.ink}
                    lang="target"
                    numberOfLines={QUEUE_PHRASE_LINES}
                    style={styles.phrase}
                  >
                    {phrase.targetText}
                  </Text>
                  </View>
                  {dressing === 'simple' ? (
                    <QueueChip
                      testID="stream-queue-theme"
                      dressing={dressing}
                      label={themeLabel(phrase.theme)}
                      color={ink.ink2}
                      background={surface.sunken}
                    />
                  ) : (
                    <QueueChip
                      testID="stream-queue-difficulty"
                      dressing={dressing}
                      label={copy.difficulty[phrase.difficulty]}
                      color={difficultyMeta[phrase.difficulty].color}
                      background={difficultyMeta[phrase.difficulty].bg}
                    />
                  )}
                </Row>
                </View>
                {phrase.translation.length > 0 && (
                  <View testID="stream-queue-meaning" style={styles.meaning}>
                  <Text
                    variant="caption"
                    color={ink.ink2}
                    numberOfLines={1}
                    style={styles.meaningFace}
                  >
                    {copy.stream.quotedTranslation(phrase.translation)}
                  </Text>
                  </View>
                )}
              </View>
              {dressing === 'simple' ? (
                <View testID="stream-queue-trail">
                  <QueueChip
                    testID="stream-queue-difficulty"
                    dressing={dressing}
                    label={copy.difficulty[phrase.difficulty]}
                    color={difficultyMeta[phrase.difficulty].color}
                    background={difficultyMeta[phrase.difficulty].bg}
                  />
                </View>
              ) : null}
            </Pressable>
            <QueueActions
              dressing={dressing}
              rowHeight={rowHeight}
              reorderLabel={copy.a11y.stream.reorder(phrase.targetText)}
              onOpenOptions={() => {
                onOpenOptions(startIndex + offset)
              }}
              onReorder={
                onReorder
                  ? (slots) => {
                      onReorder(startIndex + offset, slots)
                    }
                  : undefined
              }
            />
            </Row>
            </View>
          ))}
        </View>
      </Stack>
    </Arrival>
  )
}

function QueueActions({
  dressing,
  rowHeight,
  reorderLabel,
  onOpenOptions,
  onReorder,
}: {
  dressing: QueueDressing
  rowHeight: number
  reorderLabel: string
  onOpenOptions: () => void
  onReorder?: ((slots: number) => void) | undefined
}) {
  useLocale()
  const options = (
    <TrackOptionsButton
      label={copy.a11y.stream.options}
      size={queueOptionsSize(dressing)}
      corner={queueOptionsRadius(dressing)}
      axis="horiz"
      testID="stream-options"
      onPress={onOpenOptions}
    />
  )
  if (dressing !== 'simple') return options
  return (
    <View testID="stream-queue-actions" style={styles.actions}>
      {options}
      {onReorder ? (
        <QueueReorderHandle
          label={reorderLabel}
          rowHeight={rowHeight}
          onMove={onReorder}
        />
      ) : null}
    </View>
  )
}

function QueueReorderHandle({
  label,
  rowHeight,
  onMove,
}: {
  label: string
  rowHeight: number
  onMove: (slots: number) => void
}) {
  useLocale()
  const originY = useRef<number | null>(null)
  const move = useRef(onMove)
  move.current = onMove
  const height = useRef(rowHeight)
  height.current = rowHeight
  const commit = (dx: number, dy: number): void => {
    if (Math.abs(dx) >= Math.abs(dy) || Math.abs(dy) < REORDER_COMMIT) return
    const slots = Math.round(dy / Math.max(height.current, 1))
    const moved = slots === 0 ? (dy < 0 ? -1 : 1) : slots
    move.current(moved)
  }
  const responder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dy) > REORDER_INTENT && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onMoveShouldSetPanResponderCapture: (_, gesture) =>
          Math.abs(gesture.dy) > REORDER_INTENT && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderRelease: (_, gesture) => {
          commit(gesture.dx, gesture.dy)
        },
        onPanResponderTerminationRequest: () => true,
      }),
    [],
  )
  return (
    <View
      testID="stream-queue-reorder"
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={copy.a11y.stream.reorderHint}
      {...responder.panHandlers}
      {...(Platform.OS === 'web'
        ? {
            onPointerDown: (event: { nativeEvent: { pageY: number } }) => {
              originY.current = event.nativeEvent.pageY
            },
            onPointerUp: (event: { nativeEvent: { pageY: number } }) => {
              if (originY.current === null) return
              const dy = event.nativeEvent.pageY - originY.current
              originY.current = null
              commit(0, dy)
            },
          }
        : {})}
      style={styles.reorderHit}
    >
      <View testID="stream-queue-reorder-mark">
        <Text color={ink.muted} style={styles.reorderGlyph}>
          {QUEUE_REORDER_GLYPH}
        </Text>
      </View>
    </View>
  )
}

function QueueChip({
  testID,
  dressing,
  label,
  color,
  background,
}: {
  testID: string
  dressing: QueueDressing
  label: string
  color: string
  background: string
}) {
  return (
    <View
      testID={testID}
      style={[
        styles.chip,
        {
          backgroundColor: background,
          paddingHorizontal: queueChipPadX(dressing),
          paddingVertical: queueChipPadY(dressing),
          borderRadius: queueChipRadius(dressing),
        },
      ]}
    >
      <Text variant="labelSm" color={color} style={styles.chipLabel}>
        {label}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  kickerRow: { paddingHorizontal: SECTION_KICKER_PAD_X },
  heading: {
    textTransform: 'uppercase',
    fontWeight: '700',
    fontSize: SECTION_KICKER,
  },
  row: {
    paddingVertical: ROW_PAD,
    backgroundColor: surface.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: line.default,
    ...stationeryElevation('queueSoft'),
  },
  hit: { width: '100%' },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    gap: QUEUE_TRAIL_GAP,
  },
  lead: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: ROW_PAD,
  },
  track: {
    minWidth: TRACK_WIDTH,
    fontVariant: ['tabular-nums'],
    textTransform: 'none',
    fontSize: QUEUE_TRACK_FACE,
    fontWeight: QUEUE_TRACK_WEIGHT,
    letterSpacing: QUEUE_TRACK_LETTER,
  },
  copy: { flex: 1, minWidth: 0 },
  phraseWrap: { flexShrink: 1, minWidth: 0 },
  phrase: { fontStyle: 'italic', fontSize: QUEUE_PHRASE, fontWeight: '600' },
  meaning: { marginTop: QUEUE_MEANING_MT },
  meaningFace: { fontSize: QUEUE_MEANING },
  chip: { flexShrink: 0 },
  chipLabel: {
    fontSize: QUEUE_CHIP_FACE,
    fontWeight: QUEUE_CHIP_WEIGHT,
    letterSpacing: QUEUE_CHIP_LETTER,
    textTransform: 'none',
  },
  reorderHit: {
    width: QUEUE_REORDER,
    height: QUEUE_REORDER,
    minWidth: QUEUE_REORDER,
    minHeight: QUEUE_REORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reorderGlyph: { fontSize: QUEUE_REORDER_FACE, lineHeight: QUEUE_REORDER_FACE },
})
