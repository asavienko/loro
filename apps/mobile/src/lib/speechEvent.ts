import { latencyFromNativeOnset } from './audioSessionContract'

/** AS-03: Native module payloads are runtime data, never recordings or audio handles. */
export interface SpeechEvent {
  id: string
  state: 'listening' | 'partial' | 'final' | 'unavailable' | 'error'
  transcript: string
  /** A validated native monotonic-clock measurement, or no measurement. */
  latencyMs: number | null
}

/** Runtime payload received from an Expo native module. Treat it as untrusted. */
export interface NativeSpeechEvent {
  id: unknown
  state: unknown
  transcript: unknown
  latencyMs?: unknown
  onset?: unknown
}

const states = new Set<SpeechEvent['state']>([
  'listening',
  'partial',
  'final',
  'unavailable',
  'error',
])

/**
 * Elapsed ASR callback time must never be mistaken for measured speech onset.
 * Only the explicit shared monotonic-clock contract may carry a measurement.
 */
export function toSpeechEvent(payload: unknown): SpeechEvent | null {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return null
  if (!('id' in payload) || !('transcript' in payload) || !('state' in payload)) return null
  if (
    typeof payload.id !== 'string' ||
    payload.id.trim().length === 0 ||
    typeof payload.transcript !== 'string' ||
    typeof payload.state !== 'string' ||
    !states.has(payload.state as SpeechEvent['state'])
  ) {
    return null
  }

  const onset = latencyFromNativeOnset('onset' in payload ? payload.onset : undefined, payload.id)
  return {
    id: payload.id,
    state: payload.state as SpeechEvent['state'],
    transcript: payload.transcript,
    // `latencyMs` alone is an ASR callback time and stays unmeasured. The
    // optional onset object is accepted only after native code implements the
    // same-clock prompt-end/onset contract.
    latencyMs: onset,
  }
}
