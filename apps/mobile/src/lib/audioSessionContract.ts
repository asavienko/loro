/**
 * The numeric part of a native audio session boundary. This metadata is safe to
 * cross the bridge: it identifies one native session and its monotonic-clock
 * timestamps. It deliberately has no recording, waveform, file, or buffer
 * field.
 */
export interface NativeOnsetMeasurement {
  readonly sessionId: string
  readonly generation: number
  readonly clock: 'monotonic-ms'
  readonly promptEndedAtMs: number
  readonly speechOnsetAtMs: number | null
}

export type AudioSessionState = 'idle' | 'playback' | 'capture' | 'interrupted'

export interface NativeAudioSessionState {
  readonly sessionId: string
  readonly generation: number
  readonly state: AudioSessionState
}

const stateTransitions: Readonly<Record<AudioSessionState, readonly AudioSessionState[]>> = {
  idle: ['playback', 'capture'],
  playback: ['idle', 'capture', 'interrupted'],
  capture: ['idle', 'playback', 'interrupted'],
  interrupted: ['idle', 'playback', 'capture'],
}

type NativeMetadata = Record<string, unknown>

function sessionIdentity(
  value: unknown,
): value is NativeMetadata & Pick<NativeAudioSessionState, 'sessionId' | 'generation'> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const metadata = value as NativeMetadata
  return (
    typeof metadata.sessionId === 'string' &&
    metadata.sessionId.trim().length > 0 &&
    typeof metadata.generation === 'number' &&
    Number.isSafeInteger(metadata.generation) &&
    metadata.generation >= 0
  )
}

/** Reject malformed or backwards native state; a stale generation cannot take over a session. */
export function acceptsAudioSessionTransition(
  previous: NativeAudioSessionState | null,
  next: unknown,
): next is NativeAudioSessionState {
  if (
    !sessionIdentity(next) ||
    typeof next.state !== 'string' ||
    !(next.state in stateTransitions)
  ) {
    return false
  }
  if (previous === null)
    return next.state === 'idle' || next.state === 'playback' || next.state === 'capture'
  if (next.generation < previous.generation) return false
  if (next.generation > previous.generation)
    return next.state === 'idle' || next.state === 'playback' || next.state === 'capture'
  if (next.sessionId !== previous.sessionId) return false
  return stateTransitions[previous.state].includes(next.state as AudioSessionState)
}

/**
 * Computes latency only from two timestamps that the same native session took
 * on its monotonic clock. It does not turn an ASR callback timestamp into an
 * onset, and silence remains unmeasured.
 */
export function latencyFromNativeOnset(value: unknown, sessionId: string): number | null {
  if (!sessionIdentity(value) || value.sessionId !== sessionId || value.clock !== 'monotonic-ms') {
    return null
  }
  if (
    typeof value.promptEndedAtMs !== 'number' ||
    !Number.isFinite(value.promptEndedAtMs) ||
    value.promptEndedAtMs < 0 ||
    (value.speechOnsetAtMs !== null &&
      (typeof value.speechOnsetAtMs !== 'number' ||
        !Number.isFinite(value.speechOnsetAtMs) ||
        value.speechOnsetAtMs < value.promptEndedAtMs))
  ) {
    return null
  }
  return value.speechOnsetAtMs === null ? null : value.speechOnsetAtMs - value.promptEndedAtMs
}
