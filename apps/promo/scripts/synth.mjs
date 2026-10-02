// The video's sound, all of it made here: a score shaped to the timeline's scenes, the interface's
// effects, and the master mix — the lines and clips placed, the music ducked under them, the whole
// brought to web loudness. Writes public/audio/music.wav, public/audio/sfx/*.wav and public/audio/mix.wav.
// Deterministic: a seeded generator, so the same timeline always sounds the same.
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const AUDIO = join(ROOT, 'public/audio')
const SR = 44100
const tl = JSON.parse(readFileSync(join(ROOT, 'src/generated/timeline.json'), 'utf8'))
const voice = JSON.parse(readFileSync(join(ROOT, 'src/generated/voice.json'), 'utf8'))

// ── basics ────────────────────────────────────────────────────────────────────────────────────────

let seed = 0x10e0
const rand = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0
  return seed / 4294967296
}
const noise = () => rand() * 2 - 1
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12)
const TAU = Math.PI * 2

/** A stereo buffer. */
function stereo(seconds) {
  const n = Math.ceil(seconds * SR)
  return { L: new Float32Array(n), R: new Float32Array(n) }
}
/** Mixes a mono or stereo source into `dst` at `at` seconds, equal-power panned (-1..1). */
function mix(dst, src, at, gain = 1, pan = 0) {
  const o = Math.round(at * SR)
  const l = Math.cos(((pan + 1) * Math.PI) / 4) * Math.SQRT2
  const r = Math.sin(((pan + 1) * Math.PI) / 4) * Math.SQRT2
  const sl = src.L ?? src
  const sr = src.R ?? src
  for (let i = 0; i < sl.length; i++) {
    const j = o + i
    if (j < 0 || j >= dst.L.length) continue
    dst.L[j] += sl[i] * gain * l
    dst.R[j] += sr[i] * gain * r
  }
}
/** One-pole low-pass, in place. */
function lowpass(buf, cutoff) {
  const a = Math.exp((-TAU * cutoff) / SR)
  let y = 0
  for (let i = 0; i < buf.length; i++) buf[i] = y = (1 - a) * buf[i] + a * y
  return buf
}
function highpass(buf, cutoff) {
  const a = Math.exp((-TAU * cutoff) / SR)
  let y = 0
  for (let i = 0; i < buf.length; i++) {
    y = (1 - a) * buf[i] + a * y
    buf[i] -= y
  }
  return buf
}
/** A state-variable band-pass whose centre follows `fc(t)`. */
function bandpass(buf, fc, q = 2) {
  let low = 0
  let band = 0
  for (let i = 0; i < buf.length; i++) {
    const f = 2 * Math.sin((Math.PI * Math.min(fc(i / SR), SR / 6)) / SR)
    const high = buf[i] - low - band / q
    band += f * high
    low += f * band
    buf[i] = band
  }
  return buf
}
function peak(...bufs) {
  let p = 0
  for (const b of bufs) for (let i = 0; i < b.length; i++) p = Math.max(p, Math.abs(b[i]))
  return p || 1
}
function normalize(s, to = 0.89) {
  const g = to / peak(s.L, s.R)
  for (const b of [s.L, s.R]) for (let i = 0; i < b.length; i++) b[i] *= g
  return s
}
/** Freeverb: eight damped combs and four all-passes a side. Returns the wet signal only. */
function reverb(src, { room = 0.84, damp = 0.25, width = 1 } = {}) {
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617]
  const alls = [556, 441, 341, 225]
  const out = { L: new Float32Array(src.L.length), R: new Float32Array(src.L.length) }
  for (const [side, spread] of [
    ['L', 0],
    ['R', 23],
  ]) {
    const input = src[side]
    const acc = out[side]
    for (const len of combs) {
      const d = new Float32Array(len + spread)
      let p = 0
      let store = 0
      for (let i = 0; i < input.length; i++) {
        const y = d[p]
        store = y * (1 - damp) + store * damp
        d[p] = input[i] * 0.015 + store * room
        acc[i] += y
        p = (p + 1) % d.length
      }
    }
    for (const len of alls) {
      const d = new Float32Array(len + spread)
      let p = 0
      for (let i = 0; i < acc.length; i++) {
        const b = d[p]
        d[p] = acc[i] + b * 0.5
        acc[i] = b - acc[i]
        p = (p + 1) % d.length
      }
    }
  }
  if (width < 1) {
    for (let i = 0; i < out.L.length; i++) {
      const m = (out.L[i] + out.R[i]) / 2
      out.L[i] = m + (out.L[i] - m) * width
      out.R[i] = m + (out.R[i] - m) * width
    }
  }
  return out
}
/** A ping-pong delay's wet signal. */
function pingpong(src, time, feedback = 0.38, tone = 3500) {
  const d = Math.round(time * SR)
  const out = { L: new Float32Array(src.L.length), R: new Float32Array(src.L.length) }
  const a = Math.exp((-TAU * tone) / SR)
  let yl = 0
  let yr = 0
  for (let i = 0; i < src.L.length; i++) {
    const inL = i >= d ? src.L[i - d] + src.R[i - d] : 0
    const fbL = i >= d ? out.R[i - d] * feedback : 0
    const fbR = i >= d ? out.L[i - d] * feedback : 0
    yl = (1 - a) * (inL * 0.5 + fbL) + a * yl
    yr = (1 - a) * fbR + a * yr
    out.L[i] = yl
    out.R[i] = yr
  }
  return out
}
function writeWav(file, s) {
  const n = s.L.length
  const buf = Buffer.alloc(44 + n * 4)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + n * 4, 4)
  buf.write('WAVEfmt ', 8)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20)
  buf.writeUInt16LE(2, 22)
  buf.writeUInt32LE(SR, 24)
  buf.writeUInt32LE(SR * 4, 28)
  buf.writeUInt16LE(4, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36)
  buf.writeUInt32LE(n * 4, 40)
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s.L[i])) * 32767), 44 + i * 4)
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s.R[i])) * 32767), 46 + i * 4)
  }
  writeFileSync(file, buf)
}
/** Decodes any audio file to stereo at SR through ffmpeg. */
function decode(file) {
  const raw = execFileSync(
    'ffmpeg',
    ['-v', 'error', '-i', file, '-f', 'f32le', '-ac', '2', '-ar', String(SR), '-'],
    { maxBuffer: 1 << 30 },
  )
  const f = new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4)
  const n = f.length / 2
  const s = { L: new Float32Array(n), R: new Float32Array(n) }
  for (let i = 0; i < n; i++) {
    s.L[i] = f[i * 2]
    s.R[i] = f[i * 2 + 1]
  }
  return s
}

