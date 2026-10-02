// The app's player (apps/mobile/src/screens/NowPlayingScreen.tsx), drawn at its own sizes: the phrase's
// picture, the prompt with the Spanish hidden until it's heard, the loop's four steps, the grades and
// the transport. Driven by the loop's phase rather than the app's state machine.
import { colors } from '../theme'
import type { IconName } from '../ui/kit'
import { Icon, text } from '../ui/kit'

export type LoopPhase = 'native' | 'pause' | 'target' | 'echo' | 'rate'
const STEPS: { phase: Exclude<LoopPhase, 'rate'>; icon: IconName }[] = [
  { phase: 'native', icon: 'hearing' },
  { phase: 'pause', icon: 'record_voice_over' },
  { phase: 'target', icon: 'volume_up' },
  { phase: 'echo', icon: 'replay' },
]
const INSTRUCTION: Record<LoopPhase, string> = {
  native: 'Listen in English',
  pause: 'Your turn — say it out loud in Spanish',
  target: 'Hear it in Spanish',
  echo: 'Say it again in Spanish, just as you heard it',
  rate: 'Rate it, or wait to go on',
}
const GRADES = [
  { label: 'Missed', icon: 'replay', bg: colors.surfaceContainerHigh, ink: colors.onSurface },
  { label: 'Hard', icon: 'hourglass_empty', bg: colors.secondaryContainer, ink: colors.onSurface },
  { label: 'Easy', icon: 'check', bg: colors.tertiaryFixed, ink: colors.onTertiaryFixed },
] as const

export interface PlayerState {
  phase: LoopPhase
  /** How far the learner's turn or the echo has run, 0–1. */
  fill: number
  revealed: number
  elapsed: number
  /** The press on Easy, 0–1, and whether the rating has been given. */
  press: number
  rated: number
}

