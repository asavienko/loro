import { useLocale } from '../../src/lib/i18n'
/**
 * Adaptive stream — Loro.dc.html:600–677, dressed as three v1.3 presentations
 * on this route: editorial list landing (hero emblemSoft), `?queue=simple`
 * (hero emblemRaised, 28 play), and focused 280 now-playing.
 *
 * Editorial rank stays Rust's. Simple dressing may overlay a device-local listen
 * playlist. Café art, IPA, scrubber times, 1.25×, invented voices and lyrics are
 * omitted. Loop count and 0.8 / 0.92 / 1.0 are the real play settings.
 * The drill drawer only exposes Mark learned — love and rerate stay on the player.
 * Options / Track options open a sheet of those same actions plus jump. Grammar
 * binds to the real catalog or learner note and stays empty when neither exists.
 */
import { useEffect, useMemo, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router, useLocalSearchParams, useNavigation } from 'expo-router'
import { applyListenOrder, isActive, moveListenItem, type Difficulty } from '@loro/core'
import { copy } from '../../src/lib/copy'
import { haptics } from '../../src/lib/haptics'
import { PracticeEmptyState } from './_emptyPractice'
import { Pressable, Row, Screen, Text } from '../../src/ui/primitives'
import { stationeryElevation } from '../../src/ui/elevation'
import { parchmentGlassStyle } from '../../src/ui/parchmentGlass'
import { useTheme } from '../../src/ui/ThemeProvider'
import { ink, line, radius, space, surface } from '../../src/ui/theme'
import { toView, useApp } from '../../src/store'
import { rustCoreFacade } from '../../src/store/coreFacade'
import { deviceClock } from '../../src/lib/clock'
import { DrillDrawer } from './_stream/DrillDrawer'
import { EarlierList } from './_stream/EarlierList'
import { EditorialNowPlaying } from './_stream/EditorialNowPlaying'
import { NowPlaying } from './_stream/NowPlaying'
import { SimpleQueueFooter } from './_stream/SimpleQueueFooter'
import { QueueChrome } from './_stream/QueueChrome'
import { TrackOptionsButton, TrackOptionsSheet } from './_stream/TrackOptions'
import { UpNext } from './_stream/UpNext'
import {
  DISMISS,
  DISMISS_FACE,
  DISMISS_GLYPH,
  DONE_FACE,
  donePadX,
  donePadY,
  doneWeight,
  FOCUSED_GAP,
  FOCUSED_GUTTER,
  LANDING_GAP,
  landingPadBottom,
  landingPadTop,
  queueHeaderPadBottom,
  HEADER_HIT_NUDGE,
  HEADER_PAD_BOTTOM,
  HEADER_PAD_TOP,
  LANDING_HEADER_GUTTER,
  KICKER_PAD_X,
  OPTIONS_PILL,
  SECTION_KICKER,
  SIMPLE_FOOTER_PAD_TOP,
  SIMPLE_FOOTER_PAD_X,
  queueDressingFromParam,
  queueTrack,
  type QueueDressing,
} from './_stream/geometry'

const UP_NEXT_ROWS = 7
/** HTML focused kicker `tracking-[0.16em]` at `text-[10px]`. */
const PLAYLIST_TRACK = 1.6