// ── instruments ───────────────────────────────────────────────────────────────────────────────────

/** A band-limited saw (polyBLEP). */
function saw(freq, seconds, phase0 = rand()) {
  const n = Math.ceil(seconds * SR)
  const out = new Float32Array(n)
  const dt = freq / SR
  let ph = phase0
  for (let i = 0; i < n; i++) {
    let v = 2 * ph - 1
    if (ph < dt) {
      const t = ph / dt
      v -= t + t - t * t - 1
    } else if (ph > 1 - dt) {
      const t = (ph - 1) / dt
      v -= t * t + t + t + 1
    }
    out[i] = v
    ph += dt
    if (ph >= 1) ph -= 1
  }
  return out
}
/** A warm pad note: three detuned saws, filtered, with a slow swell and release. */
function padNote(midi, seconds, { attack = 0.9, release = 1.6, cutoff = 1100 } = {}) {
  const total = seconds + release
  const out = {
    L: new Float32Array(Math.ceil(total * SR)),
    R: new Float32Array(Math.ceil(total * SR)),
  }
  ;[-8, 0, 8].forEach((cents, k) => {
    const s = saw(hz(midi) * 2 ** (cents / 1200), total)
    lowpass(lowpass(s, cutoff), cutoff * 1.4)
    const pan = (k - 1) * 0.6
    mix(out, s, 0, 0.33, pan)
  })
  for (const b of [out.L, out.R])
    for (let i = 0; i < b.length; i++) {
      const t = i / SR
      const env =
        t < attack
          ? Math.sin(((t / attack) * Math.PI) / 2)
          : t < seconds
            ? 1
            : Math.max(0, 1 - (t - seconds) / release) ** 2
      b[i] *= env
    }
  return out
}
/** A plucked string (Karplus–Strong). */
function pluck(midi, seconds = 1.6, bright = 0.5) {
  const n = Math.ceil(seconds * SR)
  const out = new Float32Array(n)
  const period = SR / hz(midi)
  const len = Math.floor(period)
  const frac = period - len
  const line = new Float32Array(len + 2)
  for (let i = 0; i < line.length; i++) line[i] = noise()
  lowpass(line, 1500 + bright * 5000)
  let p = 0
  for (let i = 0; i < n; i++) {
    const a = line[p % line.length]
    const b = line[(p + 1) % line.length]
    const y = a * (1 - frac) + b * frac
    out[i] = y
    line[p % line.length] = 0.996 * (0.5 * (a + b))
    p++
  }
  // A soft attack takes the click off.
  for (let i = 0; i < 64 && i < n; i++) out[i] *= i / 64
  return out
}
/** A bell (two-operator FM). */
function bell(midi, seconds = 2.5, index = 2.2) {
  const n = Math.ceil(seconds * SR)
  const out = new Float32Array(n)
  const f = hz(midi)
  for (let i = 0; i < n; i++) {
    const t = i / SR
    const env = Math.exp(-t * 2.4)
    const mod = Math.sin(TAU * f * 3.5 * t) * index * Math.exp(-t * 4)
    out[i] = Math.sin(TAU * f * t + mod) * env * Math.min(1, t * 400)
  }
  return out
}
function bass(midi, seconds) {
  const n = Math.ceil((seconds + 0.25) * SR)
  const out = new Float32Array(n)
  const f = hz(midi)
  for (let i = 0; i < n; i++) {
    const t = i / SR
    const env =
      Math.min(1, t * 120) *
      (t < seconds
        ? Math.exp(-t * 0.6)
        : Math.exp(-seconds * 0.6) * Math.max(0, 1 - (t - seconds) / 0.25))
    const x = Math.sin(TAU * f * t) + 0.25 * Math.sin(TAU * 2 * f * t)
    out[i] = Math.tanh(x * 1.4) * env
  }
  return out
}
function kick() {
  const n = Math.ceil(0.45 * SR)
  const out = new Float32Array(n)
  let ph = 0
  for (let i = 0; i < n; i++) {
    const t = i / SR
    const f = 45 + 85 * Math.exp(-t * 30)
    ph += (TAU * f) / SR
    out[i] = Math.sin(ph) * Math.exp(-t * 7) + noise() * Math.exp(-t * 300) * 0.15
  }
  return out
}
function rim() {
  const n = Math.ceil(0.18 * SR)
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const t = i / SR
    out[i] = noise() * Math.exp(-t * 35) * 0.7 + Math.sin(TAU * 330 * t) * Math.exp(-t * 40) * 0.5
  }
  return bandpass(out, () => 1800, 1.4)
}
function hat(open = false) {
  const n = Math.ceil((open ? 0.25 : 0.06) * SR)
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) out[i] = noise() * Math.exp((-i / SR) * (open ? 14 : 70))
  return highpass(highpass(out, 7000), 7000)
}

