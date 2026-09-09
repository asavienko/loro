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
import { copy } from '../src/lib/copy'
import { useLocale } from '../src/lib/i18n'
import {
  defaultStyleIds,
  isMusicUiState,
  renderLocalStyles,
  requestLocalLyrics,
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
import { Button, Pressable, Screen, SectionLabel, Stack, Text } from '../src/ui/primitives'
import { border, ink, line, space } from '../src/ui/theme'

const ROW_PADDING = 13
const MIN_ROW_HEIGHT = 48

export default function Music() {
  useLocale()
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
  const [playStyle, setPlayStyle] = useState<MusicStyleId | null>(null)
  const [playing, setPlaying] = useState(false)
  const [knownDurationMs, setKnownDurationMs] = useState<number | null>(null)
  const [player, setPlayer] = useState<{ pause: () => void } | null>(null)
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
      player?.pause()
    }
  }, [player])

  const selectedCount = selectedIds.length
  const canRequest = selectionInBounds(selectedIds)
  const canConfirmStyles =
    styleIds.length >= MUSIC_MIN_STYLES && styleIds.length <= MUSIC_MAX_STYLES
  const unavailable = fixture === 'unavailable'
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

  const requestLyrics = (): void => {
    if (!canRequest) return
    const next = requestLocalLyrics(selectedIds, targetLocale, meaningLanguage)
    setLyrics(next)
    setStep('lyrics')
    setTracks([])
  }

  const confirmStyles = (): void => {
    if (!canConfirmStyles || lyrics === null) return
    if (unavailable) return
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
    setBusy(true)
    const next = renderLocalStyles(styleIds, mode)
    setTracks(next)
    setBusy(false)
    setStep('play')
    setPlayStyle(next.find((track) => track.status === 'ready')?.styleId ?? null)
  }

  const playTrack = (track: MusicTrackView): void => {
    if (track.uri === null || typeof globalThis.Audio !== 'function') {
      if (track.durationMs !== null) setKnownDurationMs(track.durationMs)
      setPlayStyle(track.styleId)
      setPlaying(true)
      return
    }
    player?.pause()
    const audio = new globalThis.Audio(track.uri)
    audio.addEventListener('loadedmetadata', () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setKnownDurationMs(Math.round(audio.duration * 1_000))
      } else if (track.durationMs !== null) {
        setKnownDurationMs(track.durationMs)
      }
    })
    void audio.play()
    setPlayer(audio)
    setPlayStyle(track.styleId)
    setPlaying(true)
    audio.addEventListener('ended', () => {
      setPlaying(false)
    })
  }

  const pauseTrack = (): void => {
    player?.pause()
    setPlaying(false)
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Stack gap={space['5']}>
          <Text variant="title2" color={ink.ink}>
            {copy.music.title}
          </Text>
          <Text variant="body" color={ink.ink2}>
            {copy.music.intro}
          </Text>

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
              {[...rows, ...extras].map((view) => {
                const catalogId = view.phraseId
                if (catalogId === null) return null
                const selected = selectedIds.includes(catalogId)
                return (
                  <Pressable
                    key={view.id}
                    accessibilityRole="checkbox"
                    selected={selected}
                    accessibilityLabel={copy.music.picker.phrase(view.targetText, view.translation)}
                    onPress={() => {
                      togglePhrase(catalogId)
                    }}
                    style={styles.row}
                  >
                    <Text variant="body" color={ink.ink} lang="target" style={styles.grow}>
                      {view.targetText}
                    </Text>
                    <Text variant="captionSm" color={ink.muted}>
                      {view.translation}
                    </Text>
                  </Pressable>
                )
              })}
              {!canRequest ? (
                <Text variant="caption" color={ink.muted}>
                  {selectedCount > MUSIC_MAX_PHRASES
                    ? copy.music.picker.tooMany
                    : copy.music.picker.needMore}
                </Text>
              ) : null}
              <Button
                label={copy.music.lyrics.request}
                onPress={requestLyrics}
                disabled={!canRequest}
              />
            </Stack>
          ) : null}

          {step === 'lyrics' && lyrics !== null ? (
            <Stack gap={space['4']}>
              <SectionLabel>{copy.music.lyrics.review}</SectionLabel>
              {lyrics.fallback ? (
                <Text variant="caption" color={ink.ink2}>
                  {copy.music.fallback.lyricsOnly}
                </Text>
              ) : null}
              <Text variant="title3" color={ink.ink} lang="target">
                {lyrics.document.title.target}
              </Text>
              <Text variant="caption" color={ink.muted}>
                {lyrics.document.title.translation}
              </Text>
              {lyrics.document.sections.map((section) => (
                <Stack key={section.name} gap={space['2']}>
                  <SectionLabel>{section.name}</SectionLabel>
                  {section.lines.map((line) => (
                    <Text key={line} variant="body" color={ink.ink} lang="target">
                      {line}
                    </Text>
                  ))}
                </Stack>
              ))}
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
                onPress={() => {
                  setStep('styles')
                }}
              />
            </Stack>
          ) : null}

          {step === 'styles' ? (
            <Stack gap={space['4']}>
              <SectionLabel>{copy.music.styles.heading}</SectionLabel>
              <Text variant="caption" color={ink.muted}>
                {copy.music.styles.hint}
              </Text>
              {MUSIC_STYLE_IDS.map((styleId) => {
                const selected = styleIds.includes(styleId)
                return (
                  <Pressable
                    key={styleId}
                    accessibilityRole="checkbox"
                    selected={selected}
                    accessibilityLabel={copy.music.styles[styleId]}
                    onPress={() => {
                      toggleStyle(styleId)
                    }}
                    style={styles.row}
                  >
                    <Text variant="body" color={ink.ink} style={styles.grow}>
                      {copy.music.styles[styleId]}
                    </Text>
                  </Pressable>
                )
              })}
              <Text variant="caption" color={ink.ink2}>
                {copy.music.styles.allowance}
              </Text>
              {unavailable ? (
                <Text variant="body" color={ink.ink2}>
                  {copy.music.state.unavailable}
                </Text>
              ) : null}
              <Button
                label={copy.music.styles.confirm}
                onPress={confirmStyles}
                disabled={!canConfirmStyles || unavailable}
                loading={busy}
                accessibilityHint={busy ? copy.music.state.generating : undefined}
              />
              {busy ? (
                <Text variant="caption" color={ink.ink2}>
                  {copy.music.state.generating}
                </Text>
              ) : null}
            </Stack>
          ) : null}

          {step === 'play' ? (
            <Stack gap={space['4']}>
              <Text variant="caption" color={ink.ink2}>
                {copy.music.generated}
              </Text>
              {failedTracks.length > 0 && readyTracks.length > 0 ? (
                <Text variant="caption" color={ink.ink2}>
                  {copy.music.state.partial}
                </Text>
              ) : null}
              {tracks.map((track) => (
                <Pressable
                  key={track.styleId}
                  accessibilityRole="radio"
                  selected={playStyle === track.styleId}
                  disabled={track.status !== 'ready'}
                  accessibilityLabel={copy.music.styles[track.styleId]}
                  onPress={() => {
                    if (track.status === 'ready') playTrack(track)
                  }}
                  style={styles.row}
                >
                  <Text variant="body" color={ink.ink} style={styles.grow}>
                    {copy.music.styles[track.styleId]}
                  </Text>
                  <Text variant="captionSm" color={ink.muted}>
                    {track.status === 'ready' ? copy.music.play : copy.music.state.error}
                  </Text>
                </Pressable>
              ))}
              {readyTracks.length > 0 ? (
                <Button
                  label={playing ? copy.music.pause : copy.music.play}
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
  row: {
    minHeight: MIN_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['2.5'],
    paddingVertical: ROW_PADDING,
    borderBottomWidth: border.hairline,
    borderBottomColor: line.subtle,
  },
  grow: { flex: 1 },
})
