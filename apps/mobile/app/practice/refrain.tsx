import { useLocale } from '../../src/lib/i18n'
/**
 * The Refrain — THE v1 hero. Loro.dc.html:1405–1532, logic 3343–3424.
 *
 * One phrase, six reps, a different MANNER each rep:
 *   Echo → Chorus → Speed → Cloze → Call → Cold
 *
 * The card shows completed practice, not a measured speech score. It visibly warms
 * cold-blue → hot-coral as automaticity climbs, then locks in.
 *
 * Manual confirmation counts practice only. Speech latency stays null until onset is measured.
 *
 * ── How the file is laid out ──
 * `useRefrainSession()` owns the plan, the cursor and the two transitions, and returns the
 * view model. Everything under it renders
 * one band of the screen and nothing else, so a change to the warming card cannot reach the
 * progress counters. Every learner-facing string comes from `src/lib/copy.ts`; every number is a
 * token or lives in this file's `StyleSheet`.
 */

import { useEffect, useState } from 'react'
import { Platform, ScrollView, StyleSheet, View } from 'react-native'
import { router, useNavigation } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useBottomBar } from '../../src/ui/BottomBarContext'
import {
  DEFAULT_REP_TARGET,
  REFRAIN_MODES,
  repsToday as repsTodayOf,
  type RefrainMode,
} from '@loro/core'
import {
  Arrival,
  BeatBars,
  Button,
  Card,
  Dots,
  Pressable,
  ProgressBar,
  Row,
  Screen,
  Sheet,
  Text,
  WarmingSurface,
} from '../../src/ui/primitives'
import { BEAT_TEMPO_MS } from '../../src/ui/motion'
import { ActionBar, EmptyState } from '../../src/ui/components'
import {
  accent,
  actionBar,
  ink,
  MIN_TAP,
  onDark,
  radius,
  semantic,
  space,
  surface,
} from '../../src/ui/theme'
import {
  PRODUCTION_WAVES,
  PRODUCTION_WAVE_TIMES,
  useApp,
  type PhraseView,
  type ProductionWave,
} from '../../src/store'
import { useRefrainSession, type WarmingStyle } from './_useRefrainSession'
import { copy } from '../../src/lib/copy'
import { audioPlaybackNote, audioSpeech, useAudioSpeech } from '../../src/lib/audioSpeech'
import { deviceClock } from '../../src/lib/clock'
import { waveEntryWithResume, waveSchedule } from '../../src/lib/waves'
import { useLocalMinute } from '../../src/lib/useLocalMinute'
type WaveKey = ProductionWave
export default function Refrain() {
  useLocale()
  const localMinute = useLocalMinute()
  const now = localMinute.slice(11)
  const insets = useSafeAreaInsets()
  const { height: bottomBarHeight } = useBottomBar()
  const scheduledWave = waveSchedule(PRODUCTION_WAVES, PRODUCTION_WAVE_TIMES, now).find(
    (item) => item.position === 'next',
  )?.key
  const completedWaves = useApp((state) => state.refrainWaves)
  const refrainResume = useApp((state) => state.refrainResume)
  const endRefrainSession = useApp((state) => state.endRefrainSession)
  const showToast = useApp((state) => state.showToast)
  const entry = waveEntryWithResume(
    PRODUCTION_WAVES,
    PRODUCTION_WAVE_TIMES,
    now,
    completedWaves.filter((wave): wave is WaveKey => PRODUCTION_WAVES.includes(wave as WaveKey)),
    refrainResume,
  )
  // A route parameter is never authority. The persisted checkpoint is shared with Today and the
  // spine, and therefore wins while it remains valid for this local day.
  const selectedWave =
    entry.kind === 'resume'
      ? entry.wave
      : entry.kind === 'ready'
        ? entry.wave.key
        : (scheduledWave ?? PRODUCTION_WAVES[0])
  const session = useRefrainSession(selectedWave, entry.kind === 'ready' || entry.kind === 'resume')
  const { set, phrase, mode, auto, dayReps, locked, phraseNumber, wave } = session
  const targetLocale = useApp((state) => state.targetLocale)
  const audio = useAudioSpeech(targetLocale, phrase?.catalog?.audio)
  const [exitVisible, setExitVisible] = useState(false)
  const navigation = useNavigation()
  const leaveLabel = copy.nav.exit.leave
  const hasActiveSession =
    set.length > 0 &&
    (entry.kind === 'ready' || entry.kind === 'resume') &&
    !session.finished &&
    phrase !== undefined
  useEffect(() => {
    // The session-only exit is present only while the sheet it opens is mounted. Cold, locked
    // and terminal Refrain entries retain the shared Today/Back stack exit.
    navigation.setOptions({
      headerLeft: () =>
        hasActiveSession ? (
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
  }, [hasActiveSession, leaveLabel, navigation])
  if (set.length === 0) {
    return (
      <Screen>
        <EmptyState
          title={copy.refrain.empty.title}
          body={copy.refrain.empty.body}
          action={{
            label: copy.common.addPhrases,
            onPress: () => {
              router.replace('/add')
            },
          }}
        />
      </Screen>
    )
  }
  // A finished session owns the immediate post-practice screen even when the next scheduled
  // wave is still locked. The completion checkpoint is the learner's current result; replacing
  // it with the next-wave gate would hide the reward and make a successful session look blocked.
  if (session.finished) {
    const day = deviceClock.localDay()
    return (
      <Screen>
        <DoneState
          worked={set.length}
          totalReps={set.reduce((n, p) => n + repsTodayOf(p, day), 0)}
        />
      </Screen>
    )
  }
  if (entry.kind === 'locked') {
    return (
      <Screen>
        <EmptyState
          title={copy.refrain.unavailable.title(entry.next.time)}
          body={copy.refrain.unavailable.body}
          action={{
            label: copy.refrain.done.cta,
            onPress: () => {
              router.replace('/')
            },
          }}
        />
      </Screen>
    )
  }
  if (entry.kind === 'complete') {
    return (
      <Screen>
        <EmptyState
          title={copy.refrain.unavailable.complete}
          body={copy.refrain.unavailable.body}
          action={{
            label: copy.refrain.done.cta,
            onPress: () => {
              router.replace('/')
            },
          }}
        />
      </Screen>
    )
  }
  if (phrase === undefined) return null
  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{
          padding: space['4'],
          gap: space['3.5'],
          // The action bar is absolutely positioned and reserves nothing, so the scroll view
          // clears its measured height, retaining the authored minimum before layout.
          paddingBottom: Math.max(
            insets.bottom + actionBar.clearance.refrain,
            bottomBarHeight + space['4'],
          ),
        }}
      >
        <Row justify="space-between">
          <View>
            <Text variant="captionSm" color={ink.muted}>
              {copy.today.waves[wave].title}
            </Text>
            <Text variant="caption" color={ink.ink}>
              {copy.refrain.phraseCounter(phraseNumber, set.length)}
            </Text>
          </View>
          <Dots count={set.length} filled={phraseNumber - 1} />
        </Row>

        <ModeStrip mode={mode} />
        <BeatBars tempoMs={mode === 'speed' ? BEAT_TEMPO_MS.speed : BEAT_TEMPO_MS.default} />

        <WarmingCard
          mode={mode}
          phrase={phrase}
          auto={auto}
          bandStyle={session.bandStyle}
          clozeMask={session.clozeMask}
        />

        <Card>
          <AutomaticityMeter auto={auto} />
        </Card>

        <RepCounter reps={dayReps} />

        <Text variant="captionSm" color={ink.muted} align="center">
          {!audio.canPlay
            ? copy.refrain.audioNote
            : audioPlaybackNote(audio.source, audio.playback, audio.playbackError)}
        </Text>
        {audio.canPlay ? (
          <Pressable
            feedback="button"
            accessibilityLabel={
              audio.phraseId === phrase.id &&
              (audio.playback === 'playing' || audio.playback === 'loading')
                ? copy.audioSpeech.stop
                : copy.audioSpeech.play
            }
            onPress={() => {
              if (
                audio.phraseId === phrase.id &&
                (audio.playback === 'playing' || audio.playback === 'loading')
              ) {
                void audioSpeech.stopPlayback()
                return
              }
              void audioSpeech.play(
                phrase.id,
                phrase.targetText,
                targetLocale,
                0.92,
                undefined,
                phrase.catalog?.audio,
              )
            }}
          >
            <Text variant="body" color={accent.accentInk} align="center">
              {audio.phraseId === phrase.id &&
              (audio.playback === 'playing' || audio.playback === 'loading')
                ? copy.audioSpeech.stop
                : copy.audioSpeech.play}
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <ActionBar gap={space['2.5']}>
        {locked ? (
          <>
            <LockedInBanner />
            <Button
              label={
                phraseNumber >= set.length ? copy.refrain.locked.finish : copy.refrain.locked.next
              }
              onPress={session.nextPhrase}
            />
          </>
        ) : (
          <MicButton mode={mode} onPress={session.doRep} />
        )}
      </ActionBar>
      <ExitSheet
        visible={exitVisible}
        onKeepGoing={() => {
          setExitVisible(false)
        }}
        onPause={() => {
          // The checkpoint was committed when its plan/last rep was committed. Only leave after
          // that transaction has acknowledged; this handler never publishes a speculative pause.
          setExitVisible(false)
          router.replace('/')
        }}
        onEnd={() => {
          try {
            endRefrainSession()
            setExitVisible(false)
            router.replace('/')
          } catch {
            showToast(`${copy.persistence.error} ${copy.persistence.retry}`)
          }
        }}
      />
    </Screen>
  )
}

function ExitSheet({
  visible,
  onPause,
  onEnd,
  onKeepGoing,
}: {
  visible: boolean
  onPause: () => void
  onEnd: () => void
  onKeepGoing: () => void
}) {
  useLocale()
  return (
    <Sheet visible={visible} onDismiss={onKeepGoing} dismissLabel={copy.a11y.common.dismiss}>
      <Text variant="title3" color={ink.ink}>
        {copy.nav.exit.title}
      </Text>
      <Button label={copy.nav.exit.pause} onPress={onPause} />
      <Button label={copy.nav.exit.end} variant="secondary" onPress={onEnd} />
      <Button label={copy.nav.exit.keepGoing} variant="secondary" onPress={onKeepGoing} />
      <Text variant="captionSm" color={ink.muted}>
        {copy.nav.exit.note}
      </Text>
    </Sheet>
  )
}
function ModeStrip({ mode }: { mode: RefrainMode }) {
  useLocale()
  const currentIndex = REFRAIN_MODES.indexOf(mode)
  return (
    <Row gap={space['1']} wrap align="stretch">
      {REFRAIN_MODES.map((m, i) => {
        const isCurrent = m === mode
        const isDone = i < currentIndex
        return (
          <View
            key={m}
            style={[
              s.modeCell,
              Platform.OS === 'web' && { minWidth: 'auto' },
              {
                backgroundColor: isCurrent ? accent.accent : isDone ? accent.wash : surface.sunken,
              },
            ]}
          >
            <Text
              variant="labelSm"
              color={isCurrent ? onDark.primary : isDone ? accent.accentInk : ink.ink3}
            >
              {copy.refrain.modes[m].label}
            </Text>
          </View>
        )
      })}
    </Row>
  )
}
/** THE WARMING CARD — the product's core feedback signal. */
function WarmingCard({
  mode,
  phrase,
  auto,
  bandStyle,
  clozeMask,
}: {
  mode: RefrainMode
  phrase: PhraseView
  auto: number
  bandStyle: WarmingStyle
  clozeMask: readonly number[]
}) {
  useLocale()
  return (
    <WarmingSurface
      automaticity={auto}
      accessibilityLabel={copy.a11y.refrain.card(
        copy.refrain.modes[mode].cue,
        phrase.targetText,
        auto,
      )}
      style={s.warmingCard}
    >
      <Row gap={space['1.5']}>
        <Text variant="caption">{copy.refrain.modes[mode].icon}</Text>
        <Text variant="labelSm" color={bandStyle.text}>
          {copy.refrain.modes[mode].cue}
        </Text>
      </Row>

      <WarmingPrompt mode={mode} phrase={phrase} color={bandStyle.text} clozeMask={clozeMask} />
    </WarmingSurface>
  )
}
/** Prompt content is mode-dependent: full → cloze → meaning → nothing. */
function WarmingPrompt({
  mode,
  phrase,
  color,
  clozeMask,
}: {
  mode: RefrainMode
  phrase: PhraseView
  color: string
  clozeMask: readonly number[]
}) {
  useLocale()
  switch (mode) {
    case 'echo':
    case 'chorus':
    case 'speed':
      return (
        <>
          <Text variant="title1" color={color} align="center" lang="target">
            {phrase.targetText}
          </Text>
          <Text variant="caption" color={color} align="center">
            {phrase.translation}
          </Text>
        </>
      )
    case 'cloze':
      return (
        <>
          <Text variant="title1" color={color} align="center" lang="target">
            {phrase.targetText
              .split(/\s+/)
              .map((word, index) =>
                clozeMask.includes(index) ? copy.refrain.prompt.clozeBlank : word,
              )
              .join(' ')}
          </Text>
          <Text variant="caption" color={color} align="center">
            {phrase.translation}
          </Text>
        </>
      )
    case 'call':
      return (
        <>
          <Text variant="labelSm" color={color}>
            {copy.refrain.prompt.callLabel}
          </Text>
          <Text variant="title2" color={color} align="center">
            {phrase.translation}
          </Text>
        </>
      )
    case 'cold':
      return (
        <>
          <Text style={s.coldGlyph}>{copy.refrain.modes.cold.icon}</Text>
          <Text variant="caption" color={color} align="center">
            {copy.refrain.prompt.coldLabel}
          </Text>
        </>
      )
  }
}
/** Automaticity, as a percentage and as a bar. */
function AutomaticityMeter({ auto }: { auto: number }) {
  useLocale()
  return (
    <>
      <Row justify="space-between" wrap style={s.meterHeader}>
        <Text variant="labelSm" color={ink.ink}>
          {copy.refrain.automaticity.label}
        </Text>
        <Text variant="labelSm" color={accent.accentInk}>
          {copy.refrain.automaticity.percent(auto)}
        </Text>
      </Row>
      {/* Named: this bar IS the product's core feedback signal, and accessibility.md
            requires the Refrain expose automaticity "as a progress bar with a
            percentage". Unnamed it announced as an anonymous progressbar. */}
      <ProgressBar
        value={auto / 100}
        height={9}
        track={surface.sunken}
        label={copy.refrain.automaticity.label}
      />
    </>
  )
}

/** Reps done today, against the target. Capped for display; the store keeps the real count. */
function RepCounter({ reps }: { reps: number }) {
  useLocale()
  return (
    <Row justify="space-between">
      <Text variant="labelSm" color={ink.muted}>
        {copy.refrain.repCounter(Math.min(reps, DEFAULT_REP_TARGET), DEFAULT_REP_TARGET)}
      </Text>
      <Dots count={DEFAULT_REP_TARGET} filled={reps} size={7} />
    </Row>
  )
}
/** The one tap of the whole screen: a rep is done. Its mode is core-owned; its label is copy. */
function MicButton({ mode, onPress }: { mode: RefrainMode; onPress: () => void }) {
  useLocale()
  const label = copy.refrain.mic[mode]
  return (
    <Pressable
      feedback="button"
      onPress={onPress}
      accessibilityLabel={label}
      accessibilityHint={copy.refrain.modes[mode].cue}
      style={s.mic}
    >
      <Text variant="title3" color={onDark.primary}>
        {label}
      </Text>
    </Pressable>
  )
}
/** The reward moment: this phrase is automatic today. */
function LockedInBanner() {
  useLocale()
  return (
    <Arrival kind="popIn">
      <Row gap={space['2.5']} style={s.lockedBanner}>
        <Text style={s.lockedGem}>{copy.refrain.locked.gem}</Text>
        <View style={s.lockedBody}>
          <Text variant="caption" color={semantic.success.text}>
            {copy.refrain.locked.title}
          </Text>
          <Text variant="captionSm" color={semantic.successMeta.text}>
            {copy.refrain.locked.body}
          </Text>
        </View>
      </Row>
    </Arrival>
  )
}
/**
 * The finish.
 *
 * NOT an `EmptyState`, though it is the same centred box: it carries two `title2` lines (one
 * Spanish), an 88-px tile whose 42-px emoji is off `EmojiTile`'s 0.48 ratio, two counters, and
 * a full-width button. Routing it through `EmptyState` would silently restyle all four.
 */
function DoneState({ worked, totalReps }: { worked: number; totalReps: number }) {
  useLocale()
  return (
    <ScrollView contentContainerStyle={s.centred}>
      <Arrival kind="popIn">
        <View style={s.doneTile}>
          <Text style={s.doneEmoji}>{copy.common.flame}</Text>
        </View>
      </Arrival>
      <Text variant="title2" color={accent.accentInk} lang="target">
        {copy.refrain.done.headline}
      </Text>
      <Text variant="title2" color={ink.ink} align="center">
        {copy.refrain.done.title}
      </Text>
      <Row gap={space['2.5']} wrap align="stretch" style={s.doneStats}>
        <DoneStat value={worked} label={copy.refrain.done.workedLabel} />
        <DoneStat value={totalReps} label={copy.common.repsToday} />
      </Row>
      <View style={s.doneCta}>
        <Button
          label={copy.refrain.done.cta}
          onPress={() => {
            router.replace('/')
          }}
        />
      </View>
    </ScrollView>
  )
}
/**
 * One of the finish screen's two counters. Deliberately NOT `StatTile`.
 *
 * `StatTile` renders its number at `title2` where these are `title3`, and it groups the pair
 * into one accessible node named `"<label>: <value>"`, which these do not have. Both are
 * arguably improvements, and both change what a learner sees and hears — so they stay as they
 * are. Unifying them is a design decision, not a refactor (plans/34).
 */
function DoneStat({ value, label }: { value: number; label: string }) {
  useLocale()
  return (
    <Card style={s.doneStat}>
      <Text variant="title3" color={ink.ink}>
        {value}
      </Text>
      <Text variant="labelSm" color={ink.muted}>
        {label}
      </Text>
    </Card>
  )
}

const s = StyleSheet.create({
  centred: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space['5'],
    gap: space['3'],
  },
  modeCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: space['2'],
    borderRadius: radius.md,
  },
  warmingCard: {
    borderRadius: radius['2xl'],
    padding: 26,
    minHeight: 200,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space['2'],
  },
  coldGlyph: { fontSize: 32 },
  meterHeader: { marginBottom: space['2'] },
  mic: {
    minHeight: 56,
    borderRadius: radius.lg,
    backgroundColor: accent.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedBanner: {
    backgroundColor: semantic.success.bg,
    borderRadius: radius.xl,
    padding: space['3'],
  },
  lockedGem: { fontSize: 20 },
  lockedBody: { flex: 1 },
  doneTile: {
    width: 88,
    height: 88,
    borderRadius: radius['3xl'],
    backgroundColor: accent.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneEmoji: { fontSize: 42 },
  doneStats: { width: '100%', marginTop: space['3'] },
  doneStat: {
    flex: 1,
    alignItems: 'center',
    ...(Platform.OS === 'web' ? { minWidth: 'auto' as const } : {}),
  },
  doneCta: { width: '100%', marginTop: space['3'] },
})
