/** Measure duration from container bytes. Never estimate from character count or text length. */

export function audioDurationMs(bytes: Uint8Array): number | null {
  if (bytes.byteLength < 12) return null
  const wav = wavDurationMs(bytes)
  if (wav !== null) return wav
  return mpegDurationMs(bytes)
}

function byte(bytes: Uint8Array, offset: number): number {
  return bytes[offset] ?? 0
}

function u32(bytes: Uint8Array, offset: number): number {
  return (
    (byte(bytes, offset) |
      (byte(bytes, offset + 1) << 8) |
      (byte(bytes, offset + 2) << 16) |
      (byte(bytes, offset + 3) << 24)) >>>
    0
  )
}

function u16(bytes: Uint8Array, offset: number): number {
  return byte(bytes, offset) | (byte(bytes, offset + 1) << 8)
}

function tag(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(
    byte(bytes, offset),
    byte(bytes, offset + 1),
    byte(bytes, offset + 2),
    byte(bytes, offset + 3),
  )
}

function wavDurationMs(bytes: Uint8Array): number | null {
  if (tag(bytes, 0) !== 'RIFF' || tag(bytes, 8) !== 'WAVE') return null
  let offset = 12
  let sampleRate = 0
  let channels = 0
  let bits = 0
  let dataBytes = 0
  while (offset + 8 <= bytes.byteLength) {
    const id = tag(bytes, offset)
    const size = u32(bytes, offset + 4)
    const start = offset + 8
    if (id === 'fmt ' && start + 16 <= bytes.byteLength) {
      channels = u16(bytes, start + 2)
      sampleRate = u32(bytes, start + 4)
      bits = u16(bytes, start + 14)
    } else if (id === 'data') {
      dataBytes = size
      break
    }
    offset = start + size + (size % 2)
  }
  const bytesPerSec = sampleRate * channels * (bits / 8)
  if (bytesPerSec <= 0 || dataBytes <= 0) return null
  const ms = Math.round((dataBytes / bytesPerSec) * 1000)
  return ms > 0 ? ms : null
}

function mpegDurationMs(bytes: Uint8Array): number | null {
  let offset = 0
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
    if (bytes.byteLength < 10) return null
    const size =
      ((byte(bytes, 6) & 0x7f) << 21) |
      ((byte(bytes, 7) & 0x7f) << 14) |
      ((byte(bytes, 8) & 0x7f) << 7) |
      (byte(bytes, 9) & 0x7f)
    offset = 10 + size
  }
  let frames = 0
  let sampleRate = 0
  let totalSamples = 0
  while (offset + 4 <= bytes.byteLength) {
    if (bytes[offset] !== 0xff || (byte(bytes, offset + 1) & 0xe0) !== 0xe0) {
      offset += 1
      continue
    }
    const version = (byte(bytes, offset + 1) >> 3) & 3
    const layer = (byte(bytes, offset + 1) >> 1) & 3
    const bitrateIndex = byte(bytes, offset + 2) >> 4
    const sampleIndex = (byte(bytes, offset + 2) >> 2) & 3
    const padding = (byte(bytes, offset + 2) >> 1) & 1
    const bitrate = mpegBitrate(version, layer, bitrateIndex)
    sampleRate = mpegSampleRate(version, sampleIndex)
    if (bitrate === 0 || sampleRate === 0) {
      offset += 1
      continue
    }
    const samples = mpegSamplesPerFrame(version, layer)
    const frameSize = Math.floor(((samples / 8) * bitrate) / sampleRate) + padding
    if (frameSize <= 0) {
      offset += 1
      continue
    }
    frames += 1
    totalSamples += samples
    offset += frameSize
  }
  if (frames === 0 || sampleRate === 0 || totalSamples === 0) return null
  const ms = Math.round((totalSamples * 1000) / sampleRate)
  return ms > 0 ? ms : null
}

function mpegBitrate(version: number, layer: number, index: number): number {
  if (index <= 0 || index > 14) return 0
  const v1l3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320]
  if (version === 3 && layer === 1) return (v1l3[index] ?? 0) * 1000
  return 0
}

function mpegSampleRate(version: number, index: number): number {
  if (version === 3) return [44100, 48000, 32000][index] ?? 0
  return 0
}

function mpegSamplesPerFrame(version: number, layer: number): number {
  if (layer === 1 && version === 3) return 1152
  return 1152
}

export function silenceWav(durationMs: number, sampleRate = 24_000): Uint8Array {
  if (!Number.isSafeInteger(durationMs) || durationMs <= 0) {
    throw new Error('duration must be a positive integer')
  }
  const samples = Math.round((sampleRate * durationMs) / 1000)
  const dataBytes = samples * 2
  const bytes = Buffer.alloc(44 + dataBytes)
  bytes.write('RIFF', 0)
  bytes.writeUInt32LE(36 + dataBytes, 4)
  bytes.write('WAVE', 8)
  bytes.write('fmt ', 12)
  bytes.writeUInt32LE(16, 16)
  bytes.writeUInt16LE(1, 20)
  bytes.writeUInt16LE(1, 22)
  bytes.writeUInt32LE(sampleRate, 24)
  bytes.writeUInt32LE(sampleRate * 2, 28)
  bytes.writeUInt16LE(2, 32)
  bytes.writeUInt16LE(16, 34)
  bytes.write('data', 36)
  bytes.writeUInt32LE(dataBytes, 40)
  return bytes
}
