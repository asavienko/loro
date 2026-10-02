// 6–7. The two promises (the voice stays on the phone; no screen shames a missed day), and the end card.
import { colors } from '../theme'
import { AppMark, Chip, Icon, text } from '../ui/kit'
import { prog, sceneWindow, springAt, tl, useTime } from '../time'

const m = tl.marks

export function Privacy() {
  const t = useTime()
  const w = sceneWindow(t, 'privacy')
  if (!w.visible) return null
  const one = prog(t, w.from + 0.15, 0.6)
  const lock = springAt(t, m.lock - 0.05, { damping: 10 })
  const two = prog(t, m.noShame - 0.1, 0.6)
  const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: (1 - w.out) * w.in }}>
      {/* The voice goes into the phone, and the phone locks. */}
      <div
        style={{
          position: 'absolute',
          left: 230,
          top: 170,
          width: 520,
          height: 300,
          opacity: one,
          transform: `translateY(${(1 - one) * 24}px)`,
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 70,
            width: 150,
            height: 150,
            borderRadius: 150,
            background: colors.primaryFixed,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="record_voice_over" size={84} color={colors.onPrimaryFixed} />
        </div>
        {[0, 1, 2, 3].map((i) => {
          const p = (t * 0.8 + i / 4) % 1
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: 175 + p * 160,
                top: 132,
                width: 22,
                height: 22,
                borderRadius: 22,
                background: colors.primaryContainer,
                opacity: Math.sin(p * Math.PI) * (1 - lock * 0.6),
              }}
            />
          )
        })}
        <div
          style={{
            position: 'absolute',
            left: 360,
            top: 20,
            width: 140,
            height: 250,
            borderRadius: 30,
            background: colors.inverseSurface,
            boxShadow: '0 30px 50px -20px rgba(49,48,45,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: 82,
              height: 82,
              borderRadius: 82,
              background: colors.tertiaryFixed,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transform: `scale(${0.4 + 0.6 * lock})`,
              opacity: Math.min(1, lock * 1.5),
            }}
          >
            <Icon name="lock" size={46} fill color={colors.onTertiaryFixed} />
          </div>
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 860,
          top: 200,
          width: 900,
          opacity: one,
          transform: `translateY(${(1 - one) * 24}px)`,
        }}
      >
        <div
          style={{
            ...text.sans,
            fontSize: 64,
            fontWeight: 600,
            letterSpacing: -1,
            lineHeight: 1.08,
            color: colors.onSurface,
          }}
        >
          Your voice stays
          <br />
          <span style={{ ...text.serif, fontStyle: 'italic', color: colors.primaryContainer }}>
            on your phone.
          </span>
        </div>
        <div
          style={{
            ...text.sans,
            fontSize: 32,
            marginTop: 18,
            color: colors.onSurfaceVariant,
            opacity: prog(t, m.lock, 0.5),
          }}
        >
          Nothing you say is recorded or sent anywhere.
        </div>
      </div>

      {/* A week with a day off in it, and nothing made of it. */}
      <div
        style={{
          position: 'absolute',
          left: 200,
          top: 600,
          display: 'flex',
          gap: 18,
          opacity: two,
          transform: `translateY(${(1 - two) * 24}px)`,
        }}
      >
        {DAYS.map((d, i) => {
          const off = i === 3
          const today = i === 4
          const p = springAt(t, m.noShame + i * 0.07, { damping: 14 })
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 10,
                transform: `scale(${0.7 + 0.3 * Math.min(1, p)})`,
              }}
            >
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 64,
                  background: off
                    ? 'transparent'
                    : today
                      ? colors.primaryContainer
                      : colors.primaryFixed,
                  border: off ? `3px dashed ${colors.outlineVariant}` : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {!off && (
                  <Icon
                    name={today ? 'play_arrow' : 'check'}
                    size={32}
                    fill={today}
                    color={today ? colors.onPrimary : colors.onPrimaryFixed}
                  />
                )}
              </div>
              <div style={{ ...text.sans, fontSize: 22, fontWeight: 600, color: colors.secondary }}>
                {d}
              </div>
            </div>
          )
        })}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 860,
          top: 590,
          width: 900,
          opacity: two,
          transform: `translateY(${(1 - two) * 24}px)`,
        }}
      >
        <div
          style={{
            ...text.sans,
            fontSize: 64,
            fontWeight: 600,
            letterSpacing: -1,
            lineHeight: 1.08,
            color: colors.onSurface,
          }}
        >
          Missed a day?
          <br />
          <span style={{ ...text.serif, fontStyle: 'italic', color: colors.primaryContainer }}>
            Just pick it up again.
          </span>
        </div>
        <div style={{ ...text.sans, fontSize: 32, marginTop: 18, color: colors.onSurfaceVariant }}>
          No streaks to keep. No guilt.
        </div>
      </div>
    </div>
  )
}

export function Outro() {
  const t = useTime()
  const w = sceneWindow(t, 'outro', 0.6, 0.01)
  if (!w.visible) return null
  const mark = springAt(t, w.from + 0.35, { damping: 10, stiffness: 140 })
  const ring = prog(t, w.from + 0.4, 1.4)
  const word = springAt(t, w.from + 0.6, { damping: 16 })
  const tag = prog(t, w.from + 1.0, 0.7)
  const parrot = springAt(t, m.parrot - 0.05, { damping: 14 })
  const chips = prog(t, m.final + 0.1, 0.6)
  const fade = prog(t, tl.duration - 0.8, 0.8)
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: w.in * (1 - fade) }}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 170,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 40,
        }}
      >
        <div style={{ position: 'relative', width: 170, height: 170 }}>
          <div
            style={{
              position: 'absolute',
              inset: -20,
              borderRadius: 64,
              border: `3px solid ${colors.primaryContainer}`,
              opacity: ring > 0 ? (1 - ring) * 0.6 : 0,
              transform: `scale(${1 + ring * 0.6})`,
            }}
          />
          <AppMark
            size={170}
            style={{ transform: `scale(${mark}) rotate(${(1 - mark) * -14}deg)` }}
          />
        </div>
        <div
          style={{
            ...text.serif,
            fontStyle: 'italic',
            fontWeight: 600,
            fontSize: 170,
            lineHeight: 1,
            letterSpacing: -4,
            color: colors.onSurface,
            opacity: word,
            transform: `translateX(${(1 - word) * -40}px)`,
          }}
        >
          Loro
        </div>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 420, textAlign: 'center' }}>
        <div
          style={{
            ...text.sans,
            fontSize: 54,
            fontWeight: 600,
            letterSpacing: -0.5,
            color: colors.onSurface,
            opacity: tag,
            transform: `translateY(${(1 - tag) * 20}px)`,
          }}
        >
          Learn languages by the phrase.
        </div>
        <div
          style={{
            ...text.serif,
            fontStyle: 'italic',
            fontWeight: 600,
            fontSize: 92,
            marginTop: 16,
            color: colors.primaryContainer,
            opacity: Math.min(1, parrot),
            transform: `translateY(${(1 - parrot) * 30}px)`,
          }}
        >
          Say it until it’s yours.
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 760,
          display: 'flex',
          justifyContent: 'center',
          gap: 24,
          opacity: chips,
          transform: `translateY(${(1 - chips) * 20}px)`,
        }}
      >
        <Chip icon="smartphone" label="iOS" size={30} />
        <Chip icon="smartphone" label="Android" size={30} />
        <Chip icon="public" label="Web" size={30} />
      </div>
    </div>
  )
}
