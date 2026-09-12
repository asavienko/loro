import { useLocale } from '../../src/lib/i18n'
/**
 * Adaptive stream — Loro.dc.html:600–677, logic 2516–2632.
 *
 * The one screen every persona uses. Live re-rating re-ranks the queue immediately,
 * and the toast explains the consequence — that's what teaches the model.
 *
 * The phrase card exposes manual navigation until native audio playback is available.
 */
import { useEffect, useMemo, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { router, useNavigation } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { streamStats, type Difficulty } from '@loro/core'
import { copy, themeLabel } from '../../src/lib/copy'
import { PracticeEmptyState } from './_emptyPractice'
import { SessionExitSheet } from './_SessionExitSheet'
import { useSessionExitGuard } from './_useSessionExit'
import { DifficultySelector, PhraseRow } from '../../src/ui/components'
import {
  Button,
  Chip,
  DarkCard,
  Equalizer,
  IconButton,
  Pill,
  Pressable,
  Row,
  Screen,
  Stack,
  Text,
} from '../../src/ui/primitives'
import {
  accent,
  border,
  chip,
  difficultyMeta,
  ink,
  line,
  MIN_TAP,
  onDark,
  radius,
  semantic,
  space,
  surface,
} from '../../src/ui/theme'
import { toView, useApp, type PhraseView } from '../../src/store'
import { audioPlaybackNote, audioSpeech, useAudioSpeech } from '../../src/lib/audioSpeech'
import { rustCoreFacade } from '../../src/store/coreFacade'
import { deviceClock } from '../../src/lib/clock'
import { streamWaveMembers, streamWaveQueue } from '../../src/lib/practiceFocus'
/** The two gaps in this screen that no `space` step names. */
const RERATE_GAP = 7
const PILL_GAP = 5
export default function Stream() {
  useLocale()
  const insets = useSafeAreaInsets()
  const nativeLanguage = useApp((s) => s.nativeLanguage)
  const phrases = useApp((s) => s.phrases)
  const refrainSet = useApp((s) => s.refrainSet)
  const ensureRefrainSet = useApp((s) => s.ensureRefrainSet)
  const setDifficulty = useApp((s) => s.setDifficulty)
  const toggleLoved = useApp((s) => s.toggleLoved)
  const markLearned = useApp((s) => s.markLearned)
  const cursor = useApp((state) => state.streamCursor)
  const setCursor = useApp((state) => state.setStreamCursor)
  const [exitVisible, setExitVisible] = useState(false)
  const navigation = useNavigation()
  const leaveLabel = copy.nav.exit.leave
  useEffect(() => {
    ensureRefrainSet()
  }, [ensureRefrainSet, phrases.length])
  const queue = useMemo(() => {
    const now = deviceClock.now()
    return streamWaveQueue(phrases, refrainSet, (phrase) =>
      rustCoreFacade.streamRank(phrase, now),
    ).map(toView)
  }, [phrases, refrainSet, nativeLanguage])
  const stats = useMemo(
    () => streamStats(streamWaveMembers(phrases, refrainSet)),
    [phrases, refrainSet],
  )
  const position = cursor % Math.max(1, queue.length)
  const current = queue[position]
  const hasWave = queue.length > 0 && current !== undefined
  const { allowLeave } = useSessionExitGuard({
    enabled: hasWave,
    exitVisible,
    onBlockedLeave: () => {
      setExitVisible(true)
    },
  })
  useEffect(() => {
    navigation.setOptions({
      headerLeft: () =>
        hasWave ? (
          <Pressable
            feedback="smallButton"
            accessibilityLabel={leaveLabel}
            onPress={() => {
              setExitVisible(true)
            }}
            style={{ minHeight: MIN_TAP, justifyContent: 'center', paddingHorizontal: space['3'] }}
          >
            <Text variant="bodySm" color={accent.accentInk}>
              {copy.common.chevron.left}
            </Text>
          </Pressable>
        ) : navigation.canGoBack() ? (
          <Pressable
            feedback="icon"
            accessibilityRole="link"
            accessibilityLabel={copy.a11y.common.back}
            onPress={() => {
              router.back()
            }}
          >
            <Text variant="title2" color={ink.ink}>
              {copy.common.chevron.left}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            feedback="smallButton"
            style={{ minHeight: MIN_TAP, justifyContent: 'center', paddingHorizontal: space['3'] }}
            accessibilityLabel={copy.nav.home}
            onPress={() => {
              router.replace('/')
            }}
          >
            <Text variant="bodySm" color={accent.accentInk}>
              {copy.nav.home}
            </Text>
          </Pressable>
        ),
    })
  }, [hasWave, leaveLabel, navigation])
  const leaveWave = (): void => {
    allowLeave()
    setExitVisible(false)
    router.replace('/')
  }
  if (!hasWave) {
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
  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + space['5'] }]}
      >
        <NowPlayingCard
          phrase={current}
          position={copy.stream.counter(position + 1, queue.length)}
          onPrevious={() => {
            setCursor(Math.max(0, position - 1))
          }}
          onNext={advance}
        />

        <RerateRow
          phrase={current}
          onRate={(d) => {
            setDifficulty(current.id, d)
          }}
          onToggleLoved={() => {
            toggleLoved(current.id)
          }}
          onMarkLearned={() => {
            markLearned(current.id, true)
          }}
        />

        <Button
          label={copy.stream.practiceRefrain}
          accessibilityHint={copy.a11y.stream.practiceThis}
          onPress={() => {
            router.push({ pathname: '/practice/refrain', params: { phrase: current.id } })
          }}
        />

        <UpNextList upcoming={queue.slice(position + 1)} stats={stats} />
      </ScrollView>
      <SessionExitSheet
        visible={exitVisible}
        title={copy.nav.exit.title}
        pauseLabel={copy.nav.exit.pause}
        endLabel={copy.nav.exit.end}
        keepGoingLabel={copy.nav.exit.keepGoing}
        note={copy.nav.exit.noteStream}
        dismissLabel={copy.a11y.common.dismiss}
        onKeepGoing={() => {
          setExitVisible(false)
        }}
        onPause={leaveWave}
        onEnd={leaveWave}
      />
    </Screen>
  )
}
/**
 * The dark hero: the current phrase, audio availability, and manual phrase navigation.
 */
