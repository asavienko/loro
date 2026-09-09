import { toSpeechEvent, type NativeSpeechEvent, type SpeechEvent } from './speechEvent'

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
export type { SpeechEvent } from './speechEvent'
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
  addListener(event: 'speech', callback: (event: NativeSpeechEvent) => void): { remove(): void }
}
export interface AudioSnapshot {
  phraseId: string | null
  playback: 'idle' | 'playing' | 'loading' | 'error'
  speech: SpeechEvent | null
}

/** A single native session shared by all routes. Canceled/stale events cannot write progress. */
export class AudioSpeechController {
  private serial = 0
  /**
   * Native playback and recognition share one audio session. Keep commands in
   * issue order so a late stop cannot run before an in-flight native play.
   * State still changes synchronously below, which makes cancelled work stale
   * before its queued native command gets a chance to run.
   */
  private nativeTail: Promise<void> = Promise.resolve()
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
    native?.addListener('speech', (payload) => {
      const event = toSpeechEvent(payload)
      if (event === null) return
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
  private runNative(command: () => Promise<void>): Promise<void> {
    const run = (): Promise<void> => command()
    const result = this.nativeTail.then(run, run)
    // Keep later commands usable after a platform rejection. Each caller
    // handles the rejection for its own state transition.
    this.nativeTail = result.then(
      () => undefined,
      () => undefined,
    )
    return result
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
      const native = this.native
      if (native === null) throw new Error('native-audio-unavailable')
      await this.runNative(() => {
        // A stop or replacement can arrive while an earlier native command
        // holds the queue. Recheck ownership at execution, not only enqueue.
        if (this.playId !== id) return Promise.resolve()
        return native.play({ id, text, locale, rate })
      })
    } catch {
      if (this.playId !== id) return
      this.playId = null
      this.didPlay = null
      this.update({ playback: 'error' })
    }
  }
  stopPlayback(): Promise<void> {
    this.playId = null
    this.didPlay = null
    this.update({ playback: 'idle' })
    // Cancellation is visible immediately. Its native command remains ordered
    // behind any pending command, but a route must never wait for a permission
    // dialog or stalled recognizer before it can leave playback state.
    void this.runNative(() => this.native?.stopPlayback() ?? Promise.resolve()).catch(
      () => undefined,
    )
    return Promise.resolve()
  }
  async listen(locale: string): Promise<void> {
    const id = `speech-${++this.serial}`
    this.listenId = id
    this.update({ speech: null })
    await this.stopPlayback()
    if (this.listenId !== id) return
    try {
      const native = this.native
      if (native === null) throw new Error('native-speech-unavailable')
      await this.runNative(() => {
        if (this.listenId !== id) return Promise.resolve()
        return native.startListening({ id, locale })
      })
    } catch {
      if (this.listenId !== id) return
      this.listenId = null
      this.update({ speech: { id, state: 'unavailable', transcript: '', latencyMs: null } })
    }
  }
  stopListening(): Promise<void> {
    this.listenId = null
    this.update({ speech: null })
    void this.runNative(() => this.native?.stopListening() ?? Promise.resolve()).catch(
      () => undefined,
    )
    return Promise.resolve()
  }
}
