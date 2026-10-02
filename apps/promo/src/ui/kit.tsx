// The pieces every scene draws with: the app's icons, its mark, a phone, the paper the video sits on,
// and a wave drawn from a clip's real sound.
import { useAudioData, visualizeAudio } from '@remotion/media-utils'
import type { CSSProperties, ReactNode } from 'react'
import { AbsoluteFill, staticFile, useCurrentFrame } from 'remotion'
import { SANS, SERIF } from '../fonts'
import voice from '../generated/voice.json'
import { colors, ICON_CODEPOINTS } from '../theme'
import { FPS, useTime } from '../time'

export type IconName = keyof typeof ICON_CODEPOINTS

export function Icon({
  name,
  size = 24,
  color = colors.onSurface,
  fill = false,
  style,
}: {
  name: IconName
  size?: number
  color?: string
  fill?: boolean
  style?: CSSProperties
}) {
  return (
    <span
      style={{
        fontFamily: fill ? 'LoroSymbolsFill' : 'LoroSymbols',
        fontSize: size,
        lineHeight: 1,
        width: size,
        height: size,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color,
        fontFeatureSettings: '"liga" 0',
        flexShrink: 0,
        ...style,
      }}
    >
      {String.fromCodePoint(ICON_CODEPOINTS[name])}
    </span>
  )
}

/** The app's icon: a terracotta tile, a peach disc, an italic L. */
export function AppMark({ size = 160, style }: { size?: number; style?: CSSProperties }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      style={{ filter: 'drop-shadow(0 18px 36px rgba(127,37,0,0.28))', ...style }}
    >
      <rect width="512" height="512" rx="112" fill="#9f3c16" />
      <circle cx="256" cy="256" r="150" fill="#ffdbcf" />
      <text
        x="256"
        y="322"
        textAnchor="middle"
        fontFamily={SERIF}
        fontStyle="italic"
        fontWeight={600}
        fontSize="200"
        fill="#390c00"
      >
        L
      </text>
    </svg>
  )
}

export const text = {
  serif: { fontFamily: SERIF } as CSSProperties,
  sans: { fontFamily: SANS } as CSSProperties,
}

/** A phone: the screen is 390 × 844 points, as the app is laid out. */
export function Phone({
  children,
  style,
  dark = false,
}: {
  children: ReactNode
  style?: CSSProperties
  dark?: boolean
}) {
  return (
    <div
      style={{
        position: 'absolute',
        width: 390 + 28,
        height: 844 + 28,
        borderRadius: 68,
        background: 'linear-gradient(145deg, #3a3835 0%, #1c1c19 45%, #2a2826 100%)',
        padding: 14,
        boxShadow:
          '0 50px 100px -20px rgba(49,48,45,0.45), 0 30px 60px -30px rgba(87,66,59,0.5), inset 0 0 0 2px rgba(255,255,255,0.08)',
        ...style,
      }}
    >
      <div
        style={{
          position: 'relative',
          width: 390,
          height: 844,
          borderRadius: 54,
          overflow: 'hidden',
          background: colors.surface,
        }}
      >
        {children}
        <StatusBar dark={dark} />
        <div
          style={{
            position: 'absolute',
            top: 11,
            left: 195 - 62,
            width: 124,
            height: 36,
            borderRadius: 20,
            background: '#000',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: 8,
            left: 195 - 67,
            width: 134,
            height: 5,
            borderRadius: 3,
            background: dark ? 'rgba(255,255,255,0.8)' : colors.onSurface,
            opacity: 0.85,
          }}
        />
      </div>
    </div>
  )
}