export default function Stream() {
  useLocale()
  const insets = useSafeAreaInsets()
  const nativeLanguage = useApp((s) => s.nativeLanguage)
  const phrases = useApp((s) => s.phrases)
  const setDifficulty = useApp((s) => s.setDifficulty)
  const toggleLoved = useApp((s) => s.toggleLoved)
  const markLearned = useApp((s) => s.markLearned)
  const cursor = useApp((state) => state.streamCursor)
  const setCursor = useApp((state) => state.setStreamCursor)
  const listenQueue = useApp((state) => state.listenQueue)
  const setListenQueue = useApp((state) => state.setListenQueue)
  const [earlierHidden, setEarlierHidden] = useState(false)
  const [drillOpen, setDrillOpen] = useState(true)
  const [focused, setFocused] = useState(false)
  const [optionsIndex, setOptionsIndex] = useState<number | null>(null)
  const { queue: queueParam } = useLocalSearchParams<{ queue?: string | string[] }>()
  const dressing = queueDressingFromParam(queueParam)
  const navigation = useNavigation()
  const ranked = useMemo(() => {
    const now = deviceClock.now()
    return phrases
      .filter(isActive)
      .slice()
      .sort(
        (a, b) =>
          rustCoreFacade.streamRank(a, now) - rustCoreFacade.streamRank(b, now) ||
          a.id.localeCompare(b.id),
      )
      .map(toView)
  }, [phrases, nativeLanguage])
  const queue = useMemo(
    () => (dressing === 'simple' ? applyListenOrder(ranked, listenQueue) : ranked),
    [dressing, ranked, listenQueue],
  )
  const position = cursor % Math.max(1, queue.length)
  const current = queue[position]
  const empty = queue.length === 0 || current === undefined
  useEffect(() => {
    const headerPadBottom = queueHeaderPadBottom(dressing)
    navigation.setOptions({
      headerShown: !focused,
      headerTitleAlign: 'center',
      headerTitle: () => <QueueChrome count={queue.length} />,
      headerTitleContainerStyle: { paddingBottom: headerPadBottom },
      headerLeftContainerStyle: {
        paddingStart: LANDING_HEADER_GUTTER,
        paddingBottom: headerPadBottom,
      },
      headerRightContainerStyle: {
        paddingEnd: LANDING_HEADER_GUTTER,
        paddingBottom: headerPadBottom,
      },
      headerRight:
        empty || focused
          ? () => null
          : () => (
              <StreamDoneChip
                dressing={dressing}
                onPress={() => {
                  haptics.select()
                  if (navigation.canGoBack()) router.back()
                  else router.replace('/')
                }}
              />
            ),
    })
  }, [dressing, empty, focused, navigation, queue.length])
  if (queue.length === 0 || current === undefined) {
    return (
      <Screen>
        <PracticeEmptyState
          title={copy.stream.empty.title}
          body={copy.stream.empty.body}
          actionLabel={copy.stream.empty.action}
          gap={space['2']}
        />
      </Screen>
    )
  }
  const advance = (): void => {
    setCursor((position + 1) % queue.length)
  }
  const jumpTo = (index: number): void => {
    setCursor(index)
  }
  const reorderUpcoming = (from: number, slots: number): void => {
    const next = moveListenItem(
      queue.map((phrase) => phrase.id),
      from,
      from + slots,
      position + 1,
    )
    if (next === null) return
    haptics.reorder()
    setListenQueue(next)
  }
  const ratePhrase = (difficulty: Difficulty): void => {
    haptics.select()
    setDifficulty(current.id, difficulty)
  }
  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[
          s.content,
          focused ? s.focusedReset : null,
          {
            paddingBottom: focused
              ? insets.bottom + space['5']
              : 0,
          },
        ]}
      >
        {focused ? (
          <View testID="stream-focused" style={s.focused}>
            <View testID="stream-focused-header" style={s.focusedHeader}>
            <Row align="center" justify="space-between">
              <View testID="stream-dismiss" style={[s.dismiss, s.dismissNudge]}>
                <Pressable
                  feedback="icon"
                  pressMotion="deboss"
                  accessibilityLabel={copy.a11y.stream.dismissPlayer}
                  onPress={() => {
                    haptics.select()
                    setFocused(false)
                  }}
                  style={s.dismiss}
                >
                  <View testID="stream-dismiss-face">
                    <Text color={ink.ink} style={s.dismissMark}>
                      {DISMISS_GLYPH}
                    </Text>
                  </View>
                </Pressable>
              </View>
              <View testID="stream-playlist-kicker" style={s.playlistKicker}>
              <Text
                variant="labelSm"
                color={ink.ink2}
                align="center"
                numberOfLines={1}
                style={s.playlistKickerFace}
              >
                {copy.stream.playingFromPlaylist}
              </Text>
              </View>
              <TrackOptionsButton
                label={copy.a11y.stream.trackOptions}
                size={DISMISS}
                corner={OPTIONS_PILL}
                axis="vert"
                testID="stream-track-options"
                style={s.optionsNudge}
                onPress={() => {
                  setOptionsIndex(position)
                }}
              />
            </Row>
            </View>
            <NowPlaying
              phrase={current}
              position={copy.stream.counter(position + 1, queue.length)}
              onPrevious={() => {
                setCursor(Math.max(0, position - 1))
              }}
              onNext={advance}
              onToggleLoved={() => {
                haptics.select()
                toggleLoved(current.id)
              }}
              difficulty={current.difficulty}
              onRate={ratePhrase}
            />
            <DrillDrawer
              open={drillOpen}
              onToggle={() => {
                setDrillOpen((value) => !value)
              }}
              onMarkLearned={() => {
                haptics.confirm()
                markLearned(current.id, true)
              }}
            />
          </View>
        ) : (
          <View
            testID="stream-landing"
            style={[
              s.landing,
              {
                paddingTop: landingPadTop(dressing),
                paddingBottom: landingPadBottom(dressing),
              },
            ]}
          >
            <EarlierList
              phrases={queue.slice(0, position)}
              hidden={earlierHidden}
              dressing={dressing}
              onToggle={() => {
                setEarlierHidden((value) => !value)
              }}
              onReplay={jumpTo}
            />
            <EditorialNowPlaying
              phrase={current}
              track={queueTrack(position + 1)}
              dressing={dressing}
              onPrevious={() => {
                setCursor(Math.max(0, position - 1))
              }}
              onNext={advance}
              onOpen={() => {
                setFocused(true)
              }}
            />
            <UpNext
              upcoming={queue.slice(position + 1, position + 1 + UP_NEXT_ROWS)}
              startIndex={position + 1}
              remaining={Math.max(0, queue.length - position - 1)}
              dressing={dressing}
              onJump={jumpTo}
              onOpenOptions={setOptionsIndex}
              onReorder={reorderUpcoming}
            />
          </View>
        )}
      </ScrollView>
      <TrackOptionsSheet
        visible={optionsIndex !== null}
        phrase={optionsIndex === null ? undefined : queue[optionsIndex]}
        showJump={!focused}
        onDismiss={() => {
          setOptionsIndex(null)
        }}
        onLove={() => {
          const phrase = optionsIndex === null ? undefined : queue[optionsIndex]
          if (phrase === undefined) return
          toggleLoved(phrase.id)
        }}
        onLearned={() => {
          const phrase = optionsIndex === null ? undefined : queue[optionsIndex]
          if (phrase === undefined) return
          const nextLearned = !phrase.learned
          markLearned(phrase.id, nextLearned)
          if (nextLearned) setOptionsIndex(null)
        }}
        onRate={(difficulty) => {
          const phrase = optionsIndex === null ? undefined : queue[optionsIndex]
          if (phrase === undefined) return
          setDifficulty(phrase.id, difficulty)
        }}
        onJump={() => {
          if (optionsIndex !== null) jumpTo(optionsIndex)
          setOptionsIndex(null)
        }}
      />
      {!focused && dressing === 'simple' ? (
        <View
          testID="stream-queue-footer"
          style={[
            s.footer,
            parchmentGlassStyle(),
            stationeryElevation('playRaised'),
            { paddingBottom: insets.bottom },
          ]}
        >
          <SimpleQueueFooter phrase={current} />
        </View>
      ) : null}
    </Screen>
  )
}

