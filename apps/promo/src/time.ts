// Time in the video is in seconds, as the timeline gives it; these turn it into motion.
import { Easing, interpolate, spring, useCurrentFrame } from 'remotion'
import timeline from './generated/timeline.json'

export const tl = timeline
export const FPS = timeline.fps
export type SceneName = keyof typeof timeline.scenes

/** The current time, in seconds. */
export const useTime = () => useCurrentFrame() / FPS

export const EASE = Easing.bezier(0.22, 1, 0.36, 1)
export const EASE_IN_OUT = Easing.bezier(0.65, 0, 0.35, 1)

/** 0 → 1 over `dur` seconds from `start`, eased and held at the ends. */
export function prog(t: number, start: number, dur: number, easing = EASE) {
  return interpolate(t, [start, start + dur], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing,
  })
}
/** A spring that starts at `at` seconds. */
export function springAt(
  t: number,
  at: number,
  config: { damping?: number; stiffness?: number; mass?: number } = {},
) {
  return spring({
    frame: Math.round((t - at) * FPS),
    fps: FPS,
    config: { damping: 14, stiffness: 120, mass: 0.8, ...config },
  })
}
export const mix = (a: number, b: number, p: number) => a + (b - a) * p

/** A scene's window, with how far it has come in and gone out. */
export function sceneWindow(t: number, name: SceneName, enter = 0.6, exit = 0.45) {
  const s = timeline.scenes[name]
  const end = s.from + s.duration
  return {
    from: s.from,
    end,
    visible: t >= s.from - 0.3 && t < end + 0.15,
    in: prog(t, s.from - 0.15, enter),
    out: prog(t, end - exit, exit, EASE_IN_OUT),
  }
}

/** Keyframed values, eased between frames. */
export function keyframes<T extends Record<string, number>>(
  t: number,
  frames: ({ t: number } & T)[],
  easing = EASE_IN_OUT,
): T {
  const i = frames.findIndex((f) => f.t > t)
  if (i === 0) return frames[0]
  if (i === -1) return frames[frames.length - 1]
  const a = frames[i - 1]
  const b = frames[i]
  const p = easing((t - a.t) / (b.t - a.t))
  const out = {} as Record<string, number>
  for (const k of Object.keys(a)) if (k !== 't') out[k] = mix(a[k as keyof T], b[k as keyof T], p)
  return out as T
}
