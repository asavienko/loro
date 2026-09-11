/**
 * Motion adapter over generated tokens.
 *
 * Pure TypeScript — no Reanimated — so Node unit tests can pin token → reduced-motion
 * mapping without a native runtime. Components import `motionRuntime.ts` for UI-thread
 * easing constructors.
 */

import { motion, scale } from '@loro/design-tokens'

export type CubicBezier = readonly [number, number, number, number]
export type NamedEasing = 'linear' | 'inOut' | 'ease'
export type ParsedEasing = CubicBezier | NamedEasing

export type ReducedMotionOutcome =
  'crossfade' | 'instant' | 'static' | 'keep' | 'keepColour' | 'none' | 'scrubber'

export type AnimationName = keyof typeof motion.animation
export type TransitionName = keyof typeof motion.transition
export type MotionTokenName = AnimationName | TransitionName
export type PressFeedback = 'row' | 'button' | 'smallButton' | 'icon' | 'grow'

export interface MotionSpec {
  readonly durationMs: number
  readonly easing: string
  readonly reducedMotion: ReducedMotionOutcome
  readonly loop: boolean
  readonly staggerMs: number
}

export interface PressScaleSpec {
  readonly scale: number
  readonly durationMs: number
  readonly opacity: number | undefined
}

export interface WarmingStop {
  readonly at: number
  readonly background: string
  readonly text: string
  readonly glowRadius: number
  readonly glowOpacity: number
}

/** Authored Reduce Motion cross-fade. `motion.md` — not a generated duration. */
export const REDUCED_MOTION_CROSSFADE_MS = 150

/** Speed-mode beat only. `Loro.dc.html:3414` — the visual cue that Speed is different. */
export const SPEED_BEAT_TEMPO_MS = 340

export const BEAT_TEMPO_MS = {
  default: motion.animation.barJump.duration,
  speed: SPEED_BEAT_TEMPO_MS,
} as const

const CUBIC_BEZIER =
  /^cubic-bezier\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)\s*\)$/

export function parseEasing(value: string): ParsedEasing {
  if (value === 'linear') return 'linear'
  if (value === 'ease-in-out') return 'inOut'
  if (value === 'ease') return 'ease'
  const match = CUBIC_BEZIER.exec(value)
  if (match === null) throw new Error(`unsupported easing token: ${value}`)
  return [Number(match[1]), Number(match[2]), Number(match[3]), Number(match[4])]
}

export const motionEasing = {
  out: parseEasing(motion.easing.out.value) as CubicBezier,
  pop: parseEasing(motion.easing.pop.value) as CubicBezier,
  press: parseEasing(motion.easing.press.value) as CubicBezier,
  inOut: 'inOut' as const,
  linear: 'linear' as const,
}

function asOutcome(value: string | undefined): ReducedMotionOutcome {
  if (
    value === 'crossfade' ||
    value === 'instant' ||
    value === 'static' ||
    value === 'keep' ||
    value === 'keepColour' ||
    value === 'none' ||
    value === 'scrubber'
  ) {
    return value
  }
  return 'keep'
}

function readDuration(token: object): number {
  if ('duration' in token && typeof token.duration === 'number') return token.duration
  if ('totalMs' in token && typeof token.totalMs === 'number') return token.totalMs
  return 0
}

function readEasing(token: object): string {
  return 'easing' in token && typeof token.easing === 'string' ? token.easing : 'linear'
}

function readStagger(token: object): number {
  return 'stagger' in token && typeof token.stagger === 'number' ? token.stagger : 0
}

function readLoop(token: object): boolean {
  return 'loop' in token && token.loop === true
}

function readReducedMotion(token: object): ReducedMotionOutcome {
  return asOutcome(
    'reducedMotion' in token && typeof token.reducedMotion === 'string'
      ? token.reducedMotion
      : undefined,
  )
}

export function withToken(name: MotionTokenName): MotionSpec {
  const token =
    name in motion.animation
      ? motion.animation[name as AnimationName]
      : motion.transition[name as TransitionName]
  return {
    durationMs: readDuration(token),
    easing: readEasing(token),
    reducedMotion: readReducedMotion(token),
    loop: readLoop(token),
    staggerMs: readStagger(token),
  }
}

export const sheetUp = withToken('sheetUp')
export const popIn = withToken('popIn')
export const stepIn = withToken('stepIn')
export const fadeIn = withToken('fadeIn')
export const flip = withToken('flip')
export const grow = withToken('grow')
export const eqBars = withToken('eqB')
export const pulseRing = withToken('pulseRing')
export const wordUnblur = withToken('wordUnblur')
export const warmingBand = withToken('warmingCard')

export function barJump(tempoMs: number): MotionSpec {
  return { ...withToken('barJump'), durationMs: tempoMs }
}

export function pressScale(feedback: PressFeedback): PressScaleSpec {
  const token = motion.press[feedback]
  return {
    scale: token.scale,
    durationMs: token.duration,
    opacity: 'opacity' in token ? token.opacity : undefined,
  }
}

export function reducedMotionPlan(outcome: ReducedMotionOutcome): {
  readonly kind: ReducedMotionOutcome
  readonly durationMs: number
  readonly spatial: boolean
  readonly loop: boolean
  readonly glow: boolean
} {
  switch (outcome) {
    case 'crossfade':
      return {
        kind: outcome,
        durationMs: REDUCED_MOTION_CROSSFADE_MS,
        spatial: false,
        loop: false,
        glow: false,
      }
    case 'instant':
      return { kind: outcome, durationMs: 0, spatial: false, loop: false, glow: false }
    case 'static':
      return { kind: outcome, durationMs: 0, spatial: false, loop: false, glow: false }
    case 'keep':
      return { kind: outcome, durationMs: -1, spatial: true, loop: true, glow: true }
    case 'keepColour':
      return { kind: outcome, durationMs: -1, spatial: false, loop: false, glow: false }
    case 'none':
      return { kind: outcome, durationMs: 0, spatial: false, loop: false, glow: false }
    case 'scrubber':
      return { kind: outcome, durationMs: 0, spatial: false, loop: false, glow: false }
  }
}

/** First `#rrggbb` in a generated token, including gradient stops. */
export function tokenHex(value: string): string {
  const match = /#[0-9a-fA-F]{6}/.exec(value)
  if (match === null) throw new Error('generated colour token did not contain a hex stop')
  return match[0]
}

function parseGlow(glow: string): { glowRadius: number; glowOpacity: number } {
  const radius = /(\d+)px rgba\(/i.exec(glow)
  const opacity = /rgba\([^)]+,\s*([0-9.]+)\)/i.exec(glow)
  return {
    glowRadius: radius === null ? 0 : Number(radius[1]),
    glowOpacity: opacity === null ? 0 : Number(opacity[1]),
  }
}

function stopFromBand(
  at: number,
  band: { readonly bg: string; readonly text: string; readonly glow: string },
): WarmingStop {
  return {
    at,
    background: tokenHex(band.bg),
    text: band.text,
    ...parseGlow(band.glow),
  }
}

/** Real automaticity domain: cold 0, warm 33, hot 66, peak 100. */
export function warmingStops(): readonly WarmingStop[] {
  const bands = scale.warming
  return [
    stopFromBand(0, bands.cold),
    stopFromBand(33, bands.warm),
    stopFromBand(66, bands.hot),
    stopFromBand(100, bands.peak),
  ]
}

export function clampAutomaticity(value: number): number {
  if (value < 0) return 0
  if (value > 100) return 100
  return value
}
