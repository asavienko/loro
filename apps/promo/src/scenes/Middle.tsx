// 3–5. Hands-free around the lock screen; the languages, each phrase in its course's voice; and Create,
// with the song made from the set.
import { colors } from '../theme'
import { Chip, ClipWave, Icon, text } from '../ui/kit'
import { prog, sceneWindow, springAt, tl, useTime } from '../time'

const m = tl.marks

export function HandsFree() {
  const t = useTime()
  const w = sceneWindow(t, 'handsfree')
  if (!w.visible) return null
  const chips = [
    { icon: 'directions_walk', label: 'On a walk', at: m.walk, x: 230, y: 300 },
    { icon: 'directions_bus', label: 'On the bus', at: m.bus, x: 1330, y: 420 },
    { icon: 'local_cafe', label: 'While the coffee brews', at: m.coffee, x: 180, y: 650 },
  ] as const
  const head = prog(t, w.from + 0.2, 0.6)
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: 1 - w.out }}>
      <div
        style={{
          position: 'absolute',
          left: 1290,
          top: 170,
          opacity: head,
          transform: `translateY(${(1 - head) * 20}px)`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <Icon name="headphones" size={64} color={colors.primaryContainer} />
          {[0, 1, 2].map((i) => {
            const p = (t * 0.9 + i / 3) % 1
            return (
              <div
                key={i}
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 16,
                  background: colors.primaryContainer,
                  opacity: 1 - p,
                  transform: `translateX(${p * 30}px)`,
                }}
              />
            )
          })}
        </div>
        <div
          style={{
            ...text.sans,
            fontSize: 52,
            fontWeight: 600,
            letterSpacing: -0.5,
            marginTop: 16,
            color: colors.onSurface,
            lineHeight: 1.1,
          }}
        >
          Hands-free,
          <br />
          <span style={{ ...text.serif, fontStyle: 'italic', color: colors.primaryContainer }}>
            like a playlist.
          </span>
        </div>
      </div>
      {chips.map((c, i) => {
        const p = springAt(t, c.at - 0.05, { damping: 12 })
        return (
          <div
            key={c.label}
            style={{
              position: 'absolute',
              left: c.x,
              top: c.y + Math.sin(t * 1.2 + i) * 8,
              opacity: Math.min(1, p),
              transform: `scale(${0.6 + 0.4 * p}) rotate(${(i % 2 ? 2 : -2) * p}deg)`,
            }}
          >
            <Chip icon={c.icon} label={c.label} size={38} />
          </div>
        )
      })}
    </div>
  )
}

const LANGS = [
  { name: 'Spanish', own: 'Español', phrase: '¿Dónde está la estación?', clip: 'c_es_station' },
  { name: 'Bulgarian', own: 'Български', phrase: 'Къде е гарата?', clip: 'c_bg_station' },
  { name: 'Russian', own: 'Русский', phrase: 'Где вокзал?', clip: 'c_ru_station' },
  { name: 'Polish', own: 'Polski', phrase: 'Gdzie jest dworzec?', clip: 'c_pl_station' },
  { name: 'Czech', own: 'Čeština', phrase: 'Kde je nádraží?', clip: 'c_cs_station' },
  {
    name: 'English',
    own: 'British & American',
    phrase: 'Where’s the station?',
    clip: 'c_en_station',
  },
] as const

