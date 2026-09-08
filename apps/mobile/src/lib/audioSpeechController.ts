/** AS-01/AS-03. Only native metadata crosses this boundary; never audio bytes. */
export interface AudioAvailability {
  playback: boolean
  recognition: boolean
}
export interface PlaybackEvent {
  id: string
  state: 'playing' | 'ended' | 'stopped' | 'error'
  error?: string
}
export interface SpeechEvent {
  id: string
  state: 'listening' | 'partial' | 'final' | 'unavailable' | 'error'
  transcript: string
  /** No validated native onset measurement yet. Never derive this from ASR timing. */
  latencyMs: null
}
export interface PlaybackRequest {
  id: string
  text: string
  locale: string
  rate: number
}
export interface NativeAudioSpeech {
  availability(locale: string): Promise<AudioAvailability>
  play(request: PlaybackRequest): Promise<void>
  stopPlayback(): Promise<void>
  startListening(request: { id: string; locale: string }): Promise<void>
  stopListening(): Promise<void>
  addListener(event: 'playback', callback: (event: PlaybackEvent) => void): { remove(): void }
  addListener(event: 'speech', callback: (event: SpeechEvent) => void): { remove(): void }
}
export interface AudioSnapshot {
  phraseId: string | null
  playback: 'idle' | 'playing' | 'loading' | 'error'
  speech: SpeechEvent | null
}

/** A single native session shared by all routes. Canceled/stale events cannot write progress. */
export class AudioSpeechController {
  private serial = 0
  private playId: string | null = null
  private listenId: string | null = null
  private didPlay: (() => void) | null = null
  private listeners = new Set<() => void>()
  private snapshot: AudioSnapshot = { phraseId: null, playback: 'idle', speech: null }

  constructor(private readonly native: NativeAudioSpeech | null) {
    native?.addListener('playback', (event) => {
      if (event.id !== this.playId) return
      if (event.state === 'playing') {
        this.update({ playback: 'playing' })
        return
      }
      this.playId = null
      const complete = this.didPlay
      this.didPlay = null
      this.update({ playback: event.state === 'error' ? 'error' : 'idle' })
      if (event.state === 'ended') complete?.()
    })
    native?.addListener('speech', (event) => {
      if (event.id !== this.listenId) return
      if (event.state !== 'listening' && event.state !== 'partial') this.listenId = null
      this.update({ speech: event })
    })
  }

  getSnapshot = (): AudioSnapshot => this.snapshot
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
  private update(patch: Partial<AudioSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch }
    this.listeners.forEach((listener) => {
      listener()
    })
  }
  async availability(locale: string): Promise<AudioAvailability> {
    return (
      (await this.native?.availability(locale).catch(() => null)) ?? {
        playback: false,
        recognition: false,
      }
    )
  }
  async play(
    phraseId: string,
    text: string,
    locale: string,
    rate = 0.92,
    onEnded?: () => void,
  ): Promise<void> {
    const id = `play-${++this.serial}`
    this.playId = id
    this.didPlay = onEnded ?? null
    this.update({ phraseId, playback: 'loading' })
    await this.stopListening()
    if (this.playId !== id) return
    try {
      if (this.native === null) throw new Error('native-audio-unavailable')
      await this.native.play({ id, text, locale, rate })
    } catch {
      if (this.playId !== id) return
      this.playId = null
      this.didPlay = null
      this.update({ playback: 'error' })
    }
  }
  async stopPlayback(): Promise<void> {
    this.playId = null
    this.didPlay = null
    this.update({ playback: 'idle' })
    await this.native?.stopPlayback().catch(() => undefined)
  }
  async listen(locale: string): Promise<void> {
    const id = `speech-${++this.serial}`
    this.listenId = id
    this.update({ speech: null })
    await this.stopPlayback()
    if (this.listenId !== id) return
    try {
      if (this.native === null) throw new Error('native-speech-unavailable')
      await this.native.startListening({ id, locale })
    } catch {
      if (this.listenId !== id) return
      this.listenId = null
      this.update({ speech: { id, state: 'unavailable', transcript: '', latencyMs: null } })
    }
  }
  async stopListening(): Promise<void> {
    this.listenId = null
    this.update({ speech: null })
    await this.native?.stopListening().catch(() => undefined)
  }
}
