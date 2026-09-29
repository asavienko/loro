/** Plan 106: the demo instrumental is a real WAV whose line timings match its bars. */
import { describe, expect, it } from 'vitest'
import { synthesizeDemo } from './synth.js'

describe('the demo instrumental', () => {
  it('is 16-bit mono PCM of the length it reports', () => {
    const demo = synthesizeDemo('modern_pop', 6, 'seed')
    const bytes = Buffer.from(demo.wav)
    expect(bytes.toString('ascii', 0, 4)).toBe('RIFF')
    expect(bytes.toString('ascii', 8, 12)).toBe('WAVE')
    expect(bytes.readUInt16LE(22)).toBe(1)
    expect(bytes.readUInt16LE(34)).toBe(16)
    const rate = bytes.readUInt32LE(24)
    const samples = bytes.readUInt32LE(40) / 2
    expect(Math.abs((samples / rate) * 1000 - demo.durationMs)).toBeLessThan(2)
  })

  it('times one line per two bars, in order, inside the track', () => {
    const demo = synthesizeDemo('gentle_ballad', 8, 'seed')
    expect(demo.lines).toHaveLength(8)
    for (const [i, line] of demo.lines.entries()) {
      expect(line.endMs).toBeGreaterThan(line.startMs)
      if (i > 0) expect(line.startMs).toBe(demo.lines[i - 1]?.endMs)
    }
    expect(demo.lines.at(-1)?.endMs).toBeLessThan(demo.durationMs)
  })

  it('is not silent, and is the same for the same seed', () => {
    const a = synthesizeDemo('acoustic_folk', 3, 'x')
    const b = synthesizeDemo('acoustic_folk', 3, 'x')
    expect(Buffer.from(a.wav).equals(Buffer.from(b.wav))).toBe(true)
    const pcm = Buffer.from(a.wav).subarray(44)
    let peak = 0
    for (let i = 0; i < pcm.length; i += 2) peak = Math.max(peak, Math.abs(pcm.readInt16LE(i)))
    expect(peak).toBeGreaterThan(8000)
  })
})