// ── the score ─────────────────────────────────────────────────────────────────────────────────────

const BPM = 96
const BEAT = 60 / BPM
const BAR = BEAT * 4
const LENGTH = tl.duration + 0.5
const bars = Math.ceil(LENGTH / BAR)

// Fmaj9 – Am7 – Dm9 – B♭maj9: pad voicing, arpeggio tones, bass root.
const CHORDS = [
  { pad: [57, 60, 64, 67], arp: [65, 69, 72, 76, 79], root: 41 },
  { pad: [55, 60, 64, 69], arp: [64, 67, 69, 72, 76], root: 45 },
  { pad: [53, 57, 60, 64], arp: [62, 65, 69, 72, 74], root: 38 },
  { pad: [53, 57, 60, 62], arp: [62, 65, 69, 70, 74], root: 46 },
]
const ARP = [0, 2, 1, 3, 2, 4, 3, 1]

/** Which parts play in a bar: from the scene the bar starts in. */
const sceneAt = (t) =>
  Object.entries(tl.scenes).find(
    ([, s]) => t >= s.from - BEAT && t < s.from + s.duration - BEAT,
  )?.[0] ?? 'outro'
const PARTS = {
  intro: { pad: 1, arp: 0.5, bass: 0, drums: 0, hats: 0, sparkle: 0 },
  loop: { pad: 1, arp: 0.7, bass: 0.8, drums: 0, hats: 0.5, sparkle: 0 },
  handsfree: { pad: 1, arp: 1, bass: 1, drums: 1, hats: 1, sparkle: 0 },
  languages: { pad: 1, arp: 0.8, bass: 1, drums: 0.7, hats: 0.8, sparkle: 0 },
  create: { pad: 1, arp: 1, bass: 1, drums: 1, hats: 1, sparkle: 1 },
  privacy: { pad: 1.1, arp: 0.35, bass: 0.7, drums: 0, hats: 0, sparkle: 0 },
  outro: { pad: 1, arp: 0.8, bass: 0.8, drums: 0.6, hats: 0.5, sparkle: 0.5 },
}