function StatusBar({ dark }: { dark: boolean }) {
  const ink = dark ? '#fff' : colors.onSurface
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 54,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '4px 34px 0 46px',
        ...text.sans,
        fontWeight: 600,
        fontSize: 16,
        color: ink,
      }}
    >
      <span>9:41</span>
      <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <svg width="18" height="12" viewBox="0 0 18 12">
          {[0, 1, 2, 3].map((i) => (
            <rect
              key={i}
              x={i * 5}
              y={9 - i * 3}
              width="3.4"
              height={3 + i * 3}
              rx="1"
              fill={ink}
            />
          ))}
        </svg>
        <svg width="16" height="12" viewBox="0 0 16 12">
          <path
            d="M8 11.5 L5.6 8.9 A3.4 3.4 0 0 1 10.4 8.9 Z M3.4 6.6 A6.6 6.6 0 0 1 12.6 6.6 L11.4 7.9 A4.9 4.9 0 0 0 4.6 7.9 Z M1.1 4.3 A9.8 9.8 0 0 1 14.9 4.3 L13.7 5.6 A8.1 8.1 0 0 0 2.3 5.6 Z"
            fill={ink}
          />
        </svg>
        <svg width="27" height="13" viewBox="0 0 27 13">
          <rect
            x="0.5"
            y="0.5"
            width="23"
            height="12"
            rx="3.5"
            fill="none"
            stroke={ink}
            strokeOpacity="0.4"
          />
          <rect x="2" y="2" width="18" height="9" rx="2" fill={ink} />
          <rect x="24.5" y="4.5" width="1.6" height="4" rx="0.8" fill={ink} fillOpacity="0.4" />
        </svg>
      </span>
    </div>
  )
}

/** Warm paper, slow light moving across it, and a little grain. */
export function Paper() {
  const t = useTime()
  const blob = (x: number, y: number, r: number, color: string, phase: number) => (
    <div
      style={{
        position: 'absolute',
        left: x + Math.sin(t * 0.21 + phase) * 90,
        top: y + Math.cos(t * 0.17 + phase) * 70,
        width: r,
        height: r,
        borderRadius: '50%',
        background: color,
        filter: 'blur(120px)',
        opacity: 0.55,
      }}
    />
  )
  return (
    <AbsoluteFill style={{ background: colors.surface, overflow: 'hidden' }}>
      {blob(-200, -260, 900, colors.primaryFixed, 0)}
      {blob(1250, 520, 820, '#f3d8c4', 2)}
      {blob(700, 700, 700, colors.secondaryContainer, 4)}
      {blob(1400, -300, 600, '#e9efd9', 1)}
      <svg
        width="100%"
        height="100%"
        style={{ position: 'absolute', inset: 0, opacity: 0.07, mixBlendMode: 'multiply' }}
      >
        <filter id="grain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.9"
            numOctaves="2"
            seed={Math.floor(t * 12) % 7}
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>
    </AbsoluteFill>
  )
}

/**
 * Bars that move with a clip's real sound while it plays (its spectrum, frame by frame), and rest
 * as a flat line otherwise.
 */
export function ClipWave({
  id,
  at,
  bars = 28,
  width = 300,
  height = 56,
  color = colors.primaryContainer,
}: {
  id: keyof typeof voice
  at: number
  bars?: number
  width?: number
  height?: number
  color?: string
}) {
  const frame = useCurrentFrame()
  const clip = voice[id]
  const audio = useAudioData(staticFile(clip.file))
  const local = frame - Math.round(at * FPS)
  const playing = local >= 0 && local < clip.duration * FPS
  const values =
    audio && playing
      ? visualizeAudio({
          fps: FPS,
          frame: local,
          audioData: audio,
          numberOfSamples: 64,
          optimizeFor: 'speed',
        }).slice(1, bars + 1)
      : null
  const gap = 4
  const w = (width - gap * (bars - 1)) / bars
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap, width, height }}>
      {Array.from({ length: bars }, (_, i) => {
        // Speech sits low in the spectrum: mirror it so the wave is fullest in the middle.
        const k = Math.abs(i - (bars - 1) / 2)
        const v = values ? Math.min(1, Math.sqrt(values[Math.floor(k)] ?? 0) * 1.9) : 0
        return (
          <div
            key={i}
            style={{
              width: w,
              height: Math.max(4, v * height),
              borderRadius: w,
              background: color,
              opacity: values ? 0.9 : 0.3,
            }}
          />
        )
      })}
    </div>
  )
}

/** A soft pill with an icon. */
export function Chip({
  icon,
  label,
  style,
  size = 30,
}: {
  icon?: IconName
  label: ReactNode
  style?: CSSProperties
  size?: number
}) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: size * 0.45,
        padding: `${size * 0.5}px ${size * 0.95}px`,
        borderRadius: 999,
        background: colors.surfaceContainerLowest,
        boxShadow: '0 12px 30px -10px rgba(87,66,59,0.25), 0 0 0 1px rgba(230,223,215,0.9)',
        ...text.sans,
        fontSize: size,
        fontWeight: 600,
        color: colors.onSurface,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {icon && <Icon name={icon} size={size * 1.2} color={colors.primaryContainer} />}
      {label}
    </div>
  )
}
