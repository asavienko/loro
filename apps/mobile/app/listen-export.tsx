import { useLocalSearchParams } from 'expo-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import {
  LISTENING_INTER_GAP_MS,
  LISTENING_INTRA_GAP_MS,
  LISTENING_REPEATS_DEFAULT,
  LISTENING_REPEATS_MAX,
  LISTENING_REPEATS_MIN,
  activeListeningPhrases,
  listeningRepeatChoices,
  listeningShareFilename,
  type ListeningRepeats,
} from '@loro/core'
import { audioCache } from '../src/lib/audioCache'
import { audioSpeech, useAudioSpeech } from '../src/lib/audioSpeech'
import { apiUrl } from '../src/lib/backend'
import { isNetworkAvailable, onNetworkAvailable } from '../src/lib/connectivity'
import { copy } from '../src/lib/copy'
import { deviceClock } from '../src/lib/clock'
import { useLocale } from '../src/lib/i18n'
import {
  isListenPlaybackId,
  listenViewModel,
  playListeningSequence,
  prepareListeningBatch,
  shareListeningBatch,
  type ListenPhase,
  type ListenProgress,
  type ListenViewModel,
} from '../src/lib/listenCompanion'
import { fixtureListenView, listenScenarioFromSearch, type ListenScenario } from '../src/lib/listenFixtures'
import { AudioCacheError, type AudioCacheObject } from '../src/lib/audioCacheController'
import { useApp } from '../src/store'
import { toView } from '../src/store/view'
import { Pressable, Screen, SectionLabel, Stack, Text, Button } from '../src/ui/primitives'
import { MIN_TAP, border, ink, line, space } from '../src/ui/theme'

const emptyProgress: ListenProgress = { done: 0, total: 0, failed: 0 }

