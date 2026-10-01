/**
 * The demo instrumental (plan 106): what a song sounds like when no music provider is configured. A
 * small synthesizer plays chords, a bass line, a melody and a beat in the song's style, two bars per
 * lyric line, so the app can show each line as its bars play. It is labelled "Demo sound" wherever
 * it is heard: it has no voice and is never presented as a produced recording.
 */
import { createHash } from 'node:crypto'
import type { MusicStyleId } from '@loro/core'

const RATE = 22_050
const BEATS_PER_BAR = 4
const BARS_PER_LINE = 2
const INTRO_BARS = 2
const OUTRO_BARS = 2

interface Style {
  bpm: number
  /** Scale degrees (0-based, major scale) of each bar's chord root. */
  progression: number[]
  /** Eighth-note hi-hat, or quarter-note brush. */
  hats: 'eighths' | 'quarters' | 'none'
  pad: number
  pluck: number
}

const STYLES: Record<MusicStyleId, Style> = {
  acoustic_folk: { bpm: 96, progression: [0, 4, 5, 3], hats: 'quarters', pad: 0.12, pluck: 0.34 },
  modern_pop: { bpm: 112, progression: [5, 3, 0, 4], hats: 'eighths', pad: 0.16, pluck: 0.3 },
  gentle_ballad: { bpm: 72, progression: [0, 5, 3, 4], hats: 'none', pad: 0.2, pluck: 0.28 },
  upbeat_kids: { bpm: 124, progression: [0, 3, 4, 0], hats: 'eighths', pad: 0.1, pluck: 0.36 },
}

const MAJOR = [0, 2, 4, 5, 7, 9, 11]

export interface LineTiming {
  startMs: number
  endMs: number
}

export interface DemoTrack {
  wav: Uint8Array
  durationMs: number
  lines: LineTiming[]
}

function random(seed: string): () => number {
  let state = createHash('sha256').update(seed).digest().readUInt32LE(4) || 7
  return () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return (state >>> 0) / 4_294_967_296
  }
}

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12)

/** The MIDI note of a scale degree (any integer) above `tonic`. */
function degree(tonic: number, step: number): number {
  const octave = Math.floor(step / 7)
  const index = ((step % 7) + 7) % 7
  return tonic + octave * 12 + (MAJOR[index] ?? 0)
}

/** The synthesizer's sample rate; spoken lines mixed in must be mono 16-bit PCM at this rate. */
export const DEMO_SAMPLE_RATE = RATE

/**
 * The largest demo WAV (header included). Song audio reaches the app through the HTTPS gateway,
 * whose Lambda refuses replies over 6 MB and sends audio base64, a third larger
 * (docs/process/ec2-deployment.md): 4 MiB is about 5.6 MB on the wire. A slow 72 bpm ballad of 15
 * lines would be 5 MB.
 */
export const MAX_DEMO_WAV_BYTES = 4 * 1024 * 1024

/** Samples in a demo of `lines` lyric lines in the style. */
function demoSamples(spec: Style, lines: number): number {
  const bars = INTRO_BARS + lines * BARS_PER_LINE + OUTRO_BARS
  return Math.ceil((bars * BEATS_PER_BAR * (60 / spec.bpm) + 1.5) * RATE)
}

/** How many whole lyric lines a demo in the style sings within MAX_DEMO_WAV_BYTES. */
export function demoLineLimit(style: MusicStyleId): number {
  const spec = STYLES[style]
  let lines = 1
  while (44 + demoSamples(spec, lines + 1) * 2 <= MAX_DEMO_WAV_BYTES) lines++
  return lines
}

/**
 * Plays one lyric line per two bars in the style; the same seed always gives the same track. A line
 * with `voices[i]` (mono 16-bit PCM at DEMO_SAMPLE_RATE) is spoken over its bars, the music ducked
 * under it. It sings at most `demoLineLimit(style)` lines, whole ones: the caller's lyrics stop
 * where `lines` does.
 */
