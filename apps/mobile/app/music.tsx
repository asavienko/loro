import { useLocalSearchParams } from 'expo-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ScrollView, StyleSheet } from 'react-native'
import {
  isActive,
  MUSIC_MAX_PHRASES,
  MUSIC_MAX_STYLES,
  MUSIC_MIN_STYLES,
  MUSIC_STYLE_IDS,
} from '@loro/core'
import type { MusicStyleId } from '@loro/core'
import { accountClient } from '../src/lib/account/runtime'
import { bundledApiUrl } from '../src/lib/account/config'
import { audioCache } from '../src/lib/audioCache'
import { audioSpeech } from '../src/lib/audioSpeech'
import { isNetworkAvailable } from '../src/lib/connectivity'
import { copy } from '../src/lib/copy'
import { useLocale } from '../src/lib/i18n'
import {
  defaultStyleIds,
  fetchMusicStatus,
  isMusicUiState,
  musicGenerationBlocked,
  renderLocalStyles,
  MusicClientError,
  requestLocalLyrics,
  requestMusicLyrics,
  requestMusicRenders,
  requestMusicTrackMeta,
  musicTrackIdFromContentUrl,
  type MusicLyricsView,
  type MusicTrackView,
} from '../src/lib/music/client'
import {
  MUSIC_MIN_PHRASES,
  musicPickerRows,
  selectionInBounds,
  todayPresetCatalogIds,
  uniqueCatalogIds,
} from '../src/lib/music/selection'
import { FIXTURE_WAV_DURATION_MS } from '../src/lib/music/wav'
import { useApp } from '../src/store'
import { useViews } from '../src/store/selectors'
import { Button, Card, ListRow, Screen, SectionLabel, Stack, Text } from '../src/ui/primitives'
import { ink, space, surface } from '../src/ui/theme'
import { useTheme } from '../src/ui/ThemeProvider'

