import { describe, expect, it, vi } from 'vitest'
import {
  AudioSpeechController,
  type NativeAudioSpeech,
  type PlaybackEvent,
  type SpeechEvent,
} from './audioSpeechController'

function fixture() {
  let onPlayback: (event: PlaybackEvent) => void = () => undefined
  let onSpeech: (event: SpeechEvent) => void = () => undefined
  const native = {
    availability: vi.fn(() => Promise.resolve({ playback: true, recognition: true })),
    play: vi.fn(() => Promise.resolve()),
    stopPlayback: vi.fn(() => Promise.resolve()),
    startListening: vi.fn(() => Promise.resolve()),
    stopListening: vi.fn(() => Promise.resolve()),
    addListener(
      event: string,
      callback: ((event: PlaybackEvent) => void) | ((event: SpeechEvent) => void),
    ) {
      if (event === 'playback') onPlayback = callback as (event: PlaybackEvent) => void
      else onSpeech = callback as (event: SpeechEvent) => void
      return { remove: () => undefined }
    },
  } satisfies NativeAudioSpeech
  return {
    native,
    controller: new AudioSpeechController(native),
    playback: (event: PlaybackEvent) => {
      onPlayback(event)
    },
    speech: (event: SpeechEvent) => {
      onSpeech(event)
    },
  }
}

describe('native audio metadata boundary', () => {
  it('counts a play once only after its actual completion, never a stop or stale event', async () => {
    const f = fixture()
    const complete = vi.fn()
    await f.controller.play('p', 'Hola', 'es-ES', 0.92, complete)
    f.playback({ id: 'play-1', state: 'playing' })
    expect(complete).not.toHaveBeenCalled()
    f.playback({ id: 'play-1', state: 'ended' })
    f.playback({ id: 'play-1', state: 'ended' })
    expect(complete).toHaveBeenCalledTimes(1)
    await f.controller.play('p', 'Hola', 'es-ES', 0.92, complete)
    await f.controller.stopPlayback()
    f.playback({ id: 'play-2', state: 'ended' })
    expect(complete).toHaveBeenCalledTimes(1)
  })
  it('does not start a pending playback after the learner stops it', async () => {
    const f = fixture()
    let release = (): void => undefined
    f.native.stopListening.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          release = resolve
        }),
    )
    const pending = f.controller.play('p', 'Hola', 'es-ES')
    await f.controller.stopPlayback()
    release()
    await pending
    expect(f.native.play).not.toHaveBeenCalled()
  })
  it('invalidates old recognition when changing phrase and never accepts a stale transcript', async () => {
    const f = fixture()
    await f.controller.listen('es-ES')
    await f.controller.stopListening()
    await f.controller.listen('ru-RU')
    f.speech({ id: 'speech-1', state: 'final', transcript: 'old phrase', latencyMs: null })
    expect(f.controller.getSnapshot().speech).toBeNull()
    f.speech({ id: 'speech-2', state: 'final', transcript: 'Привет', latencyMs: null })
    expect(f.controller.getSnapshot().speech?.transcript).toBe('Привет')
    expect(f.controller.getSnapshot().speech?.latencyMs).toBeNull()
  })
  it('degrades to unavailable without a native module and never uses browser recognition', async () => {
    const controller = new AudioSpeechController(null)
    expect(await controller.availability('es-ES')).toEqual({ playback: false, recognition: false })
    await controller.listen('es-ES')
    expect(controller.getSnapshot().speech?.state).toBe('unavailable')
    await controller.play('p', 'Hola', 'es-ES')
    expect(controller.getSnapshot().playback).toBe('error')
  })
})
