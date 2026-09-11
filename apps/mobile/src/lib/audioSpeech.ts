import { useEffect, useState, useSyncExternalStore } from 'react'
import { AppState } from 'react-native'
import {
  AudioSpeechController,
  type AudioAvailability,
  type AudioSnapshot,
  type PlaybackErrorKind,
} from './audioSpeechController'
import { nativeAudioSpeech } from './audioSpeechBridge'
import { playbackSource, type CatalogAudio } from './catalogAudio'
import { copy } from './copy'
import { fetchTtsStatus, type PracticeAudioSource } from './practiceTts'

export const audioSpeech = new AudioSpeechController(nativeAudioSpeech)

export function audioPlaybackNote(
  source: PracticeAudioSource,
  playback: AudioSnapshot['playback'],
  playbackError: PlaybackErrorKind | null = null,
): string {
  if (source === 'unavailable') return copy.audioSpeech.unavailable
  if (playback === 'error') {
    return playbackError === 'quota' ? copy.audioSpeech.quota : copy.audioSpeech.error
  }
  return source === 'catalog' ? copy.audioSpeech.catalog : copy.audioSpeech.apiTts
}

export function useAudioSpeech(
  locale: string,
  catalogAudio?: CatalogAudio | null,
): AudioSnapshot & {
  canPlay: boolean
  canRecognize: boolean
  devicePlayback: boolean
  source: PracticeAudioSource
} {
  const snapshot = useSyncExternalStore(
    audioSpeech.subscribe,
    audioSpeech.getSnapshot,
    audioSpeech.getSnapshot,
  )
  const [availability, setAvailability] = useState<AudioAvailability>({
    playback: false,
    recognition: false,
  })
  const [apiReady, setApiReady] = useState(false)
  useEffect(() => {
    let active = true
    setAvailability({ playback: false, recognition: false })
    setApiReady(false)
    const refresh = (): void => {
      void audioSpeech.availability(locale).then((value) => {
        if (active) setAvailability(value)
      })
      void fetchTtsStatus().then((status) => {
        if (active) setApiReady(status.ready)
      })
    }
    refresh()
    const foreground = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh()
    })
    return () => {
      active = false
      foreground.remove()
    }
  }, [locale])
  const source = playbackSource(catalogAudio, apiReady)
  return {
    ...snapshot,
    canPlay: source !== 'unavailable',
    canRecognize: availability.recognition,
    devicePlayback: false,
    source,
  }
}
