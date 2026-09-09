import { useEffect, useState, useSyncExternalStore } from 'react'
import { AppState } from 'react-native'
import {
  AudioSpeechController,
  type AudioAvailability,
  type AudioSnapshot,
} from './audioSpeechController'
import { nativeAudioSpeech } from './audioSpeechBridge'
import { playbackSource, type CatalogAudio } from './catalogAudio'
import { copy } from './copy'

export const audioSpeech = new AudioSpeechController(nativeAudioSpeech)

export function audioPlaybackNote(
  source: 'catalog' | 'device-tts' | 'unavailable',
  playback: AudioSnapshot['playback'],
): string {
  if (source === 'unavailable') return copy.audioSpeech.unavailable
  if (playback === 'error') return copy.audioSpeech.error
  return source === 'catalog' ? copy.audioSpeech.catalog : copy.audioSpeech.tts
}

export function useAudioSpeech(
  locale: string,
  catalogAudio?: CatalogAudio | null,
): AudioSnapshot & {
  canPlay: boolean
  canRecognize: boolean
  devicePlayback: boolean
  source: 'catalog' | 'device-tts' | 'unavailable'
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
  useEffect(() => {
    let active = true
    setAvailability({ playback: false, recognition: false })
    const refresh = (): void => {
      void audioSpeech.availability(locale).then((value) => {
        if (active) setAvailability(value)
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
  const source = playbackSource(catalogAudio, availability.playback)
  return {
    ...snapshot,
    canPlay: source !== 'unavailable',
    canRecognize: availability.recognition,
    devicePlayback: availability.playback,
    source,
  }
}
