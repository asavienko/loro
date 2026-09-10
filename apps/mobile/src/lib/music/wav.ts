/** Silent fixture WAV so playback duration is measured from real bytes. */
export const FIXTURE_WAV_DURATION_MS = 400
const SAMPLE_RATE = 8_000

export function silentWavBytes(durationMs = FIXTURE_WAV_DURATION_MS): Uint8Array {
  const frames = Math.round((SAMPLE_RATE * durationMs) / 1_000)
  const dataSize = frames * 2
  const bytes = new Uint8Array(44 + dataSize)
  const view = new DataView(bytes.buffer)
  writeAscii(bytes, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeAscii(bytes, 8, 'WAVE')
  writeAscii(bytes, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, SAMPLE_RATE, true)
  view.setUint32(28, SAMPLE_RATE * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeAscii(bytes, 36, 'data')
  view.setUint32(40, dataSize, true)
  return bytes
}

function writeAscii(bytes: Uint8Array, offset: number, text: string): void {
  for (let index = 0; index < text.length; index += 1) {
    bytes[offset + index] = text.charCodeAt(index)
  }
}

export function wavDataUri(bytes: Uint8Array): string {
  return `data:audio/wav;base64,${encodeBase64(bytes)}`
}

function encodeBase64(bytes: Uint8Array): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  let output = ''
  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes[index] ?? 0
    const b = bytes[index + 1] ?? 0
    const c = bytes[index + 2] ?? 0
    const triple = (a << 16) | (b << 8) | c
    output += chars[(triple >> 18) & 63] ?? '='
    output += chars[(triple >> 12) & 63] ?? '='
    output += index + 1 < bytes.length ? (chars[(triple >> 6) & 63] ?? '=') : '='
    output += index + 2 < bytes.length ? (chars[triple & 63] ?? '=') : '='
  }
  return output
}
