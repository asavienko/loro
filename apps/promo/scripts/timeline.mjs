// Lays the video out in seconds from the real lengths of its lines and clips (src/generated/voice.json):
// the scenes, when each line and clip plays, the sound effects, and the marks the pictures move on.
// Writes src/generated/timeline.json; synth.mjs scores the music to it and the scenes animate to it.
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const voice = JSON.parse(readFileSync(join(ROOT, 'src/generated/voice.json'), 'utf8'))

const scenes = {}
const plays = []
const sfx = []
const marks = {}

/** Plays a line or clip at `at`; returns when it ends. */
function play(id, at) {
  plays.push({ id, at: round(at), duration: voice[id].duration })
  return at + voice[id].duration
}
/** When a line's word (its first occurrence from `from`) starts. */
function wordAt(id, at, word, from = 0) {
  const w = voice[id].words
    .slice(from)
    .find((x) => x.text.toLowerCase().replace(/[^\p{L}]/gu, '') === word)
  if (!w) throw new Error(`No "${word}" in ${id}`)
  return at + w.start
}
const fx = (id, at, gain = 1) => sfx.push({ id, at: round(at), gain })
const round = (t) => Math.round(t * 1000) / 1000
function scene(name, from, end) {
  scenes[name] = { from: round(from), duration: round(end - from) }
  return end
}

let t = 0
let end

// 1. The mark, and the promise.
fx('swell', 0, 0.7)
fx('pop', 0.45)
fx('chime', 0.5, 0.8)
marks.introTitle = 1.4
end = play('v01', 1.4)
marks.introPhrase = wordAt('v01', 1.4, 'one')
t = scene('intro', 0, end + 0.5)

// 2. The loop, on a phone: hear it, say it, hear it, say it again, rate it.
{
  const S = t
  fx('whoosh', S - 0.25, 0.8)
  end = play('v02', S + 0.7)
  marks.native = end + 0.15
  fx('tick', marks.native, 0.6)
  marks.nativeClip = marks.native + 0.25
  end = play('c_en_bill', marks.nativeClip)
  marks.pause = end + 0.3
  fx('tick', marks.pause, 0.6)
  end = play('v03', marks.pause + 0.2)
  marks.target = end + 1.9
  fx('tick', marks.target, 0.6)
  end = play('v04', marks.target + 0.1)
  marks.targetClip = end + 0.15
  marks.reveal = marks.targetClip
  fx('reveal', marks.reveal, 0.7)
  end = play('c_es_bill', marks.targetClip)
  marks.echo = end + 0.3
  fx('tick', marks.echo, 0.6)
  const v05 = marks.echo + 0.15
  end = play('v05', v05)
  marks.rate = wordAt('v05', v05, 'then')
  marks.tap = end + 0.35
  fx('tap', marks.tap)
  fx('success', marks.tap + 0.05, 0.8)
  marks.memory = marks.tap + 0.9
  fx('whoosh', marks.memory - 0.15, 0.5)
  end = play('v06', marks.memory + 0.3)
  marks.reviews = [0.35, 0.55, 0.75].map((f) => marks.memory + 0.3 + voice.v06.duration * f)
  for (const r of marks.reviews) fx('tick', r, 0.5)
  t = scene('loop', S, end + 0.7)
}

// 3. Hands-free, like a playlist.
{
  const S = t
  fx('whoosh', S - 0.2, 0.7)
  const at = S + 0.5
  end = play('v07', at)
  marks.walk = wordAt('v07', at, 'on')
  marks.bus = wordAt('v07', at, 'on', 8)
  marks.coffee = wordAt('v07', at, 'while')
  for (const m of [marks.walk, marks.bus, marks.coffee]) fx('pop', m, 0.45)
  t = scene('handsfree', S, end + 0.6)
}

// 4. The languages, each in its own voice.
{
  const S = t
  fx('whoosh', S - 0.2, 0.7)
  const at = S + 0.4
  end = play('v08', at)
  marks.langNames = ['spanish', 'bulgarian', 'russian', 'polish', 'czech', 'english'].map((w) =>
    wordAt('v08', at, w),
  )
  marks.langClips = []
  let c = end + 0.35
  for (const id of [
    'c_es_station',
    'c_bg_station',
    'c_ru_station',
    'c_pl_station',
    'c_cs_station',
    'c_en_station',
  ]) {
    marks.langClips.push(c)
    fx('flip', c - 0.12, 0.55)
    c = play(id, c) + 0.22
  }
  t = scene('languages', S, c + 0.5)
}

// 5. Make your own: a set with AI, then a song from it.
{
  const S = t
  fx('whoosh', S - 0.2, 0.7)
  const at = S + 0.5
  marks.typing = S + 0.6
  marks.typed = 'A weekend in Madrid'
  for (let i = 0; i < marks.typed.length; i++) fx('type', marks.typing + i * 0.075, 0.35)
  end = play('v09', at)
  marks.generate = marks.typing + marks.typed.length * 0.075 + 0.35
  fx('tap', marks.generate, 0.8)
  fx('shimmer', marks.generate + 0.05, 0.7)
  marks.setReady = marks.generate + 1.3
  fx('chime', marks.setReady, 0.45)
  marks.song = wordAt('v09', at, 'loro')
  fx('swell', marks.song - 0.4, 0.4)
  t = scene('create', S, end + 0.9)
}

// 6. Privacy, and no shame.
{
  const S = t
  fx('whoosh', S - 0.2, 0.6)
  const at = S + 0.4
  end = play('v10', at)
  marks.lock = wordAt('v10', at, 'nothing')
  fx('lock', marks.lock, 0.7)
  marks.noShame = wordAt('v10', at, 'and')
  fx('pop', marks.noShame + 0.3, 0.4)
  t = scene('privacy', S, end + 0.6)
}

// 7. The end card.
{
  const S = t
  fx('whoosh', S - 0.2, 0.6)
  fx('pop', S + 0.35, 0.9)
  fx('chime', S + 0.4, 0.9)
  end = play('v11', S + 0.9)
  marks.parrot = wordAt('v11', S + 0.9, 'say')
  marks.final = end
  t = scene('outro', S, end + 3.2)
}

const timeline = {
  fps: 30,
  width: 1920,
  height: 1080,
  duration: round(t),
  scenes,
  plays,
  sfx,
  marks,
}
writeFileSync(join(ROOT, 'src/generated/timeline.json'), `${JSON.stringify(timeline, null, 2)}\n`)
console.log(`Timeline: ${t.toFixed(2)}s, ${plays.length} voice plays, ${sfx.length} effects`)
for (const [name, s] of Object.entries(scenes))
  console.log(`  ${name.padEnd(10)} ${s.from.toFixed(2)}s  +${s.duration.toFixed(2)}s`)