function NowPlayingCard({
  phrase,
  position,
  onPrevious,
  onNext,
}: {
  phrase: PhraseView
  /** `1 / 10` — formatted by the caller, because it counts the QUEUE, not this card. */
  position: string
  onPrevious: () => void
  onNext: () => void
}) {
  useLocale()
  const locale = useApp((state) => state.targetLocale)
  const recordPlay = useApp((state) => state.recordPlay)
  const audio = useAudioSpeech(locale, phrase.catalog?.audio)
  const playing =
    audio.phraseId === phrase.id && (audio.playback === 'playing' || audio.playback === 'loading')
  return (
    <DarkCard>
      <Row justify="space-between">
        <Pill
          size="capsuleSm"
          tone="onDark"
          emoji={phrase.emoji}
          label={themeLabel(phrase.theme)}
        />
        <Text variant="labelSm" color={onDark.muted}>
          {position}
        </Text>
      </Row>

      <Stack gap={space['2']} style={s.phraseBlock}>
        <Text variant="title2" color={onDark.primary} align="center" lang="target">
          {phrase.targetText}
        </Text>
        <Text variant="caption" color={onDark.tertiary} align="center">
          {phrase.translation}
        </Text>
      </Stack>

      <Text variant="captionSm" color={onDark.tertiary} align="center" style={s.repeatRow}>
        {!audio.canPlay
          ? copy.stream.audioNote
          : audioPlaybackNote(audio.source, audio.playback, audio.playbackError)}
      </Text>
      {audio.canPlay && <Equalizer active={playing} color={onDark.primary} />}
      {audio.canPlay && (
        <Pressable
          feedback="button"
          accessibilityLabel={playing ? copy.audioSpeech.stop : copy.audioSpeech.play}
          onPress={() => {
            if (playing) void audioSpeech.stopPlayback()
            else
              void audioSpeech.play(
                phrase.id,
                phrase.targetText,
                locale,
                0.92,
                () => {
                  recordPlay(phrase.id)
                },
                phrase.catalog?.audio,
              )
          }}
        >
          <Text variant="body" color={onDark.primary} align="center">
            {playing ? copy.audioSpeech.stop : copy.audioSpeech.play}
          </Text>
        </Pressable>
      )}
      <TransportBar onPrevious={onPrevious} onNext={onNext} />
    </DarkCard>
  )
}
/**
 * Previous and Next phrase browse the queue without claiming or recording audio playback.
 */
function TransportBar({ onPrevious, onNext }: { onPrevious: () => void; onNext: () => void }) {
  useLocale()
  return (
    <Row wrap justify="center" gap={space['5']} style={s.transport}>
      <IconButton
        glyph={copy.stream.controls.prev}
        label={copy.a11y.stream.previous}
        color={onDark.muted}
        onPress={onPrevious}
      />
      <Pressable
        feedback="button"
        accessibilityLabel={copy.a11y.stream.next}
        onPress={onNext}
        style={s.playButton}
      >
        <Text variant="caption" color={onDark.primary}>
          {copy.stream.controls.next}
        </Text>
      </Pressable>
    </Row>
  )
}
/**
 * Live re-rating: love it, retire it, or move it between the three difficulties. Every one of
 * these re-ranks the queue on the next render, which is the screen's whole point.
 */