export function PlayerScreen({ s }: { s: PlayerState }) {
  const order = STEPS.findIndex((x) => x.phase === s.phase)
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        paddingTop: 54,
        background: colors.surface,
        ...text.sans,
        color: colors.onSurface,
      }}
    >
      {/* The header */}
      <div style={{ height: 52, display: 'flex', alignItems: 'center', padding: '0 8px' }}>
        <div style={{ width: 44, display: 'flex', justifyContent: 'center' }}>
          <Icon name="keyboard_arrow_down" size={26} />
        </div>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ ...text.serif, fontSize: 15, fontWeight: 600, lineHeight: '21px' }}>
            En la cafetería
          </div>
          <div style={{ fontSize: 12, lineHeight: '16px', color: colors.secondary }}>3 of 12</div>
        </div>
        <div style={{ width: 44, display: 'flex', justifyContent: 'center' }}>
          <Icon name="queue_music" size={26} />
        </div>
      </div>

      {/* The phrase's picture: its main icon on its topic's colour, a second in a disc. */}
      <div
        style={{
          position: 'relative',
          height: 268,
          background: colors.primaryFixed,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <Icon
          name="receipt_long"
          size={132}
          color={colors.onPrimaryFixed}
          style={{ opacity: 0.9, transform: `scale(${1 + 0.04 * Math.sin(s.elapsed * 2)})` }}
        />
        <div
          style={{
            position: 'absolute',
            left: 20,
            top: 20,
            width: 74,
            height: 74,
            borderRadius: 74,
            background: 'rgba(252,249,244,0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="payments" size={43} color={colors.onPrimaryFixed} />
        </div>
      </div>

      <div style={{ padding: '16px 20px 0' }}>
        {/* The prompt leads, the Spanish a dashed slot; once heard, the Spanish leads. */}
        <div style={{ position: 'relative', height: 64 }}>
          <div style={{ position: 'absolute', inset: 0, opacity: 1 - s.revealed }}>
            <div
              style={{
                width: 170,
                height: 26,
                borderRadius: 8,
                border: `1.5px dashed ${colors.outlineVariant}`,
                marginBottom: 6,
              }}
            />
            <div style={{ fontSize: 24, lineHeight: '30px', fontWeight: 600 }}>
              The bill, please
            </div>
          </div>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              opacity: s.revealed,
              transform: `translateY(${(1 - s.revealed) * 8}px)`,
            }}
          >
            <div
              style={{
                ...text.serif,
                fontStyle: 'italic',
                fontSize: 27,
                lineHeight: '32px',
                fontWeight: 600,
              }}
            >
              La cuenta, por favor
            </div>
            <div style={{ fontSize: 14, lineHeight: '20px', color: colors.secondary }}>
              The bill, please
            </div>
          </div>
        </div>
        {/* Speed; like, add to set, notes */}
        <div style={{ display: 'flex', alignItems: 'center', marginTop: 8, gap: 4 }}>
          <div
            style={{
              padding: '6px 12px',
              borderRadius: 999,
              background: colors.surfaceContainer,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            1×
          </div>
          <div style={{ flex: 1 }} />
          {(['favorite', 'playlist_add', 'lightbulb'] as const).map((i) => (
            <div
              key={i}
              style={{
                width: 44,
                height: 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name={i} size={24} color={colors.secondary} />
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex: 1 }} />

      {/* The loop: what to do now, the four steps, the repetition and the time. */}
      <div style={{ padding: '0 20px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div
          style={{
            fontSize: 18,
            lineHeight: '23px',
            fontWeight: 600,
            minHeight: 46,
            display: 'flex',
            alignItems: 'flex-end',
          }}
        >
          {INSTRUCTION[s.phase]}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {STEPS.map((st, i) => {
            const current = st.phase === s.phase
            const done = s.phase === 'rate' || i < order
            const filling = current && (st.phase === 'pause' || st.phase === 'echo')
            const bg = current
              ? filling
                ? colors.primaryFixed
                : colors.primaryContainer
              : done
                ? 'rgba(255,219,207,0.5)'
                : colors.surfaceContainerLow
            const border = current
              ? colors.primaryContainer
              : done
                ? 'transparent'
                : colors.hairline
            const ink =
              current && !filling
                ? colors.onPrimary
                : current || done
                  ? colors.onPrimaryFixed
                  : colors.secondary
            return (
              <div
                key={st.phase}
                style={{
                  position: 'relative',
                  flex: 1,
                  height: 32,
                  borderRadius: 999,
                  border: `1px ${filling ? 'dashed' : 'solid'} ${border}`,
                  background: bg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                }}
              >
                {filling && (
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: `${s.fill * 100}%`,
                      background: colors.primary,
                    }}
                  />
                )}
                <Icon
                  name={st.icon}
                  size={18}
                  color={filling && s.fill > 0.5 ? colors.onPrimary : ink}
                  style={{ position: 'relative' }}
                />
              </div>
            )
          })}
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 12,
            color: colors.secondary,
          }}
        >
          <span>Repetition 1 of 2</span>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>
            0:{String(Math.floor(s.elapsed)).padStart(2, '0')}
          </span>
        </div>
      </div>

      {/* The dock: the line over the grades, the grades (or what the rating did), the transport. */}
      <div
        style={{
          borderTop: `1px solid ${colors.hairline}`,
          padding: '4px 20px 26px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        <div style={{ position: 'relative', height: 92 }}>
          <div style={{ position: 'absolute', inset: 0, opacity: 1 - s.rated }}>
            <div
              style={{
                height: 34,
                display: 'flex',
                alignItems: 'center',
                fontSize: 13,
                fontWeight: 500,
                color: colors.onSurfaceVariant,
              }}
            >
              {s.phase === 'native' || s.phase === 'pause'
                ? 'Rate once you’ve said it'
                : 'Did you remember it?'}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {GRADES.map((g) => {
                const pressed = g.label === 'Easy' ? s.press : 0
                return (
                  <div
                    key={g.label}
                    style={{
                      flex: 1,
                      height: 52,
                      borderRadius: 14,
                      background: g.bg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      fontSize: 15,
                      fontWeight: 600,
                      color: g.ink,
                      transform: `scale(${1 - pressed * 0.06})`,
                      filter: `brightness(${1 - pressed * 0.08})`,
                    }}
                  >
                    <Icon name={g.icon} size={18} color={g.ink} />
                    {g.label}
                  </div>
                )
              })}
            </div>
          </div>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              opacity: s.rated,
              transform: `translateY(${(1 - s.rated) * 10}px)`,
            }}
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 14,
                background: colors.tertiaryFixed,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transform: `scale(${0.6 + 0.4 * s.rated})`,
              }}
            >
              <Icon name="task_alt" size={22} color={colors.onTertiaryFixed} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Easy</div>
              <div style={{ fontSize: 12, fontWeight: 500, color: colors.onSurfaceVariant }}>
                Next review scheduled
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 14,
                fontWeight: 600,
                color: colors.primaryContainer,
              }}
            >
              <Icon name="undo" size={18} color={colors.primaryContainer} />
              Undo
            </div>
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 18px',
          }}
        >
          <Icon name="favorite" size={26} color={colors.secondary} />
          <Icon name="skip_previous" size={34} />
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 64,
              background: colors.primaryContainer,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 10px 20px rgba(49,48,45,0.28)',
            }}
          >
            <Icon name="pause" size={34} fill color={colors.onPrimary} />
          </div>
          <Icon name="skip_next" size={34} />
          <Icon name="queue_music" size={26} color={colors.secondary} />
        </div>
      </div>
    </div>
  )
}
