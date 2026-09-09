import { describe, expect, it, vi } from 'vitest'
import {
  AudioSpeechController,
  type NativeAudioSpeech,
  type PlaybackEvent,
  type PlaybackRequest,
  type SpeechEvent,
} from './audioSpeechController'
import { clearCatalogAudioFiles, registerCatalogAudioFile } from './catalogAudio'

function fixture() {
  let onPlayback: (event: PlaybackEvent) => void = () => undefined
  let onSpeech: (event: SpeechEvent) => void = () => undefined
  const native = {
    availability: vi.fn(() => Promise.resolve({ playback: true, recognition: true })),
    play: vi.fn((_request: PlaybackRequest) => Promise.resolve()),
    playFile: vi.fn(() => Promise.resolve()),
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
  it('serializes a late stop behind an in-flight native play', async () => {
    const f = fixture()
    let releasePlay = (): void => undefined
    f.native.play.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          releasePlay = resolve
        }),
    )

    const play = f.controller.play('p', 'Hola', 'es-ES')
    await vi.waitFor(() => {
      expect(f.native.play).toHaveBeenCalledOnce()
    })
    const stop = f.controller.stopPlayback()
    expect(f.native.stopPlayback).not.toHaveBeenCalled()

    releasePlay()
    await Promise.all([play, stop])
    await vi.waitFor(() => {
      expect(f.native.stopPlayback).toHaveBeenCalledOnce()
    })
    expect(f.controller.getSnapshot().playback).toBe('idle')
  })
  it.each(['playback', 'recognition'] as const)(
    'does not start cancelled %s after waiting in the native command queue',
    async (kind) => {
      const f = fixture()
      let releaseStop = (): void => undefined
      f.native.stopPlayback.mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            releaseStop = resolve
          }),
      )
      await f.controller.stopPlayback()
      await vi.waitFor(() => {
        expect(f.native.stopPlayback).toHaveBeenCalledOnce()
      })

      const pending =
        kind === 'playback' ? f.controller.play('p', 'Hola', 'es-ES') : f.controller.listen('es-ES')
      // Let the request pass its initial cancellation check and join the queue.
      await Promise.resolve()
      if (kind === 'playback') await f.controller.stopPlayback()
      else await f.controller.stopListening()
      releaseStop()
      await pending

      expect(f.native.play).not.toHaveBeenCalled()
      expect(f.native.startListening).not.toHaveBeenCalled()
      expect(f.controller.getSnapshot().playback).toBe('idle')
      expect(f.controller.getSnapshot().speech).toBeNull()
    },
  )
  it('continues the shared native session after a rejected command', async () => {
    const f = fixture()
    f.native.stopPlayback.mockRejectedValueOnce(new Error('native stop failed'))

    await f.controller.stopPlayback()
    await f.controller.listen('es-ES')

    expect(f.native.startListening).toHaveBeenCalledWith({ id: 'speech-1', locale: 'es-ES' })
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
  it('plays a registered catalog file and omits uri when the file is missing', async () => {
    const f = fixture()
    const sha256 = 'd'.repeat(64)
    registerCatalogAudioFile(sha256, 'file:///tmp/clip.m4a')
    await f.controller.play('p', 'Hola', 'es-ES', 0.92, undefined, {
      uri: `sha256/${sha256}`,
      sha256,
    })
    expect(f.native.play).toHaveBeenCalledWith(
      expect.objectContaining({ uri: 'file:///tmp/clip.m4a', text: 'Hola' }),
    )
    clearCatalogAudioFiles()
    await f.controller.play('p', 'Hola', 'es-ES', 0.92, undefined, {
      uri: `sha256/${sha256}`,
      sha256,
    })
    expect(f.native.play.mock.calls[1]?.[0]).not.toHaveProperty('uri')
  })
  it('plays a cached file URI and refuses network URIs so JS never receives audio bytes', async () => {
    const f = fixture()
    await f.controller.playFile('listen:0', 'file:///cache/clip.m4a')
    expect(f.native.playFile).toHaveBeenCalledWith({
      id: 'play-1',
      fileUri: 'file:///cache/clip.m4a',
    })
    await f.controller.playFile('listen:0', 'https://cdn.loro.test/clip.m4a')
    expect(f.native.playFile).toHaveBeenCalledTimes(1)
    expect(f.controller.getSnapshot().playback).toBe('error')
  })
})
