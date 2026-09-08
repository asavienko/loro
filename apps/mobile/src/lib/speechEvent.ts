/** AS-03: Native module payloads are runtime data, never recordings or audio handles. */
export interface SpeechEvent {
  id: string
  state: 'listening' | 'partial' | 'final' | 'unavailable' | 'error'
  transcript: string
  /**
   * No validated prompt-end/onset clock crosses the native boundary yet.
   * Native recognizer callbacks are not a VAD measurement.
   */
  latencyMs: null
}

/** Runtime payload received from an Expo native module. Treat it as untrusted. */
export interface NativeSpeechEvent {
  id: unknown
  state: unknown
  transcript: unknown
  latencyMs?: unknown
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
 * A real latency protocol must replace this adapter with validated provenance
 * and a shared monotonic-clock contract.
 */
export function toSpeechEvent(payload: NativeSpeechEvent): SpeechEvent | null {
  if (
    typeof payload.id !== 'string' ||
    typeof payload.transcript !== 'string' ||
    typeof payload.state !== 'string' ||
    !states.has(payload.state as SpeechEvent['state'])
  ) {
    return null
  }

  return {
    id: payload.id,
    state: payload.state as SpeechEvent['state'],
    transcript: payload.transcript,
    // Intentionally discard a runtime number until onset is actually measured.
    latencyMs: null,
  }
}
