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
})
