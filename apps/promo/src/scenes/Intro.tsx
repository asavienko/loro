// 1. The mark, and the promise: one phrase at a time. Phrases from the courses drift around it.
import { colors } from '../theme'
import { AppMark, text } from '../ui/kit'
import { prog, sceneWindow, springAt, tl, useTime } from '../time'

const DRIFT = [
  { text: 'La cuenta, por favor', x: 150, y: 150, r: -4, d: 0.9 },
  { text: 'Благодаря!', x: 1450, y: 130, r: 3, d: 1.1 },
  { text: 'Где вокзал?', x: 120, y: 820, r: 3, d: 1.3 },
  { text: 'Dziękuję bardzo', x: 1430, y: 850, r: -3, d: 1.0 },
  { text: 'Kde je nádraží?', x: 1580, y: 480, r: 2, d: 1.5 },
  { text: 'Cheers, mate!', x: 70, y: 480, r: -2, d: 1.2 },
]

export function Intro() {
  const t = useTime()
  const w = sceneWindow(t, 'intro')
  if (!w.visible) return null
  const m = tl.marks
  const mark = springAt(t, 0.45, { damping: 10, stiffness: 140 })
  const ring = prog(t, 0.5, 1.4)
  const word = springAt(t, 0.95, { damping: 16 })
  const title = prog(t, m.introTitle, 0.8)
  const phrase = springAt(t, m.introPhrase - 0.05, { damping: 15 })
  const out = w.out

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        opacity: 1 - out,
        transform: `scale(${1 + out * 0.08})`,
        filter: `blur(${out * 10}px)`,
      }}
    >
      {DRIFT.map((d, i) => {
        const show = prog(t, d.d + i * 0.12, 1.2)
        return (
          <div
            key={d.text}
            style={{
              position: 'absolute',
              left: d.x + Math.sin(t * 0.5 + i) * 18,
              top: d.y + Math.cos(t * 0.4 + i * 2) * 14 - t * 6,
              transform: `rotate(${d.r}deg) scale(${0.9 + show * 0.1})`,
              opacity: show * 0.75,
              ...text.serif,
              fontStyle: 'italic',
              fontSize: 40,
              fontWeight: 500,
              color: colors.onSurfaceVariant,
              padding: '14px 28px',
              borderRadius: 999,
              background: 'rgba(255,255,255,0.55)',
              boxShadow: '0 0 0 1px rgba(222,192,183,0.6)',
              whiteSpace: 'nowrap',
            }}
          >
            {d.text}
          </div>
        )
      })}

      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 230,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 44,
        }}
      >
        <div style={{ position: 'relative', width: 190, height: 190 }}>
          <div
            style={{
              position: 'absolute',
              inset: -20,
              borderRadius: 70,
              border: `3px solid ${colors.primaryContainer}`,
              opacity: (1 - ring) * 0.6 * (ring > 0 ? 1 : 0),
              transform: `scale(${1 + ring * 0.6})`,
            }}
          />
          <AppMark
            size={190}
            style={{ transform: `scale(${mark}) rotate(${(1 - mark) * -14}deg)` }}
          />
        </div>
        <div
          style={{
            ...text.serif,
            fontStyle: 'italic',
            fontWeight: 600,
            fontSize: 190,
            lineHeight: 1,
            color: colors.onSurface,
            letterSpacing: -4,
            opacity: word,
            transform: `translateX(${(1 - word) * -40}px)`,
          }}
        >
          Loro
        </div>
      </div>

      <div style={{ position: 'absolute', left: 0, right: 0, top: 520, textAlign: 'center' }}>
        <div
          style={{
            ...text.sans,
            fontSize: 62,
            fontWeight: 600,
            color: colors.onSurface,
            letterSpacing: -1,
            opacity: title,
            transform: `translateY(${(1 - title) * 24}px)`,
          }}
        >
          Learn a language the way you’ll use it:
        </div>
        <div
          style={{
            ...text.serif,
            fontStyle: 'italic',
            fontSize: 104,
            fontWeight: 600,
            color: colors.primaryContainer,
            marginTop: 6,
            opacity: phrase,
            transform: `translateY(${(1 - phrase) * 30}px) scale(${0.94 + phrase * 0.06})`,
          }}
        >
          one phrase at a time.
        </div>
      </div>
    </div>
  )
}
