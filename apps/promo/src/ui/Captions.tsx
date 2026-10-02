// The narrator's words on screen, a phrase at a time and lit as they are said: a landing page plays
// its video muted until it's tapped, so the story has to read without sound.
import voice from '../generated/voice.json'
import { colors } from '../theme'
import { prog, tl, useTime } from '../time'
import { text } from './kit'

interface Word {
  text: string
  start: number
  end: number
}

/** Splits a line into short phrases: at punctuation, or every eight words. */
function chunks(words: Word[]): Word[][] {
  const out: Word[][] = []
  let cur: Word[] = []
  for (const w of words) {
    cur.push(w)
    const stop = /[.,:;!?]$/.test(w.text) && cur.length >= 3
    if (stop || cur.length >= 8) {
      out.push(cur)
      cur = []
    }
  }
  if (cur.length) {
    // A short tail joins the phrase before it.
    if (cur.length < 3 && out.length) out[out.length - 1].push(...cur)
    else out.push(cur)
  }
  return out
}

/** Where the captions sit: under the middle, or under the right-hand column beside the phone. */
export function Captions({ align }: { align: (t: number) => 'center' | 'right' }) {
  const t = useTime()
  const play = tl.plays.find(
    (p) =>
      voice[p.id as keyof typeof voice].kind === 'line' &&
      t >= p.at - 0.1 &&
      t < p.at + p.duration + 0.35,
  )
  if (!play) return null
  const line = voice[play.id as keyof typeof voice]
  const local = t - play.at
  const groups = chunks(line.words)
  const found = groups.findIndex((g) => local < g[g.length - 1].end + 0.08)
  const index = found === -1 ? groups.length - 1 : found
  const group = groups[index]
  const shown = prog(t, play.at + group[0].start - 0.12, 0.22)
  const gone = 1 - prog(t, play.at + play.duration + 0.1, 0.25)
  const side = align(t)
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 64,
        left: side === 'right' ? 860 : 160,
        right: side === 'right' ? 90 : 160,
        display: 'flex',
        justifyContent: 'center',
        opacity: Math.min(shown, gone),
        transform: `translateY(${(1 - shown) * 14}px)`,
      }}
    >
      <div
        key={`${play.id}-${index}`}
        style={{
          ...text.sans,
          fontSize: 38,
          lineHeight: 1.3,
          fontWeight: 600,
          textAlign: 'center',
          padding: '14px 30px',
          borderRadius: 22,
          background: 'rgba(252,249,244,0.82)',
          boxShadow: '0 10px 30px -12px rgba(87,66,59,0.3)',
          backdropFilter: 'blur(10px)',
          color: colors.onSurface,
        }}
      >
        {group.map((w, i) => {
          const lit = local >= w.start - 0.03
          return (
            <span key={i} style={{ color: lit ? colors.onSurface : 'rgba(28,28,25,0.32)' }}>
              {w.text}
              {i < group.length - 1 ? ' ' : ''}
            </span>
          )
        })}
      </div>
    </div>
  )
}
