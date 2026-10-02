// The other screens the video shows: the player on the lock screen (P3-11, loro-media), and Create
// making a set with AI and a song from it.
import { colors } from '../theme'
import type { IconName } from '../ui/kit'
import { Icon, text } from '../ui/kit'

/** The lock screen with Loro's player on it, as the loro-media module puts it there. */
export function LockScreen({ progress }: { progress: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(170deg, #9f3c16 0%, #7f2500 45%, #390c00 100%)',
        ...text.sans,
        color: '#fff',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at 30% 20%, rgba(255,181,156,0.45), transparent 55%)',
        }}
      />
      <div style={{ position: 'absolute', top: 96, width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: 19, fontWeight: 600, opacity: 0.85 }}>Saturday 3 October</div>
        <div style={{ fontSize: 96, fontWeight: 600, letterSpacing: -2, lineHeight: 1.05 }}>
          8:14
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 14,
          right: 14,
          top: 470,
          borderRadius: 28,
          padding: 18,
          background: 'rgba(57,12,0,0.38)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.12)',
        }}
      >
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <div
            style={{
              width: 62,
              height: 62,
              borderRadius: 12,
              background: colors.primaryFixed,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="receipt_long" size={36} color={colors.onPrimaryFixed} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ ...text.serif, fontStyle: 'italic', fontWeight: 600, fontSize: 19 }}>
              La cuenta, por favor
            </div>
            <div style={{ fontSize: 14, opacity: 0.75 }}>En la cafetería · Loro</div>
          </div>
          <Icon name="graphic_eq" size={26} color="#ffb59c" />
        </div>
        <div
          style={{
            marginTop: 16,
            height: 5,
            borderRadius: 3,
            background: 'rgba(255,255,255,0.25)',
          }}
        >
          <div
            style={{
              width: `${progress * 100}%`,
              height: '100%',
              borderRadius: 3,
              background: '#fff',
            }}
          />
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-around',
            alignItems: 'center',
            marginTop: 14,
          }}
        >
          <Icon name="skip_previous" size={36} color="#fff" />
          <Icon name="pause" size={44} fill color="#fff" />
          <Icon name="skip_next" size={36} color="#fff" />
        </div>
      </div>
    </div>
  )
}

const PHRASES = [
  { es: 'Dos entradas, por favor', en: 'Two tickets, please', icon: 'book_online' },
  {
    es: '¿A qué hora abre el museo?',
    en: 'What time does the museum open?',
    icon: 'calendar_today',
  },
  { es: '¿Dónde está el metro?', en: 'Where’s the metro?', icon: 'train' },
  { es: 'Una mesa para dos', en: 'A table for two', icon: 'local_cafe' },
] as const satisfies readonly { es: string; en: string; icon: IconName }[]

export interface CreateState {
  typed: number
  caret: boolean
  press: number
  /** The writing's shimmer, 0–1, and how much of the set has arrived. */
  working: number
  ready: number
  rows: number[]
}

const TYPED = 'A weekend in Madrid'

