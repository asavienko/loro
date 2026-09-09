import { describe, expect, it } from 'vitest'
import {
  acceptsAudioSessionTransition,
  latencyFromNativeOnset,
  type NativeAudioSessionState,
} from './audioSessionContract.js'

const idle: NativeAudioSessionState = { sessionId: 'speech-1', generation: 4, state: 'idle' }

describe('native audio session contract', () => {
  it('allows only ordered state changes for one generation', () => {
    const capture: NativeAudioSessionState = { sessionId: 'speech-1', generation: 4, state: 'capture' }
    expect(acceptsAudioSessionTransition(idle, capture)).toBe(true)
    expect(acceptsAudioSessionTransition(capture, { ...capture, state: 'interrupted' })).toBe(true)
    expect(acceptsAudioSessionTransition(capture, { ...capture, state: 'capture' })).toBe(false)
  })

  it('rejects stale generations and replacement identities without a new generation', () => {
    expect(acceptsAudioSessionTransition(idle, { ...idle, generation: 3, state: 'idle' })).toBe(false)
    expect(acceptsAudioSessionTransition(idle, { ...idle, sessionId: 'speech-2', state: 'idle' })).toBe(false)
    expect(
      acceptsAudioSessionTransition(idle, { sessionId: 'speech-2', generation: 5, state: 'capture' }),
    ).toBe(true)
  })

  it('uses only one native monotonic clock for a measured onset', () => {
    expect(
      latencyFromNativeOnset(
        {
          sessionId: 'speech-1',
          generation: 4,
          clock: 'monotonic-ms',
          promptEndedAtMs: 4_000.125,
          speechOnsetAtMs: 4_923.875,
        },
        'speech-1',
      ),
    ).toBe(923.75)
  })

  it.each([
    { sessionId: 'speech-1', generation: 4, clock: 'wall-ms', promptEndedAtMs: 4, speechOnsetAtMs: 8 },
    { sessionId: 'speech-2', generation: 4, clock: 'monotonic-ms', promptEndedAtMs: 4, speechOnsetAtMs: 8 },
    { sessionId: 'speech-1', generation: 4, clock: 'monotonic-ms', promptEndedAtMs: 8, speechOnsetAtMs: 4 },
    { sessionId: 'speech-1', generation: 4.5, clock: 'monotonic-ms', promptEndedAtMs: 4, speechOnsetAtMs: 8 },
  ])('does not manufacture latency from invalid timing metadata', (measurement) => {
    expect(latencyFromNativeOnset(measurement, 'speech-1')).toBeNull()
  })

  it('keeps silence unmeasured', () => {
    expect(
      latencyFromNativeOnset(
        {
          sessionId: 'speech-1',
          generation: 4,
          clock: 'monotonic-ms',
          promptEndedAtMs: 4,
          speechOnsetAtMs: null,
        },
        'speech-1',
      ),
    ).toBeNull()
  })
})
