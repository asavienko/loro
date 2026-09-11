import type { NativeAudioSpeech, PlaybackEvent, SpeechEvent } from './audioSpeechController'

type PlaybackListener = (event: PlaybackEvent) => void
type SpeechListener = (event: SpeechEvent) => void

function createWebAudioSpeech(): NativeAudioSpeech {
  let element: HTMLAudioElement | null = null
  const playback = new Set<PlaybackListener>()
  const speech = new Set<SpeechListener>()
  const emit = (event: PlaybackEvent): void => {
    playback.forEach((listener) => {
      listener(event)
    })
  }
  const stop = (id: string | null, state: PlaybackEvent['state']): void => {
    element?.pause()
    element = null
    if (id !== null) emit({ id, state })
  }
  return {
    availability: () => Promise.resolve({ playback: false, recognition: false }),
    play(request) {
      const uri = request.uri?.trim() ?? ''
      if (uri.length === 0 || typeof globalThis.Audio !== 'function') {
        return Promise.reject(new Error('native-audio-unavailable'))
      }
      if (!/^(https?:|blob:|data:|file:)/i.test(uri)) {
        return Promise.reject(new Error('native-audio-unavailable'))
      }
      stop(null, 'stopped')
      const audio = new globalThis.Audio(uri)
      audio.preload = 'auto'
      if (Number.isFinite(request.rate) && request.rate > 0) audio.playbackRate = request.rate
      element = audio
      audio.addEventListener('playing', () => {
        emit({ id: request.id, state: 'playing' })
      })
      audio.addEventListener('ended', () => {
        if (element === audio) {
          element = null
          emit({ id: request.id, state: 'ended' })
        }
      })
      audio.addEventListener('error', () => {
        if (element === audio) {
          element = null
          emit({ id: request.id, state: 'error', error: 'file-unavailable' })
        }
      })
      const started = audio.play()
      return started.catch(() => {
        if (element === audio) {
          element = null
          throw new Error('native-audio-unavailable')
        }
      })
    },
    stopPlayback() {
      const id = element === null ? null : 'web'
      stop(id, 'stopped')
      return Promise.resolve()
    },
    startListening() {
      return Promise.reject(new Error('web-speech-forbidden'))
    },
    stopListening() {
      return Promise.resolve()
    },
    addListener(event, callback) {
      if (event === 'playback') {
        const listener = callback as PlaybackListener
        playback.add(listener)
        return {
          remove() {
            playback.delete(listener)
          },
        }
      }
      const listener = callback as SpeechListener
      speech.add(listener)
      return {
        remove() {
          speech.delete(listener)
        },
      }
    },
  }
}

/** Web may play catalog files. Browser recognition is forbidden: providers may upload recordings. */
export const nativeAudioSpeech: NativeAudioSpeech = createWebAudioSpeech()
