// 2. Beside the phone: the loop's steps, lit as the player reaches them, with the clips' real sound;
// then the memory model, drawn as the line says it, a review on each tick.
import { SANS } from '../fonts'
import { colors } from '../theme'
import type { IconName } from '../ui/kit'
import { ClipWave, Icon, text } from '../ui/kit'
import { prog, sceneWindow, springAt, tl, useTime } from '../time'
import { loopPhase } from './Phone'

const m = tl.marks
const STEPS: {
  phase: string
  icon: IconName
  title: string
  sub: string
  clip?: { id: 'c_en_bill' | 'c_es_bill'; at: number }
}[] = [
  {
    phase: 'native',
    icon: 'hearing',
    title: 'Hear it in your language',
    sub: '“The bill, please”',
    clip: { id: 'c_en_bill', at: m.nativeClip },
  },
  {
    phase: 'pause',
    icon: 'record_voice_over',
    title: 'Say it in the pause',
    sub: 'Out loud, before you hear it',
  },
  {
    phase: 'target',
    icon: 'volume_up',
    title: 'Hear it in Spanish',
    sub: '“La cuenta, por favor”',
    clip: { id: 'c_es_bill', at: m.targetClip },
  },
  { phase: 'echo', icon: 'replay', title: 'Say it again', sub: 'Just as you heard it' },
  { phase: 'rate', icon: 'task_alt', title: 'Rate how it went', sub: 'Missed, Hard or Easy' },
]
const ORDER = STEPS.map((s) => s.phase)