export default function Music() {
  useLocale()
  const { accent } = useTheme()
  const params = useLocalSearchParams<{ musicState?: string }>()
  const fixture = isMusicUiState(params.musicState) ? params.musicState : undefined
  const views = useViews()
  const refrainSet = useApp((state) => state.refrainSet)
  const targetLocale = useApp((state) => state.targetLocale)
  const meaningLanguage = useApp((state) => state.nativeLanguage)
  const rows = useMemo(() => musicPickerRows(views), [views])
  const preset = useMemo(() => todayPresetCatalogIds(views, refrainSet), [views, refrainSet])
  const extras = useMemo(
    () =>
      views.filter(
        (view) =>
          view.phraseId !== null &&
          view.catalog !== null &&
          view.catalog.deprecatedBy === undefined &&
          !isActive(view) &&
          !rows.some((row) => row.id === view.id),
      ),
    [views, rows],
  )

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [lyrics, setLyrics] = useState<MusicLyricsView | null>(null)
  const [styleIds, setStyleIds] = useState<MusicStyleId[]>(defaultStyleIds())
  const [tracks, setTracks] = useState<MusicTrackView[]>([])
  const [step, setStep] = useState<'pick' | 'lyrics' | 'styles' | 'play'>('pick')
  const [busy, setBusy] = useState(false)
  const [offlineBlocked, setOfflineBlocked] = useState(false)
  const [quotaBlocked, setQuotaBlocked] = useState(false)
  const [online, setOnline] = useState(true)
  const [playStyle, setPlayStyle] = useState<MusicStyleId | null>(null)
  const [playing, setPlaying] = useState(false)
  const [knownDurationMs, setKnownDurationMs] = useState<number | null>(null)
  const [musicReady, setMusicReady] = useState(false)
  const fixtureHydrated = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (fixture === undefined || fixtureHydrated.current === fixture) return
    if (fixture === 'unavailable') {
      fixtureHydrated.current = fixture
      setStep('styles')
      return
    }

    const ids = uniqueCatalogIds(rows).slice(0, MUSIC_MIN_PHRASES)
    if (ids.length < MUSIC_MIN_PHRASES) return

    fixtureHydrated.current = fixture
    setSelectedIds(ids)
    if (fixture === 'selected') return

    const next = requestLocalLyrics(ids, targetLocale, meaningLanguage, {
      fallback: fixture === 'fallback',
    })
    setLyrics(next)
    setStep(
      fixture === 'generating'
        ? 'styles'
        : fixture === 'partial' || fixture === 'playing'
          ? 'play'
          : 'lyrics',
    )
    if (fixture === 'generating') setBusy(true)
    if (fixture === 'partial') setTracks(renderLocalStyles(defaultStyleIds(), 'partial'))
    if (fixture === 'playing') {
      const ready = renderLocalStyles(defaultStyleIds(), 'ok')
      setTracks(ready)
      setPlayStyle(ready[0]?.styleId ?? null)
      setKnownDurationMs(FIXTURE_WAV_DURATION_MS)
      setPlaying(true)
    }
    if (fixture === 'error') setTracks(renderLocalStyles(defaultStyleIds(), 'error'))
  }, [fixture, meaningLanguage, rows, targetLocale])

  useEffect(() => {
    return () => {
      void audioSpeech.stopPlayback()
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void fetchMusicStatus().then((status) => {
      if (!cancelled) setMusicReady(status.ready)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const refresh = (): void => {
      void isNetworkAvailable().then((value) => {
        if (!cancelled) setOnline(value)
      })
    }
    refresh()
    return () => {
      cancelled = true
    }
  }, [])

  const selectedCount = selectedIds.length
  const canRequest = selectionInBounds(selectedIds)
  const canConfirmStyles =
    styleIds.length >= MUSIC_MIN_STYLES && styleIds.length <= MUSIC_MAX_STYLES
  const unavailable =
    offlineBlocked ||
    musicGenerationBlocked(online, fixture) ||
    (fixture === undefined && !musicReady)
  const readyTracks = tracks.filter((track) => track.status === 'ready')
  const failedTracks = tracks.filter((track) => track.status === 'failed')

  const togglePhrase = (catalogId: string): void => {
    setSelectedIds((current) => {
      if (current.includes(catalogId)) return current.filter((id) => id !== catalogId)
      if (current.length >= MUSIC_MAX_PHRASES) return current
      return [...current, catalogId]
    })
  }

  const toggleStyle = (styleId: MusicStyleId): void => {
    setStyleIds((current) => {
      if (current.includes(styleId)) {
        if (current.length <= MUSIC_MIN_STYLES) return current
        return current.filter((id) => id !== styleId)
      }
      if (current.length >= MUSIC_MAX_STYLES) return current
      return [...current, styleId]
    })
  }

  const musicCredentials = async (): Promise<{ token: string; deviceId: string } | null> => {
    const client = accountClient()
    if (client?.getSnapshot().status !== 'signed-in') return null
    const token = await client.getAccessToken()
    const deviceId = client.getSnapshot().session?.deviceId
    if (!token || deviceId === undefined || deviceId.length === 0) return null
    return { token, deviceId }
  }

  const requestLyrics = (): void => {
    if (!canRequest) return
    if (fixture !== undefined) {
      const next = requestLocalLyrics(selectedIds, targetLocale, meaningLanguage)
      setLyrics(next)
      setStep('lyrics')
      setTracks([])
      return
    }
    const api = bundledApiUrl()
    if (api === null || !musicReady) {
      setOfflineBlocked(true)
      setQuotaBlocked(false)
      return
    }
    setBusy(true)
    void musicCredentials()
      .then((credentials) =>
        requestMusicLyrics(
          {
            catalogPhraseIds: selectedIds,
            targetLocale,
            meaningLanguage,
          },
          api,
          credentials,
        ),
      )
      .then((next) => {
        setLyrics(next)
        setStep('lyrics')
        setTracks([])
        setOfflineBlocked(false)
        setQuotaBlocked(false)
      })
      .catch((error: unknown) => {
        setQuotaBlocked(error instanceof MusicClientError && error.code === 'quota')
        setOfflineBlocked(!(error instanceof MusicClientError && error.code === 'quota'))
      })
      .finally(() => {
        setBusy(false)
      })
  }

  const confirmStyles = (): void => {
    if (!canConfirmStyles || lyrics === null) return
    void isNetworkAvailable().then((onlineNow) => {
      setOnline(onlineNow)
      if (musicGenerationBlocked(onlineNow, fixture)) {
        setOfflineBlocked(true)
        return
      }
      setOfflineBlocked(false)
      if (fixture === 'generating') {
        setBusy(true)
        setStep('styles')
        return
      }
      const mode = fixture === 'error' ? 'error' : fixture === 'partial' ? 'partial' : 'ok'
      if (mode === 'error') {
        setTracks(renderLocalStyles(styleIds, mode))
        setStep('lyrics')
        return
      }
      if (fixture !== undefined) {
        setBusy(true)
        const next = renderLocalStyles(styleIds, mode)
        setTracks(next)
        setBusy(false)
        setStep('play')
        setPlayStyle(next.find((track) => track.status === 'ready')?.styleId ?? null)
        return
      }
      const api = bundledApiUrl()
      const lyricDocumentId = lyrics.lyricDocumentId
      if (api === null || lyricDocumentId === undefined || !musicReady) {
        setOfflineBlocked(true)
        setQuotaBlocked(false)
        return
      }
      setBusy(true)
      void musicCredentials()
        .then((credentials) => requestMusicRenders({ lyricDocumentId, styleIds }, api, credentials))
        .then((next) => {
          setTracks(next)
          setBusy(false)
          setStep('play')
          setPlayStyle(next.find((track) => track.status === 'ready')?.styleId ?? null)
          setOfflineBlocked(false)
          setQuotaBlocked(false)
        })
        .catch((error: unknown) => {
          setBusy(false)
          setQuotaBlocked(error instanceof MusicClientError && error.code === 'quota')
          setOfflineBlocked(!(error instanceof MusicClientError && error.code === 'quota'))
        })
    })
  }

  const playTrack = (track: MusicTrackView): void => {
    const sourceUri = track.uri
    if (sourceUri === null) {
      if (track.durationMs !== null) setKnownDurationMs(track.durationMs)
      setPlayStyle(track.styleId)
      setPlaying(true)
      return
    }
    if (track.durationMs !== null) setKnownDurationMs(track.durationMs)
    setPlayStyle(track.styleId)
    setPlaying(true)
    void (async () => {
      let uri = sourceUri
      let digest = track.sha256
      if (digest === undefined && audioCache.available) {
        const trackId = musicTrackIdFromContentUrl(uri)
        const api = bundledApiUrl()
        if (trackId !== null && api !== null) {
          const meta = await requestMusicTrackMeta(trackId, api, await musicCredentials())
          digest = meta?.sha256
          if (meta?.durationMs !== null && meta?.durationMs !== undefined) {
            setKnownDurationMs(meta.durationMs)
          }
        }
      }
      if (
        audioCache.available &&
        digest !== undefined &&
        !uri.startsWith('file:') &&
        !uri.startsWith('data:')
      ) {
        const file = await audioCache.download({
          url: uri,
          expectedSha256: digest,
          logicalKey: `music:${digest}`,
          pinClass: 'practice',
        })
        uri = file.fileUri
      }
      await audioSpeech.playFile(`music:${track.styleId}`, uri, () => {
        setPlaying(false)
      })
    })().catch(() => {
      setPlaying(false)
    })
  }

  const pauseTrack = (): void => {
    void audioSpeech.stopPlayback()
    setPlaying(false)
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Stack gap={space['5']}>
          {step === 'pick' ? (
            <Stack gap={space['2']}>
              <Text variant="hero" color={ink.ink}>
                {copy.music.title}
              </Text>
              <Text variant="bodyMd" color={ink.ink2}>
                {copy.music.intro}
              </Text>
            </Stack>
          ) : null}

          {step === 'pick' ? (
            <Stack gap={space['4']}>
              <SectionLabel>{copy.music.picker.heading}</SectionLabel>
              <Text variant="caption" color={ink.muted}>
                {copy.music.picker.hint}
              </Text>
              <Text variant="caption" color={ink.ink2}>
                {copy.music.picker.count(selectedCount)}
              </Text>
              {preset.length >= MUSIC_MIN_PHRASES ? (
                <Button
                  label={copy.music.picker.useToday}
                  variant="secondary"
                  onPress={() => {
                    setSelectedIds(preset)
                  }}
                />
              ) : null}
              <Card padding={0} style={styles.group}>
                {[...rows, ...extras]
                  .filter((view) => view.phraseId !== null)
                  .map((view, index, list) => {
                    const catalogId = view.phraseId
                    if (catalogId === null) return null
                    const selected = selectedIds.includes(catalogId)
                    return (
                      <ListRow
                        key={view.id}
                        accessibilityRole="checkbox"
                        selected={selected}
                        accessibilityLabel={copy.music.picker.phrase(
                          view.targetText,
                          view.translation,
                        )}
                        onPress={() => {
                          togglePhrase(catalogId)
                        }}
                        gap={space['2.5']}
                        last={index === list.length - 1}
                      >
                        <Text variant="body" color={ink.ink} lang="target" style={styles.grow}>
                          {view.targetText}
                        </Text>
                        <Text variant="captionSm" color={ink.muted}>
                          {view.translation}
                        </Text>
                      </ListRow>
                    )
                  })}
              </Card>
              {quotaBlocked || offlineBlocked ? (
                <Text variant="caption" color={ink.ink2}>
                  {quotaBlocked ? copy.music.state.quota : copy.music.state.unavailable}
                </Text>
              ) : null}
              {!canRequest ? (
                <Text variant="caption" color={ink.muted}>
                  {selectedCount > MUSIC_MAX_PHRASES
                    ? copy.music.picker.tooMany
                    : copy.music.picker.needMore}
                </Text>
              ) : null}
              <Button
                label={copy.music.lyrics.request}
                size="cta"
                onPress={requestLyrics}
                disabled={!canRequest || busy}
              />
            </Stack>
          ) : null}

          {step === 'lyrics' && lyrics !== null ? (
            <Stack gap={space['4']}>
              <Text variant="title1" color={ink.ink}>
                {copy.music.lyrics.review}
              </Text>
              {lyrics.fallback ? (
                <Text variant="bodyMd" color={ink.ink2}>
                  {copy.music.fallback.lyricsOnly}
                </Text>
              ) : null}
              <Card padding={space['5']}>
                <Stack gap={space['2']}>
                  <Text variant="title2" color={ink.ink} lang="target">
                    {lyrics.document.title.target}
                  </Text>
                  <Text variant="caption" color={ink.muted} style={styles.italic}>
                    {lyrics.document.title.translation}
                  </Text>
                </Stack>
              </Card>
              {lyrics.document.sections.map((section) => {
                const chorus = section.name === 'Chorus'
                const onAccent = chorus ? surface.app : ink.ink
                return (
                  <Card
                    key={section.name}
                    padding={space['5']}
                    background={chorus ? accent.accent : undefined}
                    border={chorus ? false : undefined}
                  >
                    <Stack gap={space['2']}>
                      <SectionLabel color={chorus ? surface.app : undefined}>
                        {copy.music.lyrics.section(section.name)}
                      </SectionLabel>
                      {section.lines.map((line) => (
                        <Text key={line} variant="title2" color={onAccent} lang="target">
                          {line}
                        </Text>
                      ))}
                    </Stack>
                  </Card>
                )
              })}
              {lyrics.document.gloss_lines.map((line) => (
                <Stack key={line.target} gap={space['1']}>
                  <Text variant="captionSm" color={ink.ink2} lang="target">
                    {line.target}
                  </Text>
                  <Text variant="captionSm" color={ink.muted}>
                    {line.translation}
                  </Text>
                </Stack>
              ))}
              {failedTracks.length > 0 && readyTracks.length === 0 ? (
                <Text variant="caption" color={ink.ink2}>
                  {copy.music.state.error}
                </Text>
              ) : null}
              <Button
                label={copy.music.lyrics.regenerate}
                variant="secondary"
                onPress={requestLyrics}
              />
              <Button
                label={copy.music.lyrics.confirm}
                size="cta"
                onPress={() => {
                  setStep('styles')
                }}
              />
            </Stack>
          ) : null}

          {step === 'styles' ? (
            <Stack gap={space['4']}>
              <Text variant="title1" color={ink.ink}>
                {copy.music.styles.heading}
              </Text>
              <Text variant="bodyMd" color={ink.ink2}>
                {copy.music.styles.hint}
              </Text>
              <Card padding={0} style={styles.group}>
                {MUSIC_STYLE_IDS.map((styleId, index) => {
                  const selected = styleIds.includes(styleId)
                  return (
                    <ListRow
                      key={styleId}
                      accessibilityRole="checkbox"
                      selected={selected}
                      accessibilityLabel={copy.music.styles[styleId]}
                      onPress={() => {
                        toggleStyle(styleId)
                      }}
                      gap={space['2.5']}
                      last={index === MUSIC_STYLE_IDS.length - 1}
                    >
                      <Text variant="body" color={ink.ink} style={styles.grow}>
                        {copy.music.styles[styleId]}
                      </Text>
                    </ListRow>
                  )
                })}
              </Card>
              <Text variant="caption" color={ink.ink2}>
                {copy.music.styles.allowance}
              </Text>
              {unavailable || quotaBlocked ? (
                <Text variant="body" color={ink.ink2}>
                  {quotaBlocked ? copy.music.state.quota : copy.music.state.unavailable}
                </Text>
              ) : null}
              <Button
                label={busy ? copy.music.state.generating : copy.music.styles.confirm}
                size="cta"
                onPress={confirmStyles}
                disabled={!canConfirmStyles || unavailable || busy}
              />
            </Stack>
          ) : null}

          {step === 'play' ? (
            <Stack gap={space['4']}>
              <Text variant="title1" color={ink.ink}>
                {copy.music.title}
              </Text>
              <Text variant="bodyMd" color={ink.ink2}>
                {copy.music.generated}
              </Text>
              {failedTracks.length > 0 && readyTracks.length > 0 ? (
                <Text variant="caption" color={ink.ink2}>
                  {copy.music.state.partial}
                </Text>
              ) : null}
              <Card padding={0} style={styles.group}>
                {tracks.map((track, index) => (
                  <ListRow
                    key={track.styleId}
                    accessibilityRole="radio"
                    selected={playStyle === track.styleId}
                    disabled={track.status !== 'ready'}
                    accessibilityLabel={copy.music.styles[track.styleId]}
                    onPress={() => {
                      if (track.status === 'ready') playTrack(track)
                    }}
                    gap={space['2.5']}
                    last={index === tracks.length - 1}
                  >
                    <Text variant="body" color={ink.ink} style={styles.grow}>
                      {copy.music.styles[track.styleId]}
                    </Text>
                    <Text variant="captionSm" color={ink.muted}>
                      {track.status === 'ready' ? copy.music.play : copy.music.state.error}
                    </Text>
                  </ListRow>
                ))}
              </Card>
              {readyTracks.length > 0 ? (
                <Button
                  label={playing ? copy.music.pause : copy.music.play}
                  size="cta"
                  onPress={() => {
                    const track = tracks.find(
                      (entry) => entry.styleId === playStyle && entry.status === 'ready',
                    )
                    if (playing) pauseTrack()
                    else if (track) playTrack(track)
                  }}
                />
              ) : null}
              {knownDurationMs !== null ? (
                <Text variant="caption" color={ink.muted}>
                  {copy.music.duration(knownDurationMs)}
                </Text>
              ) : null}
            </Stack>
          ) : null}
        </Stack>
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { padding: space['5'] },
  group: { overflow: 'hidden' },
  grow: { flex: 1 },
  italic: { fontStyle: 'italic' },
})