const pads = stereo(LENGTH + 3)
const plucks = stereo(LENGTH + 3)
const low = stereo(LENGTH + 3)
const drums = stereo(LENGTH + 3)
const K = kick()
const RIM = rim()
const finalAt = Math.ceil(tl.marks.final / BAR) * BAR - BAR // the bar the last line ends in

for (let b = 0; b < bars; b++) {
  const t0 = b * BAR
  if (t0 > LENGTH) break
  const last = t0 >= finalAt
  const chord = last ? CHORDS[0] : CHORDS[b % 4]
  const part = PARTS[sceneAt(t0 + 0.01)]
  // In the intro the arpeggio comes in only after the first two bars.
  const arpOn = part.arp * (b < 2 ? 0 : 1)

  // The last chord holds to the end.
  const hold = last ? LENGTH - t0 : BAR
  const cutoff = sceneAt(t0) === 'privacy' ? 700 : 1100
  if (!last || t0 === finalAt)
    for (const m of chord.pad)
      mix(pads, padNote(m, hold, { cutoff, release: last ? 2.5 : 1.6 }), t0, 0.11 * part.pad)

  if (part.bass && !last) {
    mix(low, bass(chord.root, BEAT * 1.5), t0, 0.18 * part.bass)
    mix(low, bass(chord.root, BEAT * 0.9), t0 + BEAT * 2.5, 0.12 * part.bass)
  } else if (part.bass && t0 === finalAt) mix(low, bass(chord.root, hold * 0.6), t0, 0.18)

  if (arpOn && !last)
    for (let k = 0; k < 8; k++) {
      const swing = k % 2 ? BEAT * 0.06 : 0
      const tone = chord.arp[ARP[k]]
      mix(
        plucks,
        pluck(tone, 1.4, 0.35 + rand() * 0.3),
        t0 + k * (BEAT / 2) + swing,
        (0.16 + rand() * 0.05) * arpOn,
        k % 2 ? 0.35 : -0.35,
      )
    }
  if (part.sparkle && !last && b % 2 === 1)
    for (const k of [0, 3, 6])
      mix(
        plucks,
        bell(chord.arp[(k + b) % 5] + 12, 1.5, 1.4),
        t0 + k * (BEAT / 2),
        0.05 * part.sparkle,
        k ? 0.5 : -0.5,
      )

  if (part.drums && !last) {
    for (const k of [0, 2.5]) mix(drums, K, t0 + k * BEAT, 0.38 * part.drums)
    for (const k of [1, 3]) mix(drums, RIM, t0 + k * BEAT, 0.16 * part.drums, 0.15)
  }
  if (part.hats && !last)
    for (let k = 0; k < 8; k++) {
      const swing = k % 2 ? BEAT * 0.08 : 0
      mix(
        drums,
        hat(k === 7 && b % 2 === 1),
        t0 + k * (BEAT / 2) + swing,
        (k % 2 ? 0.05 : 0.08) * part.hats,
        0.3,
      )
    }
}
// A bell on the logo and on the last chord.
mix(plucks, bell(77, 3.5, 1.6), 0.5, 0.12, -0.2)
mix(plucks, bell(72, 3.5, 1.6), 0.5, 0.08, 0.2)
mix(plucks, bell(77, 4, 1.4), finalAt, 0.12, -0.2)
mix(plucks, bell(81, 4, 1.4), finalAt + BEAT / 2, 0.09, 0.2)
mix(plucks, bell(84, 4, 1.4), finalAt + BEAT, 0.07, 0)