/** AS-07. Utility composer; not learner screen 24. Fixtures are development/E2E only. */
export default function ListenExport() {
  useLocale()
  const { listen } = useLocalSearchParams<{ listen?: string | string[] }>()
  const scenario = listenScenarioFromSearch(listen)
  const phrases = useApp((state) => state.phrases)
  const locale = useApp((state) => state.targetLocale)
  const audio = useAudioSpeech(locale)
  const [repeats, setRepeats] = useState<ListeningRepeats>(LISTENING_REPEATS_DEFAULT)
  const [consent, setConsent] = useState(false)
  const [network, setNetwork] = useState(true)
  const [phase, setPhase] = useState<ListenPhase>('idle')
  const [progress, setProgress] = useState<ListenProgress>(emptyProgress)
  const [durationMs, setDurationMs] = useState<number | null>(null)
  const [cacheComplete, setCacheComplete] = useState(false)
  const clips = useRef<readonly AudioCacheObject[]>([])
  const abort = useRef<AbortController | null>(null)

  const lines = useMemo(
    () => activeListeningPhrases(phrases, locale, (phrase) => toView(phrase).targetText),
    [phrases, locale],
  )
  const needsConsent = lines.some((line) => line.learnerAuthored)
  const sessionBusy =
    audio.speech !== null ||
    ((audio.playback === 'playing' || audio.playback === 'loading') &&
      !isListenPlaybackId(audio.phraseId))

  useEffect(() => {
    void isNetworkAvailable().then(setNetwork)
    return onNetworkAvailable(() => {
      void isNetworkAvailable().then(setNetwork)
    })
  }, [])

  useEffect(
    () => () => {
      abort.current?.abort()
      void audioSpeech.stopPlayback()
    },
    [],
  )

  const live = listenViewModel({
    phase,
    locale,
    phrases: lines,
    repeats,
    network,
    configured: apiUrl !== undefined,
    nativeCache: audioCache.available,
    sessionBusy,
    diskFull: false,
    quotaExceeded: false,
    cacheComplete,
    progress,
    durationMs,
  })
  const view = scenario === null ? live : fixtureListenView(scenario)
  const generateEnabled = view.generateEnabled && (!needsConsent || consent)
  const status = statusCopy(scenario, view)

  const generate = (): void => {
    if (!generateEnabled) return
    abort.current?.abort()
    abort.current = new AbortController()
    setPhase('generating')
    void prepareListeningBatch({
      cache: audioCache,
      locale,
      phrases: lines,
      repeats,
      signal: abort.current.signal,
      onProgress: setProgress,
    })
      .then((result) => {
        clips.current = result.clips
        const measured = result.clips.reduce<number | null>((sum, clip) => {
          if (sum === null || clip.ms === null) return null
          return sum + clip.ms
        }, 0)
        setDurationMs(measured)
        setCacheComplete(result.phase === 'ready')
        setPhase(result.phase)
        setProgress(result.progress)
      })
      .catch((error: unknown) => {
        setPhase('error')
        if (error instanceof AudioCacheError && error.code === 'disk-full') setCacheComplete(false)
      })
  }

  const cancel = (): void => {
    abort.current?.abort()
    void audioCache.cancel()
    setPhase('cancelled')
  }

  const listenFromCache = (): void => {
    if (!view.listenEnabled) return
    if (scenario !== null) {
      setPhase('playing')
      return
    }
    abort.current?.abort()
    abort.current = new AbortController()
    setPhase('playing')
    void playListeningSequence({
      clips: clips.current,
      repeats: view.repeats,
      playFile: (phraseId, fileUri, onEnded) => audioSpeech.playFile(phraseId, fileUri, onEnded),
      signal: abort.current.signal,
    })
      .then(() => {
        setPhase('ready')
      })
      .catch(() => {
        setPhase('error')
      })
  }

  const share = (): void => {
    if (!view.shareEnabled) return
    void shareListeningBatch(audioCache, {
      fileUris: clips.current.map((clip) => clip.fileUri),
      intraGapMs: LISTENING_INTRA_GAP_MS,
      interGapMs: LISTENING_INTER_GAP_MS,
      takesPerPhrase: view.repeats,
      outputName: listeningShareFilename(locale, deviceClock.localDay()),
    }).catch(() => undefined)
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Stack gap={space['5']}>
          <Stack gap={space['2']}>
            <Text variant="title2">{copy.listenExport.title}</Text>
            <Text variant="body">{copy.listenExport.intro}</Text>
          </Stack>
          <View accessibilityLiveRegion="polite" accessibilityLabel={copy.a11y.listenExport.status}>
            <Text variant="body">{status}</Text>
            {view.phase === 'generating' ? (
              <Text variant="caption" color={ink.muted}>
                {copy.listenExport.progress(view.progress.done, view.progress.total)}
              </Text>
            ) : null}
            {view.phase === 'partial' ? (
              <Text variant="caption" color={ink.muted}>
                {copy.listenExport.progress(view.progress.done, view.progress.total)}
              </Text>
            ) : null}
            {scenario !== null ? (
              <Text variant="caption" color={ink.muted}>
                {copy.listenExport.fixtureNote}
              </Text>
            ) : null}
          </View>
          <Stack gap={space['1']}>
            <SectionLabel>{copy.listenExport.repeats}</SectionLabel>
            <Text>{copy.listenExport.phraseCount(view.phraseCount)}</Text>
            <RepeatStepper
              value={view.repeats}
              onChange={setRepeats}
              disabled={view.phase === 'generating'}
            />
          </Stack>
          <Stack gap={space['1']}>
            <SectionLabel>{copy.listenExport.voices}</SectionLabel>
            {view.voices.length === 0 ? (
              <Text>{copy.listenExport.voicesEmpty}</Text>
            ) : (
              view.voices.map((voice) => (
                <Text key={voice.id}>
                  {voice.licensed ? voice.name : copy.listenExport.deviceFallback}
                </Text>
              ))
            )}
            {view.sequence.length > 0 ? (
              <Text variant="caption" color={ink.muted}>
                {copy.listenExport.sequence(view.sequence.join(', '))}
              </Text>
            ) : null}
          </Stack>
          <Text variant="caption" color={ink.muted}>
            {view.durationMs === null
              ? copy.listenExport.durationUnknown
              : copy.listenExport.durationMeasured(view.durationMs)}
          </Text>
          {needsConsent && scenario === null ? (
            <Pressable
              feedback="row"
              accessibilityRole="checkbox"
              accessibilityLabel={copy.listenExport.consent}
              selected={consent}
              onPress={() => {
                setConsent((value) => !value)
              }}
              style={styles.row}
            >
              <View style={styles.copy}>
                <Text variant="body">{copy.listenExport.consent}</Text>
                <Text variant="caption" color={ink.muted}>
                  {copy.listenExport.consentDetail}
                </Text>
              </View>
            </Pressable>
          ) : null}
          {view.phase === 'generating' ? (
            <Button label={copy.listenExport.cancel} onPress={cancel} variant="secondary" />
          ) : (
            <Button
              label={copy.listenExport.generate}
              onPress={generate}
              disabled={!generateEnabled}
            />
          )}
          {(view.phase === 'partial' || view.phase === 'cancelled') && (
            <Button
              label={copy.listenExport.resume}
              onPress={generate}
              disabled={!generateEnabled}
              variant="secondary"
            />
          )}
          <Button
            label={view.phase === 'playing' ? copy.listenExport.stop : copy.listenExport.listen}
            onPress={
              view.phase === 'playing'
                ? () => {
                    abort.current?.abort()
                    void audioSpeech.stopPlayback()
                    setPhase('ready')
                  }
                : listenFromCache
            }
            disabled={!view.listenEnabled && view.phase !== 'playing'}
            variant="secondary"
          />
          <Button
            label={copy.listenExport.share}
            onPress={share}
            disabled={!view.shareEnabled}
            variant="secondary"
          />
          {audio.canPlay && !view.listenEnabled ? (
            <Text variant="caption" color={ink.muted}>
              {copy.listenExport.deviceFallback}
            </Text>
          ) : null}
        </Stack>
      </ScrollView>
    </Screen>
  )
}

