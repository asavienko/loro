// Renders the narrator's lines and the phrase clips to public/voice/*.mp3, with each word's timing
// for the captions, into src/generated/voice.json. ElevenLabs when a key is set (ELEVENLABS_API_KEY,
// or the API's own TTS_API_KEY in apps/api/.env); otherwise macOS `say`, with timings spread by length.
// A line is rendered again only when its text, voice or model changes, so a re-run costs nothing.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CLIPS, LINES, NARRATOR } from './lines.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'public/voice')
const MANIFEST = join(ROOT, 'src/generated/voice.json')
const MODEL = 'eleven_multilingual_v2'
const NARRATOR_SETTINGS = {
  stability: 0.5,
  similarity_boost: 0.8,
  style: 0.15,
  use_speaker_boost: true,
  speed: 0.98,
}
const CLIP_SETTINGS = { stability: 0.6, similarity_boost: 0.8, style: 0, use_speaker_boost: true }

/** The API's environment file, read for its keys and voices only; never printed. */
function apiEnv() {
  const file = join(ROOT, '../api/.env')
  if (!existsSync(file)) return {}
  return Object.fromEntries(
    readFileSync(file, 'utf8')
      .split('\n')
      .map((line) => line.match(/^([A-Z0-9_]+)=(.*)$/))
      .filter(Boolean)
      .map(([, k, v]) => [k, v.replace(/^['"]|['"]$/g, '')]),
  )
}

const env = { ...apiEnv(), ...process.env }
const key =
  env.ELEVENLABS_API_KEY || (env.TTS_PROVIDER === 'elevenlabs' ? env.TTS_API_KEY : undefined)

async function eleven(voiceId, text, settings) {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps?output_format=mp3_44100_192`,
    {
      method: 'POST',
      headers: { 'xi-api-key': key, 'content-type': 'application/json' },
      body: JSON.stringify({ text, model_id: MODEL, voice_settings: settings }),
    },
  )
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const body = await res.json()
  const a = body.alignment
  return {
    audio: Buffer.from(body.audio_base64, 'base64'),
    chars: a.characters.map((ch, i) => ({
      ch,
      start: a.character_start_times_seconds[i],
      end: a.character_end_times_seconds[i],
    })),
  }
}

const SAY_VOICES = {
  TTS_VOICE_EN_GB: 'Daniel',
  TTS_VOICE_ES_ES: 'Mónica',
  TTS_VOICE_BG_BG: 'Daria',
  TTS_VOICE_RU_RU: 'Milena',
}

function say(voice, text, mp3) {
  const aiff = mp3.replace(/\.mp3$/, '.aiff')
  execFileSync('say', ['-v', voice, '-r', '175', '-o', aiff, text])
  execFileSync('ffmpeg', [
    '-y',
    '-loglevel',
    'error',
    '-i',
    aiff,
    '-ar',
    '44100',
    '-b:a',
    '192k',
    mp3,
  ])
  rmSync(aiff)
  return { audio: readFileSync(mp3), chars: null }
}

function duration(file) {
  return Number(
    execFileSync('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'csv=p=0',
      file,
    ])
      .toString()
      .trim(),
  )
}

/** Words with their times: from the characters' alignment, or spread over the clip by length. */
function words(text, chars, total) {
  if (chars) {
    const out = []
    let cur = null
    for (const c of chars) {
      if (/\s/.test(c.ch)) {
        if (cur) out.push(cur)
        cur = null
      } else if (!cur) cur = { text: c.ch, start: c.start, end: c.end }
      else {
        cur.text += c.ch
        cur.end = c.end
      }
    }
    if (cur) out.push(cur)
    return out
  }
  const parts = text.split(/\s+/)
  const lengths = parts.map((p) => p.length + 1)
  const sum = lengths.reduce((a, b) => a + b, 0)
  let t = 0.05
  return parts.map((p, i) => {
    const span = ((total - 0.15) * lengths[i]) / sum
    const w = { text: p, start: t, end: t + span }
    t += span
    return w
  })
}

mkdirSync(OUT, { recursive: true })
mkdirSync(dirname(MANIFEST), { recursive: true })
const previous = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {}
const manifest = {}
const jobs = [
  ...LINES.map((l) => ({
    ...l,
    kind: 'line',
    voiceId: NARRATOR,
    sayVoice: 'Daniel',
    settings: NARRATOR_SETTINGS,
  })),
  ...CLIPS.map((c) => ({
    ...c,
    kind: 'clip',
    voiceId: env[c.voice],
    sayVoice: SAY_VOICES[c.voice],
    settings: CLIP_SETTINGS,
  })),
]

console.log(key ? 'Voices: ElevenLabs' : 'Voices: macOS say (no ElevenLabs key found)')
for (const job of jobs) {
  const engine =
    key && job.voiceId
      ? `eleven:${job.voiceId}:${MODEL}:${JSON.stringify(job.settings)}`
      : `say:${job.sayVoice}`
  const hash = createHash('sha256').update(`${engine}\n${job.text}`).digest('hex').slice(0, 16)
  const file = join(OUT, `${job.id}.mp3`)
  const cached = previous[job.id]
  if (cached?.hash === hash && existsSync(file)) {
    manifest[job.id] = cached
    continue
  }
  const { audio, chars } = engine.startsWith('eleven')
    ? await eleven(job.voiceId, job.text, job.settings)
    : say(job.sayVoice, job.text, file)
  writeFileSync(file, audio)
  const total = duration(file)
  manifest[job.id] = {
    kind: job.kind,
    text: job.text,
    file: `voice/${job.id}.mp3`,
    duration: total,
    words: words(job.text, chars, total),
    hash,
  }
  console.log(`  ${job.id}  ${total.toFixed(2)}s  ${job.text}`)
}
writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`Wrote ${Object.keys(manifest).length} clips to src/generated/voice.json`)