const music = stereo(LENGTH)
mix(music, pads, 0, 1)
mix(music, plucks, 0, 1)
mix(music, pingpong(plucks, BEAT * 0.75, 0.35), 0, 0.35)
mix(music, low, 0, 1)
mix(music, drums, 0, 1)
const send = stereo(LENGTH)
mix(send, pads, 0, 0.6)
mix(send, plucks, 0, 1)
mix(send, drums, 0, 0.25)
mix(music, reverb(send, { room: 0.86, damp: 0.3 }), 0, 0.9)
// Nothing under 40 Hz: it only muddies small speakers.
for (const b of [music.L, music.R]) highpass(highpass(b, 40), 40)
// Fade in over the first half second; out over the last three.
for (const b of [music.L, music.R])
  for (let i = 0; i < b.length; i++) {
    const t = i / SR
    b[i] = Math.tanh(b[i] * 1.2) * Math.min(1, t / 0.5) * Math.min(1, Math.max(0, (LENGTH - t) / 3))
  }
normalize(music, 0.89)

// ── effects ───────────────────────────────────────────────────────────────────────────────────────

function env(n, f) {
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) out[i] = f(i / SR, i)
  return out
}
const FX = {
  whoosh() {
    const d = 0.75
    const n = Math.ceil(d * SR)
    const s = env(n, () => noise())
    bandpass(s, (t) => 300 + 2600 * Math.sin((Math.PI * t) / d) ** 2, 1.3)
    const out = stereo(d)
    for (let i = 0; i < n; i++) {
      const t = i / SR
      const a = Math.sin((Math.PI * t) / d) ** 2
      const p = t / d
      out.L[i] = s[i] * a * (1 - p)
      out.R[i] = s[i] * a * p
    }
    return out
  },
  pop() {
    let ph = 0
    return env(Math.ceil(0.14 * SR), (t) => {
      ph += (TAU * (380 + 520 * Math.exp(-t * 60))) / SR
      return Math.sin(ph) * Math.exp(-t * 32)
    })
  },
  chime() {
    const out = stereo(3)
    mix(out, bell(84, 3, 1.8), 0, 0.6, -0.3)
    mix(out, bell(89, 3, 1.5), 0.07, 0.45, 0.3)
    mix(out, reverb(out), 0, 0.8)
    return out
  },
  tick() {
    return env(
      Math.ceil(0.06 * SR),
      (t) => (Math.sin(TAU * 1900 * t) * 0.7 + noise() * 0.3) * Math.exp(-t * 110),
    )
  },
  tap() {
    const s = env(
      Math.ceil(0.09 * SR),
      (t) => Math.sin(TAU * 240 * t) * Math.exp(-t * 60) + noise() * Math.exp(-t * 400) * 0.5,
    )
    return lowpass(s, 3000)
  },
  success() {
    const out = stereo(2.5)
    mix(out, bell(84, 2, 1.2), 0, 0.5, -0.2)
    mix(out, bell(91, 2, 1.2), 0.11, 0.45, 0.2)
    mix(out, reverb(out), 0, 0.6)
    return out
  },
  reveal() {
    const d = 0.8
    let ph = 0
    const s = env(Math.ceil(d * SR), (t) => {
      ph += (TAU * (600 + 1400 * (t / d) ** 2)) / SR
      return (Math.sin(ph) * 0.4 + noise() * 0.15) * Math.sin((Math.PI * t) / d) ** 2
    })
    const out = stereo(d + 1)
    mix(out, lowpass(s, 4000), 0, 1)
    mix(out, reverb(out), 0, 1)
    return out
  },
  flip() {
    const s = env(
      Math.ceil(0.12 * SR),
      (t) => noise() * (Math.exp(-t * 90) + 0.6 * Math.exp(-Math.abs(t - 0.05) * 160)),
    )
    return bandpass(s, () => 2400, 1.1)
  },
  type() {
    const pitch = 2600 + rand() * 1400
    const s = env(Math.ceil(0.04 * SR), (t) => noise() * Math.exp(-t * 180))
    return bandpass(s, () => pitch, 2)
  },
  shimmer() {
    const out = stereo(3)
    const scale = [72, 74, 77, 79, 81, 84, 86, 89, 91, 93]
    for (let k = 0; k < 18; k++) {
      const at = k * 0.06 + rand() * 0.03
      mix(
        out,
        bell(scale[Math.floor(rand() * scale.length)], 0.8, 0.8),
        at,
        0.2 * (1 - k / 24),
        noise() * 0.8,
      )
    }
    mix(out, reverb(out), 0, 1.1)
    return out
  },
  swell() {
    const d = 1.6
    const s = env(Math.ceil(d * SR), (t) => noise() * (t / d) ** 2.5)
    bandpass(s, (t) => 500 + 5000 * (t / d) ** 2, 1.6)
    const out = stereo(d + 0.5)
    mix(out, s, 0, 1)
    for (const m of [65, 72])
      mix(out, padNote(m, d, { attack: d, release: 0.4, cutoff: 1800 }), 0, 0.5)
    return out
  },
  lock() {
    return env(
      Math.ceil(0.3 * SR),
      (t) =>
        Math.sin(TAU * 130 * t) * Math.exp(-t * 22) +
        Math.sin(TAU * 520 * t) * Math.exp(-t * 70) * 0.4 +
        noise() * Math.exp(-t * 500) * 0.4,
    )
  },
}