function statusCopy(scenario: ListenScenario | null, view: ListenViewModel): string {
  if (scenario === 'empty') return copy.listenExport.status.empty
  if (scenario === 'needs-network') return copy.listenExport.status['needs-network']
  if (scenario === 'generating') return copy.listenExport.status.generating
  if (scenario === 'partial-failure') return copy.listenExport.status['partial-failure']
  if (scenario === 'ready-to-listen') return copy.listenExport.status['ready-to-listen']
  if (scenario === 'playing') return copy.listenExport.status.playing
  if (scenario === 'share-unavailable') return copy.listenExport.status['share-unavailable']
  if (scenario === 'share-ready') return copy.listenExport.status['share-ready']
  if (scenario === 'cancelled') return copy.listenExport.status.cancelled
  if (scenario === 'disk-full') return copy.listenExport.status['disk-full']
  if (scenario === 'session-busy') return copy.listenExport.status['session-busy']
  if (scenario === 'voices-unapproved') return copy.listenExport.status['voices-unapproved']
  if (scenario === 'not-configured') return copy.listenExport.status['not-configured']
  if (view.phase === 'generating') return copy.listenExport.status.generating
  if (view.phase === 'playing') return copy.listenExport.status.playing
  if (view.phase === 'cancelled') return copy.listenExport.status.cancelled
  if (view.phase === 'partial') return copy.listenExport.status['partial-failure']
  if (view.phase === 'ready') {
    return view.shareEnabled
      ? copy.listenExport.status['share-ready']
      : copy.listenExport.status['ready-to-listen']
  }
  const blocker = view.blockers[0]
  if (blocker === 'empty') return copy.listenExport.status.empty
  if (blocker === 'needs-network') return copy.listenExport.status['needs-network']
  if (blocker === 'disk-full') return copy.listenExport.status['disk-full']
  if (blocker === 'session-busy') return copy.listenExport.status['session-busy']
  if (blocker === 'voices-unapproved') return copy.listenExport.status['voices-unapproved']
  if (blocker === 'not-configured') return copy.listenExport.status['not-configured']
  if (blocker === 'native-unavailable') return copy.listenExport.status['native-unavailable']
  if (blocker === 'model-unpinned') return copy.listenExport.status['model-unpinned']
  if (blocker === 'voices-single') return copy.listenExport.status['voices-single']
  if (blocker === 'quota') return copy.listenExport.status.quota
  return copy.listenExport.status['voices-unapproved']
}

function RepeatStepper({
  value,
  onChange,
  disabled,
}: {
  value: ListeningRepeats
  onChange: (value: ListeningRepeats) => void
  disabled: boolean
}) {
  const choices = listeningRepeatChoices()
  return (
    <View accessibilityLabel={copy.a11y.listenExport.repeats} style={styles.stepper}>
      <Pressable
        accessibilityLabel={copy.listenExport.decreaseRepeats}
        disabled={disabled || value <= LISTENING_REPEATS_MIN}
        onPress={() => {
          const next = choices[choices.indexOf(value) - 1]
          if (next !== undefined) onChange(next)
        }}
        style={styles.step}
      >
        <Text>{copy.common.chevron.left}</Text>
      </Pressable>
      <Text variant="body">{copy.listenExport.repeatValue(value)}</Text>
      <Pressable
        accessibilityLabel={copy.listenExport.increaseRepeats}
        disabled={disabled || value >= LISTENING_REPEATS_MAX}
        onPress={() => {
          const next = choices[choices.indexOf(value) + 1]
          if (next !== undefined) onChange(next)
        }}
        style={styles.step}
      >
        <Text>{copy.common.chevron.right}</Text>
      </Pressable>
    </View>
  )
}

const ROW_PADDING = 13

const styles = StyleSheet.create({
  content: { padding: space['5'] },
  row: {
    minHeight: MIN_TAP,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['3'],
    paddingVertical: ROW_PADDING,
    borderBottomWidth: border.hairline,
    borderBottomColor: line.subtle,
  },
  copy: { flex: 1, gap: space['0.5'] },
  stepper: {
    minHeight: MIN_TAP,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['3'],
  },
  step: {
    minWidth: MIN_TAP,
    minHeight: MIN_TAP,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
