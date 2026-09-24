import { useRef, useState } from 'react'
import { audioSpeech, useAudioSpeech } from '../../../src/lib/audioSpeech'
import {
  DEFAULT_CADENCE_LOOP,
  DEFAULT_CADENCE_RATE,
  nextCadenceLoop,
  type CadenceLoop,
  type CadenceRate,
} from '../../../src/lib/streamCadence'
import { useApp, type PhraseView } from '../../../src/store'

export function useStreamCadence(phrase: PhraseView) {
  const locale = useApp((state) => state.targetLocale)
  const recordPlay = useApp((state) => state.recordPlay)
  const audio = useAudioSpeech(locale, phrase.catalog?.audio)
  const [loop, setLoop] = useState<CadenceLoop>(DEFAULT_CADENCE_LOOP)
  const [rate, setRate] = useState<CadenceRate>(DEFAULT_CADENCE_RATE)
  const phraseIdRef = useRef(phrase.id)
  phraseIdRef.current = phrase.id
  const remainingRef = useRef(0)
  const rateRef = useRef(rate)
  rateRef.current = rate
  const playing =
    audio.phraseId === phrase.id && (audio.playback === 'playing' || audio.playback === 'loading')
  const playCurrent = (): void => {
    const id = phrase.id
    void audioSpeech.play(
      id,
      phrase.targetText,
      locale,
      rateRef.current,
      () => {
        recordPlay(id)
        remainingRef.current -= 1
        if (remainingRef.current > 0 && phraseIdRef.current === id) playCurrent()
      },
      phrase.catalog?.audio,
    )
  }
  return {
    audio,
    loop,
    rate,
    setRate,
    playing,
    onLoop: (): void => {
      setLoop((current) => nextCadenceLoop(current))
    },
    playOrStop: (): void => {
      if (playing) {
        remainingRef.current = 0
        void audioSpeech.stopPlayback()
        return
      }
      remainingRef.current = loop
      playCurrent()
    },
    resetPlay: (): void => {
      remainingRef.current = 0
    },
  }
}