/** Create: a topic typed, the set written, its phrases coming in. */
export function CreateScreen({ s }: { s: CreateState }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        paddingTop: 54,
        background: colors.surface,
        ...text.sans,
        color: colors.onSurface,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ padding: '10px 20px 0', flex: 1 }}>
        <div style={{ ...text.serif, fontSize: 28, lineHeight: '32px', fontWeight: 600 }}>
          Create
        </div>
        <div
          style={{
            marginTop: 14,
            padding: 16,
            borderRadius: 16,
            background: colors.surfaceContainerLowest,
            boxShadow: '0 1px 3px rgba(87,66,59,0.08)',
            border: `1px solid ${colors.hairline}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="auto_awesome" size={20} color={colors.primaryContainer} />
            <div style={{ fontSize: 15, fontWeight: 600 }}>A set of phrases</div>
            <div style={{ flex: 1 }} />
            <div style={{ fontSize: 11, color: colors.secondary }}>5 left today</div>
          </div>
          <div style={{ fontSize: 13, color: colors.secondary, marginTop: 2 }}>
            From a topic, a few words or a text.
          </div>
          <div
            style={{
              marginTop: 12,
              height: 46,
              borderRadius: 12,
              border: `1.5px solid ${s.typed > 0 ? colors.primaryContainer : colors.outlineVariant}`,
              padding: '0 14px',
              display: 'flex',
              alignItems: 'center',
              fontSize: 16,
            }}
          >
            {s.typed === 0 ? (
              <span style={{ color: colors.outline }}>What do you want to be ready for?</span>
            ) : (
              TYPED.slice(0, s.typed)
            )}
            {s.caret && (
              <span
                style={{ width: 2, height: 22, background: colors.primaryContainer, marginLeft: 1 }}
              />
            )}
          </div>
          <div
            style={{
              marginTop: 12,
              height: 46,
              borderRadius: 999,
              background: colors.primaryContainer,
              color: colors.onPrimary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              fontWeight: 600,
              fontSize: 15,
              transform: `scale(${1 - s.press * 0.05})`,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <Icon name="auto_awesome" size={20} color={colors.onPrimary} />
            {s.working > 0 && s.ready < 1 ? 'Writing…' : 'Make the set'}
            {s.working > 0 && s.ready < 1 && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: `linear-gradient(100deg, transparent ${s.working * 160 - 60}%, rgba(255,255,255,0.35) ${s.working * 160 - 30}%, transparent ${s.working * 160}%)`,
                }}
              />
            )}
          </div>
        </div>

        {/* The set that came back */}
        <div
          style={{
            marginTop: 16,
            opacity: s.ready,
            transform: `translateY(${(1 - s.ready) * 24}px)`,
          }}
        >
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <div
              style={{
                position: 'relative',
                width: 84,
                height: 84,
                borderRadius: 14,
                background: colors.tertiaryFixed,
                overflow: 'hidden',
                boxShadow: '0 6px 12px rgba(87,66,59,0.22)',
              }}
            >
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    width: 70,
                    height: 70,
                    borderRadius: 70,
                    border: `10px solid rgba(17,31,7,0.12)`,
                    left: -20 + i * 30,
                    top: -16 + (i % 2) * 40,
                  }}
                />
              ))}
              <Icon
                name="location_city"
                size={38}
                color={colors.onTertiaryFixed}
                style={{ position: 'absolute', left: 23, top: 23 }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ ...text.serif, fontSize: 19, lineHeight: '23px', fontWeight: 600 }}>
                Un fin de semana en Madrid
              </div>
              <div style={{ fontSize: 12, color: colors.secondary, marginTop: 3 }}>
                12 phrases · Spanish
              </div>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  marginTop: 6,
                  padding: '3px 8px',
                  borderRadius: 999,
                  background: colors.surfaceContainer,
                  fontSize: 11,
                  fontWeight: 600,
                  color: colors.onSurfaceVariant,
                }}
              >
                <Icon name="auto_awesome" size={13} color={colors.onSurfaceVariant} />
                Written by AI
              </div>
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            {PHRASES.map((p, i) => (
              <div
                key={p.es}
                style={{
                  display: 'flex',
                  gap: 12,
                  alignItems: 'center',
                  padding: '9px 0',
                  borderTop: `1px solid ${colors.hairline}`,
                  opacity: s.rows[i] ?? 0,
                  transform: `translateX(${(1 - (s.rows[i] ?? 0)) * 30}px)`,
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: colors.tertiaryFixed,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name={p.icon} size={22} color={colors.onTertiaryFixed} />
                </div>
                <div>
                  <div
                    style={{ ...text.serif, fontStyle: 'italic', fontSize: 16, fontWeight: 600 }}
                  >
                    {p.es}
                  </div>
                  <div style={{ fontSize: 12, color: colors.secondary }}>{p.en}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <TabBar active="create" />
    </div>
  )
}

const TABS = [
  { id: 'home', icon: 'home', label: 'Home' },
  { id: 'explore', icon: 'explore', label: 'Explore' },
  { id: 'create', icon: 'auto_awesome', label: 'Create' },
  { id: 'library', icon: 'library_music', label: 'Library' },
] as const

export function TabBar({ active }: { active: (typeof TABS)[number]['id'] }) {
  return (
    <div
      style={{
        height: 84,
        borderTop: `1px solid ${colors.hairline}`,
        background: colors.surface,
        display: 'flex',
        paddingTop: 8,
      }}
    >
      {TABS.map((tab) => {
        const on = tab.id === active
        return (
          <div
            key={tab.id}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              fontSize: 11,
              fontWeight: 600,
              color: on ? colors.primaryContainer : colors.secondary,
            }}
          >
            <Icon
              name={tab.icon}
              size={26}
              fill={on}
              color={on ? colors.primaryContainer : colors.secondary}
            />
            {tab.label}
          </div>
        )
      })}
    </div>
  )
}
