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
import { accountClient } from '../src/lib/account/runtime'
import { audioCache } from '../src/lib/audioCache'
import { audioSpeech, useAudioSpeech } from '../src/lib/audioSpeech'
import { bundledApiUrl } from '../src/lib/account/config'
import { isNetworkAvailable, onNetworkAvailable } from '../src/lib/connectivity'
import { copy } from '../src/lib/copy'
import { deviceClock } from '../src/lib/clock'
import { useLocale } from '../src/lib/i18n'
import { fetchTtsStatus } from '../src/lib/practiceTts'
import {
  isListenPlaybackId,
  listenStatusKind,
  listenViewModel,
  listeningFixtureSeedEnabled,
  playListeningSequence,
  prepareListeningBatch,
  restoreListeningBatch,
  shareListeningBatch,
  type ListenPhase,
  type ListenProgress,
  type ListenViewModel,
} from '../src/lib/listenCompanion'
import {
  fixtureListenView,
  listenScenarioFromSearch,
  type ListenScenario,
} from '../src/lib/listenFixtures'
import { AudioCacheError, type AudioCacheObject } from '../src/lib/audioCacheController'
import { TtsRenderError } from '../src/lib/ttsRenderClient'
import { DEV_LISTENING_FIXTURE_MODEL_ID, devListeningFixtureVoices } from '../src/lib/devListening'
import { useApp } from '../src/store'
import { toView } from '../src/store/view'
import {
  Button,
  Card,
  Equalizer,
  Pressable,
  Screen,
  SectionLabel,
  Stack,
  Text,
} from '../src/ui/primitives'
import { MIN_TAP, accent, border, ink, line, radius, space, surface } from '../src/ui/theme'
import { useTheme } from '../src/ui/ThemeProvider'

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
  const [nativeDebug, setNativeDebug] = useState(false)
  const [phase, setPhase] = useState<ListenPhase>('idle')
  const [progress, setProgress] = useState<ListenProgress>(emptyProgress)
  const [durationMs, setDurationMs] = useState<number | null>(null)
  const [cacheComplete, setCacheComplete] = useState(false)
  const [diskFull, setDiskFull] = useState(false)
  const [quotaExceeded, setQuotaExceeded] = useState(false)
  const [ttsReady, setTtsReady] = useState(false)
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

  useEffect(() => {
    void audioCache.isDebuggable().then(setNativeDebug)
  }, [])

  useEffect(() => {
    void fetchTtsStatus().then((status) => {
      setTtsReady(status.ready)
    })
  }, [])

  useEffect(() => {
    if (scenario !== null) return
    void restoreListeningBatch(audioCache).then((stored) => {
      if (stored === null) return
      clips.current = stored
      const measured = stored.reduce<number | null>((sum, clip) => {
        if (sum === null || clip.ms === null) return null
        return sum + clip.ms
      }, 0)
      setDurationMs(measured)
      setCacheComplete(true)
      setPhase('ready')
      setProgress({ done: stored.length, total: stored.length, failed: 0 })
    })
  }, [scenario])

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
    configured: bundledApiUrl() !== null && ttsReady,
    nativeCache: audioCache.available,
    remotePlayback: !audioCache.available,
    sessionBusy,
    diskFull,
    quotaExceeded,
    cacheComplete,
    progress,
    durationMs,
  })
  const view = scenario === null ? live : fixtureListenView(scenario)
  const fixtureMode =
    scenario === null &&
    listeningFixtureSeedEnabled({
      licensedGenerate: view.generateEnabled,
      nativeDebug,
      nativeCache: audioCache.available,
    })
  const generateEnabled =
    (view.generateEnabled ||
      (fixtureMode &&
        lines.length > 0 &&
        !diskFull &&
        !sessionBusy &&
        view.phase !== 'generating')) &&
    (!needsConsent || consent)
  const status = statusCopy(scenario, view, fixtureMode)

  const generate = (): void => {
    if (!generateEnabled) return
    abort.current?.abort()
    abort.current = new AbortController()
    setDiskFull(false)
    setQuotaExceeded(false)
    setPhase('generating')
    void prepareListeningBatch({
      cache: audioCache,
      locale,
      phrases: lines,
      repeats,
      credentials: async () => {
        const client = accountClient()
        if (client?.getSnapshot().status !== 'signed-in') return null
        const token = await client.getAccessToken()
        const deviceId = client.getSnapshot().session?.deviceId
        if (!token || deviceId === undefined || deviceId.length === 0) return null
        return { token, deviceId }
      },
      remotePlayback: !audioCache.available,
      ...(fixtureMode
        ? {
            voices: devListeningFixtureVoices(locale),
            modelId: DEV_LISTENING_FIXTURE_MODEL_ID,
            seedClip: (key: string) => audioCache.installDevFixture(key),
          }
        : {}),
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
        if (result.phase === 'ready') void audioCache.saveListeningBatch(result.clips)
      })
      .catch((error: unknown) => {
        setPhase('error')
        if (error instanceof AudioCacheError && error.code === 'disk-full') {
          setDiskFull(true)
          setCacheComplete(false)
        }
        if (error instanceof TtsRenderError && error.code === 'quota') {
          setQuotaExceeded(true)
          setCacheComplete(false)
        }
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
            <Text variant="hero" color={ink.ink}>
              {copy.nav.listenExport}
            </Text>
            <Text variant="title3" color={accent.accentInk}>
              {copy.listenExport.title}
            </Text>
            <Text variant="prose" color={ink.ink2}>
              {copy.listenExport.intro}
            </Text>
          </Stack>
          <Card padding={space['5']}>
            <Stack gap={space['2']}>
              <Text variant="title3" color={ink.ink}>
                {copy.listenExport.phraseCount(view.phraseCount)}
              </Text>
              <View
                accessibilityLiveRegion="polite"
                accessibilityLabel={copy.a11y.listenExport.status}
              >
                <Text variant="body" color={ink.ink}>
                  {status}
                </Text>
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
                {scenario !== null || fixtureMode ? (
                  <Text variant="caption" color={ink.muted}>
                    {copy.listenExport.fixtureNote}
                  </Text>
                ) : null}
              </View>
              <Text variant="caption" color={ink.muted}>
                {view.durationMs === null
                  ? copy.listenExport.durationUnknown
                  : copy.listenExport.durationMeasured(view.durationMs)}
              </Text>
              <ListenTransport
                playing={view.phase === 'playing'}
                listenEnabled={view.listenEnabled}
                onListen={listenFromCache}
                onStop={() => {
                  abort.current?.abort()
                  void audioSpeech.stopPlayback()
                  setPhase('ready')
                }}
              />
            </Stack>
          </Card>
          <Card padding={space['5']}>
            <Stack gap={space['3']}>
              <SectionLabel>{copy.listenExport.repeats}</SectionLabel>
              <RepeatStepper
                value={view.repeats}
                onChange={setRepeats}
                disabled={view.phase === 'generating'}
              />
            </Stack>
          </Card>
          <Card padding={space['5']}>
            <Stack gap={space['2']}>
              <SectionLabel>{copy.listenExport.voices}</SectionLabel>
              {view.voices.length === 0 ? (
                <Text variant="body" color={ink.ink}>
                  {copy.listenExport.voicesEmpty}
                </Text>
              ) : (
                view.voices.map((voice) => (
                  <Text key={voice.id} variant="body" color={ink.ink}>
                    {voice.name}
                  </Text>
                ))
              )}
              {view.sequence.length > 0 ? (
                <Text variant="caption" color={ink.muted}>
                  {copy.listenExport.sequence(view.sequence.join(', '))}
                </Text>
              ) : null}
            </Stack>
          </Card>
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
              size="cta"
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
            label={copy.listenExport.share}
            onPress={share}
            disabled={!view.shareEnabled}
            variant="ghost"
          />
        </Stack>
      </ScrollView>
    </Screen>
  )
}

function statusCopy(
  scenario: ListenScenario | null,
  view: ListenViewModel,
  fixtureMode: boolean,
): string {
  if (fixtureMode && view.phase === 'generating') {
    return copy.listenExport.status['fixture-generating']
  }
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
  if (scenario === 'voices-single') return copy.listenExport.status['voices-single']
  if (scenario === 'quota') return copy.listenExport.status.quota
  if (scenario === 'not-configured') return copy.listenExport.status['not-configured']
  return copy.listenExport.status[listenStatusKind(view)]
}

function ListenTransport({
  playing,
  listenEnabled,
  onListen,
  onStop,
}: {
  playing: boolean
  listenEnabled: boolean
  onListen: () => void
  onStop: () => void
}) {
  useLocale()
  const { accent } = useTheme()
  return (
    <View style={styles.transport}>
      {playing ? <Equalizer active color={accent.accent} /> : null}
      <Button
        label={playing ? copy.listenExport.stop : copy.listenExport.listen}
        onPress={playing ? onStop : onListen}
        disabled={!listenEnabled && !playing}
        size="cta"
      />
    </View>
  )
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
    <View
      accessibilityLabel={copy.a11y.listenExport.repeats}
      style={[styles.stepper, styles.stepperWell]}
    >
      <Pressable
        accessibilityLabel={copy.listenExport.decreaseRepeats}
        disabled={disabled || value <= LISTENING_REPEATS_MIN}
        onPress={() => {
          const next = choices[choices.indexOf(value) - 1]
          if (next !== undefined) onChange(next)
        }}
        style={styles.step}
      >
        <Text variant="caption">{copy.common.chevron.left}</Text>
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
        <Text variant="caption">{copy.common.chevron.right}</Text>
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
  transport: {
    marginTop: space['2'],
    backgroundColor: surface.sunken,
    borderRadius: radius.xl,
    padding: space['3.5'],
    gap: space['3'],
    alignItems: 'center',
  },
  stepperWell: {
    backgroundColor: surface.track,
    borderRadius: radius.pill,
    paddingHorizontal: space['3'],
    paddingVertical: 4,
  },
  step: {
    minWidth: MIN_TAP,
    minHeight: MIN_TAP,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