const s = StyleSheet.create({
  content: { paddingHorizontal: space['4'] },
  focusedReset: { paddingHorizontal: 0 },
  focused: { paddingHorizontal: FOCUSED_GUTTER, gap: FOCUSED_GAP },
  landing: { gap: LANDING_GAP },
  focusedHeader: { paddingTop: HEADER_PAD_TOP, paddingBottom: HEADER_PAD_BOTTOM },
  dismiss: {
    width: DISMISS,
    height: DISMISS,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissNudge: { marginLeft: HEADER_HIT_NUDGE },
  optionsNudge: { marginRight: HEADER_HIT_NUDGE },
  dismissMark: { fontSize: DISMISS_FACE, lineHeight: DISMISS_FACE },
  playlistKicker: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: KICKER_PAD_X,
  },
  playlistKickerFace: {
    textTransform: 'uppercase',
    letterSpacing: PLAYLIST_TRACK,
    fontWeight: '700',
    fontSize: SECTION_KICKER,
  },
  footer: {
    paddingHorizontal: SIMPLE_FOOTER_PAD_X,
    paddingTop: SIMPLE_FOOTER_PAD_TOP,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: line.default,
  },
  done: {
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  doneLabel: { fontSize: DONE_FACE },
})

function StreamDoneChip({
  dressing,
  onPress,
}: {
  dressing: QueueDressing
  onPress: () => void
}) {
  useLocale()
  const { accent } = useTheme()
  return (
    <View testID="stream-done" style={stationeryElevation('queueSoft')}>
      <Pressable
        feedback="smallButton"
        pressMotion="deboss"
        accessibilityLabel={copy.a11y.stream.doneQueue}
        onPress={onPress}
        style={[
          s.done,
          {
            backgroundColor: surface.sunken,
            borderColor: line.default,
            paddingHorizontal: donePadX(dressing),
            paddingVertical: donePadY(dressing),
          },
        ]}
      >
        <Text color={accent.accent} style={[s.doneLabel, { fontWeight: doneWeight(dressing) }]}>
          {copy.stream.queue.done}
        </Text>
      </Pressable>
    </View>
  )
}
