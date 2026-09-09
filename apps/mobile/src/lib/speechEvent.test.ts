import { describe, expect, it } from 'vitest'
import { toSpeechEvent } from './speechEvent.js'

describe('native speech event boundary', () => {
  it('does not turn an ASR callback timestamp into an onset measurement', () => {
    expect(
      toSpeechEvent({ id: 'speech-1', state: 'final', transcript: 'Hola', latencyMs: 42 }),
    ).toEqual({ id: 'speech-1', state: 'final', transcript: 'Hola', latencyMs: null })
  })

  it('accepts only complete speech lifecycle metadata', () => {
    expect(toSpeechEvent({ id: 'speech-1', state: 'final', transcript: 42 })).toBeNull()
    expect(toSpeechEvent({ id: 'speech-1', state: 'onset', transcript: 'Hola' })).toBeNull()
  })

  it.each([null, undefined, false, 42, 'speech', [], {}, { id: 'speech-1' }])(
    'drops malformed runtime payload %j without throwing',
    (payload) => {
      expect(toSpeechEvent(payload)).toBeNull()
    },
  )

  it.each(['', '   '])('rejects an empty session identity %j', (id) => {
    expect(toSpeechEvent({ id, state: 'final', transcript: 'Hola' })).toBeNull()
  })

  it.each(['listening', 'partial', 'final', 'unavailable', 'error'])(
    'preserves the %s lifecycle with no transcript and discards extra native fields',
    (state) => {
      expect(
        toSpeechEvent({
          id: 'speech-1',
          state,
          transcript: '',
          latencyMs: 250,
          recording: new Uint8Array([1, 2]),
        }),
      ).toEqual({ id: 'speech-1', state, transcript: '', latencyMs: null })
    },
  )
})