function RerateRow({
  phrase,
  onRate,
  onToggleLoved,
  onMarkLearned,
}: {
  phrase: PhraseView
  onRate: (difficulty: Difficulty) => void
  onToggleLoved: () => void
  onMarkLearned: () => void
}) {
  useLocale()
  return (
    <Stack gap={space['2']}>
      {/* `wrap` is load-bearing, not cosmetic: the row grows DOWNWARD at large text sizes
            rather than pushing "✓ Learned" off the right edge, where it is neither readable nor
            tappable. accessibility.md#text-and-layout: rows grow vertically. */}
      <Row gap={RERATE_GAP} wrap>
        <Text variant="labelSm" color={ink.muted}>
          {copy.stream.rateQuestion}
        </Text>
        <View style={s.spacer} />
        <Chip
          variant="toggle"
          label={phrase.loved ? copy.stream.lovedBadge : copy.stream.loveLabel}
          accessibilityLabel={
            phrase.loved ? copy.a11y.common.removeFromLoved : copy.a11y.stream.loveThisPhrase
          }
          selected={phrase.loved}
          onPress={onToggleLoved}
        />
        {/* NOT a `Chip`, on purpose. Its ink is `semantic.success` and its border a hairline,
            while `Chip`'s `toggle` variant is accent-toned and carries the 1.5-px border in
            both states — forcing it through would change two rendered values. `ui-api.md` §4
            reaches the same conclusion; the shape is shared, the tone is not. */}
        <Pressable
          feedback="smallButton"
          accessibilityLabel={copy.common.markLearned}
          onPress={onMarkLearned}
          style={s.learnedButton}
        >
          <Text variant="labelSm" color={semantic.success.text}>
            {copy.common.learnedBadge}
          </Text>
        </Pressable>
      </Row>

      {/* `segmented` is the stream's inset track. Its inactive label is `ink.ink3` rather than
            `ink.muted` — on `surface.sunken2` muted is 4.41:1, under AA for 12 px text — and that
            decision now lives in `primitives/controlStyle.ts` beside the reasoning. */}
      <DifficultySelector
        layout="segmented"
        value={phrase.difficulty}
        labels={copy.difficulty}
        onChange={onRate}
      />
    </Stack>
  )
}
/**
 * What is coming, with the roll-up counts beside the heading.
 *
 * A fragment, not a wrapper: the heading and the list are two children of the screen's scroll
 * container, and that container's `gap` is what sets the space between them.
 */
function UpNextList({
  upcoming,
  stats,
}: {
  upcoming: readonly PhraseView[]
  stats: ReturnType<typeof streamStats>
}) {
  useLocale()
  return (
    <>
      <Row justify="space-between">
        <Text variant="caption" color={ink.ink}>
          {copy.stream.thisWave}
        </Text>
        <Row gap={PILL_GAP}>
          <Pill size="sm" tone="accent" label={copy.stream.pills.loved(stats.loved)} />
          <Pill
            size="sm"
            label={copy.stream.pills.hard(stats.hard)}
            color={semantic.danger.text}
            background={semantic.danger.bg}
          />
          <Pill
            size="sm"
            label={copy.stream.pills.learned(stats.learned)}
            color={semantic.success.text}
            background={semantic.success.bg}
          />
        </Row>
      </Row>

      <Stack gap={space['2']}>
        {upcoming.map((p) => (
          <PhraseRow
            key={p.id}
            targetText={p.targetText}
            translation={p.translation}
            emoji={p.emoji}
            accessibilityLabel={copy.a11y.stream.queueRow(
              p.targetText,
              p.translation,
              copy.difficulty[p.difficulty],
            )}
            accessibilityHint={copy.a11y.common.opensPhraseDetails}
            onPress={() => {
              router.push(`/phrase/${p.id}`)
            }}
            trailing={
              <Pill
                size="sm"
                label={copy.difficulty[p.difficulty]}
                color={difficultyMeta[p.difficulty].color}
                background={difficultyMeta[p.difficulty].bg}
              />
            }
          />
        ))}
      </Stack>
    </>
  )
}
const s = StyleSheet.create({
  content: { padding: space['4'], gap: space['3.5'] },
  // NowPlayingCard
  phraseBlock: { marginTop: space['4'], alignItems: 'center' },
  repeatRow: { marginTop: space['3.5'] },
  transport: { marginTop: space['4'] },
  playButton: {
    maxWidth: '100%',
    minHeight: 48,
    paddingHorizontal: space['5'],
    paddingVertical: space['3'],
    borderRadius: radius.xl,
    backgroundColor: accent.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // RerateRow
  spacer: { flex: 1 },
  /** The `Chip` metrics, because it is the same shape beside it — only the tone differs. */
  learnedButton: {
    paddingHorizontal: chip.toggle.paddingHorizontal,
    paddingVertical: chip.toggle.paddingVertical,
    borderRadius: radius.lg,
    borderWidth: border.hairline,
    borderColor: line.strong,
    backgroundColor: surface.card,
  },
})