mkdirSync(join(AUDIO, 'sfx'), { recursive: true })
const effects = {}
for (const [name, make] of Object.entries(FX)) {
  const s = make()
  effects[name] = normalize(s.L ? s : { L: s, R: Float32Array.from(s) }, 0.8)
  writeWav(join(AUDIO, 'sfx', `${name}.wav`), effects[name])
}
writeWav(join(AUDIO, 'music.wav'), music)

// ── the master ────────────────────────────────────────────────────────────────────────────────────

const master = stereo(LENGTH)
const voices = stereo(LENGTH)
for (const p of tl.plays)
  mix(
    voices,
    decode(join(ROOT, 'public', voice[p.id].file)),
    p.at,
    voice[p.id].kind === 'clip' ? 1.05 : 1,
  )

// Duck the music under every line and clip: down 10 dB, a quarter second in and out.
const duck = new Float32Array(master.L.length).fill(1)
const DUCK = 10 ** (-10 / 20)
for (const p of tl.plays) {
  const a = Math.round((p.at - 0.2) * SR)
  const b = Math.round((p.at + p.duration + 0.1) * SR)
  const ramp = Math.round(0.25 * SR)
  for (let i = a - ramp; i < b + ramp && i < duck.length; i++) {
    if (i < 0) continue
    const g =
      i < a
        ? 1 - ((i - (a - ramp)) / ramp) * (1 - DUCK)
        : i > b
          ? DUCK + ((i - b) / ramp) * (1 - DUCK)
          : DUCK
    duck[i] = Math.min(duck[i], g)
  }
}
const MUSIC_GAIN = 10 ** (-9 / 20)
for (let i = 0; i < master.L.length; i++) {
  master.L[i] = music.L[i] * MUSIC_GAIN * duck[i] + voices.L[i]
  master.R[i] = music.R[i] * MUSIC_GAIN * duck[i] + voices.R[i]
}
for (const e of tl.sfx) mix(master, effects[e.id], e.at, 0.22 * e.gain)

const raw = join(AUDIO, 'mix.raw.wav')
writeWav(raw, normalize(master, 0.95))
// Web loudness: −16 LUFS integrated, peaks under −1.5 dBTP.
execFileSync('ffmpeg', [
  '-y',
  '-v',
  'error',
  '-i',
  raw,
  '-af',
  'loudnorm=I=-16:TP=-1.5:LRA=11',
  '-ar',
  String(SR),
  join(AUDIO, 'mix.tmp.wav'),
])
renameSync(join(AUDIO, 'mix.tmp.wav'), join(AUDIO, 'mix.wav'))
execFileSync('rm', [raw])
console.log(
  `Music ${LENGTH.toFixed(1)}s (${bars} bars at ${BPM} BPM), ${Object.keys(FX).length} effects, mix at −16 LUFS → public/audio/mix.wav`,
)
