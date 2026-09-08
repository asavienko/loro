import { useEffect, useState, useSyncExternalStore } from 'react'
import { AppState } from 'react-native'
import {
  AudioSpeechController,
  type AudioAvailability,
  type AudioSnapshot,
} from './audioSpeechController'
import { nativeAudioSpeech } from './audioSpeechBridge'

export const audioSpeech = new AudioSpeechController(nativeAudioSpeech)

export function useAudioSpeech(
  locale: string,
): AudioSnapshot & { canPlay: boolean; canRecognize: boolean } {
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
  return { ...snapshot, canPlay: availability.playback, canRecognize: availability.recognition }
}