export function Languages() {
  const t = useTime()
  const w = sceneWindow(t, 'languages')
  if (!w.visible) return null
  const clips = m.langClips
  const playing = clips.findIndex((at, i) => t >= at - 0.1 && t < (clips[i + 1] ?? w.end) - 0.1)
  const grid = prog(t, clips[0] - 0.9, 0.7)
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        opacity: (1 - w.out) * w.in,
        transform: `scale(${0.97 + w.in * 0.03})`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 120,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          gap: 34,
        }}
      >
        {LANGS.map((l, i) => {
          const p = springAt(t, m.langNames[i] - 0.06, { damping: 13 })
          const lit = playing === i
          return (
            <div
              key={l.name}
              style={{
                ...text.serif,
                fontSize: 62,
                fontWeight: 600,
                fontStyle: 'italic',
                color: lit ? colors.primaryContainer : colors.onSurface,
                opacity: Math.min(1, p),
                transform: `translateY(${(1 - p) * 40}px)`,
              }}
            >
              {l.name}
            </div>
          )
        })}
      </div>
      <div
        style={{
          position: 'absolute',
          top: 290,
          left: 150,
          right: 150,
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 36,
          opacity: grid,
          transform: `translateY(${(1 - grid) * 40}px)`,
        }}
      >
        {LANGS.map((l, i) => {
          const lit = playing === i
          const lift =
            springAt(t, clips[i] - 0.12, { damping: 15 }) -
            (playing > i ? springAt(t, clips[i + 1] - 0.12, { damping: 18 }) : 0)
          const done = playing > i || (playing === -1 && t > clips[clips.length - 1])
          return (
            <div
              key={l.name}
              style={{
                height: 268,
                borderRadius: 32,
                padding: '30px 34px',
                background: lit ? colors.surfaceContainerLowest : 'rgba(255,255,255,0.6)',
                boxShadow: lit
                  ? `0 30px 60px -24px rgba(127,37,0,0.4), 0 0 0 3px ${colors.primaryContainer}`
                  : '0 0 0 1px rgba(222,192,183,0.7)',
                transform: `translateY(${-lift * 14}px) scale(${1 + lift * 0.035})`,
                opacity: lit || done || playing === -1 ? 1 : 0.6,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  ...text.sans,
                }}
              >
                <span
                  style={{
                    fontSize: 26,
                    fontWeight: 700,
                    color: lit ? colors.primaryContainer : colors.onSurface,
                  }}
                >
                  {l.name}
                </span>
                <span style={{ fontSize: 22, color: colors.secondary }}>{l.own}</span>
              </div>
              <div
                style={{
                  ...text.serif,
                  fontStyle: 'italic',
                  fontWeight: 600,
                  fontSize: 44,
                  lineHeight: 1.1,
                  color: colors.onSurface,
                }}
              >
                {l.phrase}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 44,
                    background: lit ? colors.primaryContainer : colors.surfaceContainerHigh,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon
                    name="volume_up"
                    size={24}
                    color={lit ? colors.onPrimary : colors.secondary}
                  />
                </div>
                <ClipWave
                  id={l.clip}
                  at={clips[i]}
                  bars={30}
                  width={330}
                  height={38}
                  color={lit ? colors.primaryContainer : colors.outlineVariant}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function CreateSide() {
  const t = useTime()
  const w = sceneWindow(t, 'create')
  if (!w.visible) return null
  const head = prog(t, w.from + 0.25, 0.6)
  const song = springAt(t, m.song - 0.1, { damping: 15 })
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: 1 - w.out }}>
      <div
        style={{
          position: 'absolute',
          left: 960,
          top: 170,
          opacity: head,
          transform: `translateY(${(1 - head) * 20}px)`,
        }}
      >
        <div
          style={{
            ...text.sans,
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: 3,
            textTransform: 'uppercase',
            color: colors.primaryContainer,
          }}
        >
          Create
        </div>
        <div
          style={{
            ...text.sans,
            fontSize: 56,
            fontWeight: 600,
            letterSpacing: -0.5,
            marginTop: 14,
            lineHeight: 1.1,
            color: colors.onSurface,
          }}
        >
          Sets of your own,
          <br />
          for{' '}
          <span style={{ ...text.serif, fontStyle: 'italic', color: colors.primaryContainer }}>
            wherever you’re going.
          </span>
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 960,
          top: 470,
          width: 800,
          borderRadius: 36,
          padding: 30,
          display: 'flex',
          gap: 30,
          alignItems: 'center',
          background: colors.surfaceContainerLowest,
          boxShadow: '0 40px 80px -30px rgba(87,66,59,0.45), 0 0 0 1px rgba(230,223,215,0.9)',
          opacity: Math.min(1, song),
          transform: `translateX(${(1 - song) * 120}px) rotate(${(1 - song) * 3}deg)`,
        }}
      >
        <div
          style={{
            position: 'relative',
            width: 170,
            height: 170,
            borderRadius: 26,
            background: colors.primaryContainer,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              position: 'absolute',
              width: 260,
              height: 260,
              borderRadius: 260,
              border: '26px solid rgba(255,201,183,0.25)',
              left: -80,
              top: -90,
            }}
          />
          <Icon name="music_note" size={92} color={colors.onPrimaryContainer} />
        </div>
        <div style={{ flex: 1 }}>
          <div
            style={{
              ...text.sans,
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: 'uppercase',
              color: colors.secondary,
            }}
          >
            Song · from your set
          </div>
          <div
            style={{
              ...text.serif,
              fontStyle: 'italic',
              fontWeight: 600,
              fontSize: 46,
              lineHeight: 1.1,
              marginTop: 8,
              color: colors.onSurface,
            }}
          >
            Fin de semana en Madrid
          </div>
          <div
            style={{ display: 'flex', alignItems: 'flex-end', gap: 7, height: 56, marginTop: 18 }}
          >
            {Array.from({ length: 26 }, (_, i) => {
              const h =
                0.25 +
                0.75 *
                  Math.abs(Math.sin(t * (3 + (i % 5) * 0.7) + i * 1.3)) *
                  (song > 0.5 ? 1 : 0.2)
              return (
                <div
                  key={i}
                  style={{
                    width: 9,
                    height: h * 56,
                    borderRadius: 5,
                    background: i % 3 ? colors.primaryFixedDim : colors.primaryContainer,
                  }}
                />
              )
            })}
          </div>
        </div>
        <div
          style={{
            width: 84,
            height: 84,
            borderRadius: 84,
            background: colors.primaryContainer,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 14px 28px -10px rgba(127,37,0,0.6)',
          }}
        >
          <Icon name="pause" size={46} fill color={colors.onPrimary} />
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 990,
          top: 740,
          opacity: prog(t, m.song + 0.6, 0.6),
          ...text.sans,
          fontSize: 30,
          color: colors.onSurfaceVariant,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <Icon name="check_circle" size={34} fill color={colors.tertiaryContainer} />
        Sung from your phrases, rated like them.
      </div>
    </div>
  )
}
