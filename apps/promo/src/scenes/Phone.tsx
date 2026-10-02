// The one phone, from the loop to Create: it comes up for the loop, steps aside for the memory model,
// shows the lock screen in the middle, leaves for the languages and comes back for Create.
import { interpolate } from 'remotion'
import { CreateScreen } from '../screens/Other'
import { LockScreen } from '../screens/Other'
import type { LoopPhase } from '../screens/Player'
import { PlayerScreen } from '../screens/Player'
import { colors } from '../theme'
import { keyframes, prog, tl, useTime } from '../time'
import { Phone } from '../ui/kit'

const m = tl.marks
const S = tl.scenes

export function loopPhase(t: number): LoopPhase {
  if (t >= m.rate) return 'rate'
  if (t >= m.echo) return 'echo'
  if (t >= m.target) return 'target'
  if (t >= m.pause) return 'pause'
  return 'native'
}

function pose(t: number) {
  const L = S.loop.from
  const H = S.handsfree.from
  const G = S.languages.from
  const C = S.create.from
  const P = S.privacy.from
  return keyframes(t, [
    { t: L - 0.5, x: 640, y: 1500, s: 0.9, r: 8 },
    { t: L + 0.55, x: 640, y: 540, s: 1.08, r: 0 },
    { t: m.memory, x: 640, y: 540, s: 1.08, r: 0 },
    { t: m.memory + 0.8, x: 470, y: 540, s: 0.94, r: 0 },
    { t: H - 0.35, x: 470, y: 540, s: 0.94, r: 0 },
    { t: H + 0.45, x: 960, y: 520, s: 0.92, r: 0 },
    { t: G - 0.45, x: 960, y: 520, s: 0.92, r: 0 },
    { t: G + 0.2, x: 960, y: 1500, s: 0.85, r: -6 },
    { t: C - 0.5, x: 640, y: 1500, s: 0.9, r: 6 },
    { t: C + 0.35, x: 640, y: 540, s: 1.08, r: 0 },
    { t: P - 0.45, x: 640, y: 540, s: 1.08, r: 0 },
    { t: P + 0.15, x: 640, y: 1500, s: 0.9, r: -5 },
  ])
}

export function PhoneStage() {
  const t = useTime()
  if (t < S.loop.from - 0.5 || t > S.privacy.from + 0.2) return null
  const { x, y, s, r } = pose(t)
  const H = S.handsfree.from

  // The player, through the loop.
  const phase = loopPhase(t)
  const fill =
    phase === 'pause'
      ? prog(t, m.pause, m.target - m.pause, (v) => v)
      : phase === 'echo'
        ? prog(t, m.echo, m.rate - m.echo, (v) => v)
        : phase === 'rate'
          ? 1
          : 0
  const press = interpolate(t, [m.tap - 0.12, m.tap, m.tap + 0.18], [0, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const player = {
    phase,
    fill,
    revealed: prog(t, m.reveal, 0.5),
    elapsed: Math.max(0, t - m.native),
    press,
    rated: prog(t, m.tap + 0.1, 0.45),
  }
  const lock = prog(t, H - 0.25, 0.5)
  const create = t >= S.languages.from

  // Create: the topic typed, the press, the writing, the set and its rows.
  const typed = Math.max(0, Math.min(m.typed.length, Math.floor((t - m.typing) / 0.075) + 1))
  const createState = {
    typed: t < m.typing ? 0 : typed,
    caret: t < m.generate && Math.floor(t * 2.4) % 2 === 0,
    press: interpolate(t, [m.generate - 0.1, m.generate, m.generate + 0.18], [0, 1, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }),
    working: prog(t, m.generate, m.setReady - m.generate, (v) => v),
    ready: prog(t, m.setReady, 0.5),
    rows: [0, 1, 2, 3].map((i) => prog(t, m.setReady + 0.3 + i * 0.22, 0.4)),
  }

  // Where a finger presses: Easy, then Make the set.
  const tapAt = !create ? { x: 314, y: 718, at: m.tap } : { x: 195, y: 259, at: m.generate }
  const touch = interpolate(
    t,
    [tapAt.at - 0.35, tapAt.at - 0.1, tapAt.at + 0.25, tapAt.at + 0.5],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  )
  const ripple = prog(t, tapAt.at, 0.5)

  return (
    <Phone
      style={{ left: x - 209, top: y - 436, transform: `scale(${s}) rotate(${r}deg)` }}
      dark={lock > 0.5 && !create}
    >
      {!create ? (
        <>
          {lock < 1 && <PlayerScreen s={player} />}
          {lock > 0 && (
            <div style={{ position: 'absolute', inset: 0, opacity: lock }}>
              <LockScreen progress={prog(t, H, S.handsfree.duration, (v) => v) * 0.6 + 0.2} />
            </div>
          )}
        </>
      ) : (
        <CreateScreen s={createState} />
      )}
      {touch > 0 && (
        <>
          <div
            style={{
              position: 'absolute',
              left: tapAt.x - 24,
              top: tapAt.y - 24,
              width: 48,
              height: 48,
              borderRadius: 48,
              background: 'rgba(28,28,25,0.22)',
              border: '2px solid rgba(255,255,255,0.9)',
              opacity: touch,
              transform: `scale(${1 - 0.15 * Math.sin(Math.PI * prog(t, tapAt.at - 0.1, 0.3))})`,
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: tapAt.x - 40,
              top: tapAt.y - 40,
              width: 80,
              height: 80,
              borderRadius: 80,
              border: `2px solid ${colors.primaryContainer}`,
              opacity: ripple > 0 && ripple < 1 ? 1 - ripple : 0,
              transform: `scale(${0.5 + ripple})`,
            }}
          />
        </>
      )}
    </Phone>
  )
}