export function synthesizeDemo(
  style: MusicStyleId,
  lineCount: number,
  seed: string,
  voices: readonly (Int16Array | null)[] = [],
): DemoTrack {
  const spec = STYLES[style]
  const rand = random(`${style}:${seed}`)
  const tonic = 55 + Math.floor(rand() * 8) // G3 to D4
  const beat = 60 / spec.bpm
  const sung = Math.min(Math.max(1, lineCount), demoLineLimit(style))
  const bars = INTRO_BARS + sung * BARS_PER_LINE + OUTRO_BARS
  const length = demoSamples(spec, sung)
  const out = new Float32Array(length)

  const add = (start: number, duration: number, voice: (t: number, i: number) => number) => {
    const from = Math.max(0, Math.floor(start * RATE))
    const to = Math.min(length, Math.floor((start + duration) * RATE))
    for (let i = from; i < to; i++) out[i] = (out[i] ?? 0) + voice((i - from) / RATE, i)
  }
  const tone = (freq: number, gain: number, attack: number, decay: number) => (t: number) => {
    const env = Math.min(1, t / attack) * Math.exp(-t / decay)
    return (
      gain *
      env *
      (Math.sin(2 * Math.PI * freq * t) +
        0.3 * Math.sin(4 * Math.PI * freq * t) +
        0.1 * Math.sin(6 * Math.PI * freq * t))
    )
  }

  // A melody motif per line, chosen from the chord's tones and passing notes.
  const motif = () =>
    Array.from({ length: 8 }, (_, i) =>
      i % 2 === 0 ? 2 * Math.floor(rand() * 3) : Math.floor(rand() * 5),
    )
  const motifs = [motif(), motif()]

  for (let bar = 0; bar < bars; bar++) {
    const barStart = bar * BEATS_PER_BAR * beat
    const root = spec.progression[bar % spec.progression.length] ?? 0
    const [third, fifth, bass] = [2, 4, 0].map((step) => degree(tonic, root + step)) as [
      number,
      number,
      number,
    ]
    const chord = [bass, third, fifth]
    const outro = bar >= bars - OUTRO_BARS

    // Pad: the chord, held across the bar.
    for (const note of chord)
      add(barStart, BEATS_PER_BAR * beat + 0.4, tone(hz(note), spec.pad / 3, 0.25, 3))
    // Bass: the root on beats one and three.
    for (const b of [0, 2])
      add(barStart + b * beat, beat * 1.8, tone(hz(bass - 24), 0.28, 0.01, 0.6))

    // Drums.
    if (!outro || bar === bars - OUTRO_BARS) {
      for (const b of [0, 2])
        add(
          barStart + b * beat,
          0.25,
          (t) =>
            0.55 * Math.exp(-t * 18) * Math.sin(2 * Math.PI * (50 + 90 * Math.exp(-t * 30)) * t),
        )
      if (spec.hats !== 'none') {
        const step = spec.hats === 'eighths' ? 0.5 : 1
        for (let b = 0; b < BEATS_PER_BAR; b += step)
          add(barStart + b * beat, 0.06, (t) => 0.06 * Math.exp(-t * 60) * (rand() * 2 - 1))
      }
      if (spec.hats !== 'none')
        for (const b of [1, 3])
          add(barStart + b * beat, 0.18, (t) => 0.14 * Math.exp(-t * 22) * (rand() * 2 - 1))
    }

    // Melody over the lines, eighth notes, resting on the last one of each bar.
    const inLines = bar >= INTRO_BARS && bar < bars - OUTRO_BARS
    if (inLines) {
      const line = Math.floor((bar - INTRO_BARS) / BARS_PER_LINE)
      const notes = motifs[line % 2] ?? []
      for (let e = 0; e < 7; e++) {
        const step = root + (notes[e] ?? 0)
        add(
          barStart + e * beat * 0.5,
          beat * 0.9,
          tone(hz(degree(tonic, step) + 12), spec.pluck / 2, 0.005, 0.35),
        )
      }
    }
  }

  const lines: LineTiming[] = Array.from({ length: sung }, (_, line) => {
    const start = (INTRO_BARS + line * BARS_PER_LINE) * BEATS_PER_BAR * beat
    return {
      startMs: Math.round(start * 1000),
      endMs: Math.round((start + BARS_PER_LINE * BEATS_PER_BAR * beat) * 1000),
    }
  })

  // Spoken lines: each starts half a beat into its bars, no longer than them, the music ducked under it.
  const duck = new Float32Array(length).fill(1)
  const voice = new Float32Array(length)
  for (const [line, pcm] of voices.entries()) {
    const timing = lines[line]
    if (!pcm || !timing) continue
    const from = Math.floor((timing.startMs / 1000 + beat / 2) * RATE)
    const room = Math.floor(((timing.endMs - timing.startMs) / 1000) * RATE)
    const take = Math.min(pcm.length, room, length - from)
    for (let i = 0; i < take; i++) {
      voice[from + i] = (pcm[i] ?? 0) / 32_768
      duck[from + i] = 0.45
    }
  }

  // Master: the music ducked under any voice, the voice on top, a gentle fade in and out, then a
  // soft limiter.
  const fade = RATE * 0.8
  for (let i = 0; i < length; i++) {
    const edge = Math.min(1, i / fade, (length - i) / fade)
    const mixed = (out[i] ?? 0) * (duck[i] ?? 1) + (voice[i] ?? 0) * 1.1
    out[i] = Math.tanh(mixed * 1.2) * 0.85 * edge
  }

  return { wav: wavBytes(out), durationMs: Math.round((length / RATE) * 1000), lines }
}

/** 16-bit mono PCM in a RIFF container. */
function wavBytes(samples: Float32Array): Uint8Array {
  const data = samples.length * 2
  const buffer = Buffer.alloc(44 + data)
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + data, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(RATE, 24)
  buffer.writeUInt32LE(RATE * 2, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(data, 40)
  for (let i = 0; i < samples.length; i++)
    buffer.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i] ?? 0)) * 32_767), 44 + i * 2)
  return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)
}
