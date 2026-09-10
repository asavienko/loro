/** Deterministic silent WAV used only by stub/fixture music adapters. */
export const FIXTURE_WAV_DURATION_MS = 400
const SAMPLE_RATE = 8_000
const CHANNELS = 1
const BITS = 16

export function silentWavBytes(durationMs = FIXTURE_WAV_DURATION_MS): Uint8Array {
  const frames = Math.round((SAMPLE_RATE * durationMs) / 1_000)
  const dataSize = frames * CHANNELS * (BITS / 8)
  const bytes = new Uint8Array(44 + dataSize)
  const view = new DataView(bytes.buffer)
  writeAscii(bytes, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeAscii(bytes, 8, 'WAVE')
  writeAscii(bytes, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, CHANNELS, true)
  view.setUint32(24, SAMPLE_RATE, true)
  view.setUint32(28, SAMPLE_RATE * CHANNELS * (BITS / 8), true)
  view.setUint16(32, CHANNELS * (BITS / 8), true)
  view.setUint16(34, BITS, true)
  writeAscii(bytes, 36, 'data')
  view.setUint32(40, dataSize, true)
  return bytes
}

function writeAscii(bytes: Uint8Array, offset: number, text: string): void {
  for (let index = 0; index < text.length; index += 1) {
    bytes[offset + index] = text.charCodeAt(index)
  }
}