export function LoopSide() {
  const t = useTime()
  const w = sceneWindow(t, 'loop')
  if (!w.visible) return null
  const phase = loopPhase(t)
  const started = t >= m.native
  const current = started ? ORDER.indexOf(phase) : -1
  const steps = 1 - prog(t, m.memory - 0.2, 0.5)
  const chart = prog(t, m.memory + 0.2, 0.7)

  return (
    <div style={{ position: 'absolute', inset: 0, opacity: 1 - w.out }}>
      {steps > 0 && (
        <div
          style={{
            position: 'absolute',
            left: 960,
            top: 150,
            width: 860,
            opacity: steps,
            transform: `translateX(${(1 - steps) * 40}px)`,
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
              opacity: prog(t, w.from + 0.3, 0.5),
            }}
          >
            How it works
          </div>
          <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 18 }}>
            {STEPS.map((s, i) => {
              const appear = springAt(t, w.from + 0.45 + i * 0.12, { damping: 18 })
              const active = i === current
              const done = current > i
              const pulse = active && s.phase === 'pause' ? (t * 1.4) % 1 : 0
              return (
                <div
                  key={s.phase}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 28,
                    opacity: appear * (active ? 1 : done ? 0.62 : 0.38),
                    transform: `translateX(${(1 - appear) * 60 + (active ? 14 : 0)}px)`,
                  }}
                >
                  <div style={{ position: 'relative', width: 84, height: 84, flexShrink: 0 }}>
                    {pulse > 0 &&
                      [0, 0.5].map((o) => {
                        const p = (pulse + o) % 1
                        return (
                          <div
                            key={o}
                            style={{
                              position: 'absolute',
                              inset: 0,
                              borderRadius: 84,
                              border: `3px solid ${colors.primaryContainer}`,
                              opacity: 1 - p,
                              transform: `scale(${1 + p * 0.7})`,
                            }}
                          />
                        )
                      })}
                    <div
                      style={{
                        width: 84,
                        height: 84,
                        borderRadius: 84,
                        background: active
                          ? colors.primaryContainer
                          : done
                            ? colors.primaryFixed
                            : colors.surfaceContainerHigh,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: active ? '0 14px 30px -10px rgba(127,37,0,0.55)' : 'none',
                      }}
                    >
                      <Icon
                        name={done ? 'check' : s.icon}
                        size={42}
                        color={
                          active
                            ? colors.onPrimary
                            : done
                              ? colors.onPrimaryFixed
                              : colors.secondary
                        }
                      />
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        ...text.sans,
                        fontSize: 44,
                        fontWeight: 600,
                        letterSpacing: -0.5,
                        color: colors.onSurface,
                        lineHeight: 1.1,
                      }}
                    >
                      {s.title}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginTop: 6 }}>
                      <div
                        style={{
                          ...(s.sub.startsWith('“')
                            ? { ...text.serif, fontStyle: 'italic', fontSize: 32 }
                            : { ...text.sans, fontSize: 27 }),
                          color: colors.onSurfaceVariant,
                        }}
                      >
                        {s.sub}
                      </div>
                      {s.clip && active && (
                        <ClipWave id={s.clip.id} at={s.clip.at} bars={22} width={220} height={40} />
                      )}
                      {active && (s.phase === 'pause' || s.phase === 'echo') && (
                        <div
                          style={{
                            width: 220,
                            height: 10,
                            borderRadius: 5,
                            background: colors.primaryFixed,
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              height: '100%',
                              background: colors.primary,
                              width: `${(s.phase === 'pause' ? prog(t, m.pause, m.target - m.pause, (v) => v) : prog(t, m.echo, m.rate - m.echo, (v) => v)) * 100}%`,
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
      {chart > 0 && <MemoryChart t={t} show={chart} />}
    </div>
  )
}

/**
 * The shape of FSRS: recall falls after each review, each review brings it back, and each time it falls
 * more slowly, so the reviews spread out. A drawing of the idea, with no numbers on it.
 */
function MemoryChart({ t, show }: { t: number; show: number }) {
  const W = 980
  const H = 440
  const reviews = [2.2, 7, 17]
  const stability = [1.5, 4, 9, 20]
  const END = 30
  const recall = (x: number) => {
    let k = 0
    while (k < reviews.length && x >= reviews[k]) k++
    const last = k === 0 ? 0 : reviews[k - 1]
    return Math.exp(-(x - last) / stability[k])
  }
  const start = m.memory + 0.3
  const end = start + 5.4
  const times = [start, ...m.reviews, end]
  const xs = [0, ...reviews, END]
  let reached = 0
  for (let i = 0; i < times.length - 1; i++)
    if (t >= times[i])
      reached =
        xs[i] + (xs[i + 1] - xs[i]) * Math.min(1, (t - times[i]) / (times[i + 1] - times[i]))
  const px = (x: number) => 70 + (x / END) * (W - 110)
  const py = (r: number) => 80 + (1 - r) * (H - 150)
  const pts: string[] = []
  for (let x = 0; x <= reached; x += 0.05) {
    // Each review is a jump straight up: draw it as one.
    const k = reviews.findIndex((r) => Math.abs(x - r) < 0.025)
    if (k >= 0) pts.push(`${px(reviews[k])},${py(recall(reviews[k] - 0.0001))}`)
    pts.push(`${px(x)},${py(recall(x))}`)
  }
  return (
    <div
      style={{
        position: 'absolute',
        left: 820,
        top: 150,
        width: W,
        opacity: show,
        transform: `translateY(${(1 - show) * 30}px)`,
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
        When it comes back
      </div>
      <div
        style={{
          ...text.sans,
          fontSize: 50,
          fontWeight: 600,
          letterSpacing: -0.5,
          marginTop: 14,
          lineHeight: 1.1,
          color: colors.onSurface,
        }}
      >
        Each review, just before
        <br />
        you’d{' '}
        <span style={{ ...text.serif, fontStyle: 'italic', color: colors.primaryContainer }}>
          forget
        </span>
        .
      </div>
      <div
        style={{
          marginTop: 30,
          borderRadius: 32,
          background: 'rgba(255,255,255,0.75)',
          boxShadow: '0 20px 50px -20px rgba(87,66,59,0.3), 0 0 0 1px rgba(230,223,215,0.9)',
          padding: 10,
        }}
      >
        <svg width={W - 20} height={H - 60} viewBox={`0 0 ${W} ${H}`}>
          <line
            x1={px(0)}
            y1={py(0)}
            x2={px(END)}
            y2={py(0)}
            stroke={colors.hairline}
            strokeWidth={3}
          />
          <line
            x1={px(0)}
            y1={py(0)}
            x2={px(0)}
            y2={py(1)}
            stroke={colors.hairline}
            strokeWidth={3}
          />
          <text
            x={px(0) - 22}
            y={py(0.5)}
            transform={`rotate(-90 ${px(0) - 22} ${py(0.5)})`}
            textAnchor="middle"
            fontFamily={SANS}
            fontSize={22}
            fill={colors.secondary}
          >
            Recall
          </text>
          <text
            x={px(END)}
            y={py(0) + 40}
            textAnchor="end"
            fontFamily={SANS}
            fontSize={22}
            fill={colors.secondary}
          >
            Time
          </text>
          <polyline
            points={pts.join(' ')}
            fill="none"
            stroke={colors.primaryContainer}
            strokeWidth={6}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {reviews.map((r, i) => {
            const p = springAt(t, m.reviews[i], { damping: 9 })
            return (
              <g
                key={r}
                opacity={p > 0.01 ? 1 : 0}
                transform={`translate(${px(r)} ${py(1)}) scale(${p})`}
              >
                <circle
                  r={18}
                  fill={colors.tertiaryFixed}
                  stroke={colors.tertiaryContainer}
                  strokeWidth={3}
                />
                <text
                  y={-32}
                  textAnchor="middle"
                  fontFamily={SANS}
                  fontWeight={600}
                  fontSize={22}
                  fill={colors.tertiary}
                >
                  Review
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
