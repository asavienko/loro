/** Real playback settings Stream already supports: loop count and `play` rate. */

export const CADENCE_LOOPS = [1, 2, 3] as const
export const CADENCE_RATES = [0.8, 0.92, 1] as const

export type CadenceLoop = (typeof CADENCE_LOOPS)[number]
export type CadenceRate = (typeof CADENCE_RATES)[number]

export const DEFAULT_CADENCE_LOOP: CadenceLoop = 1
/** The rate Stream already used for a single play. */
export const DEFAULT_CADENCE_RATE: CadenceRate = 0.92

export function nextCadenceLoop(current: CadenceLoop): CadenceLoop {
  const index = CADENCE_LOOPS.indexOf(current)
  return CADENCE_LOOPS[(index + 1) % CADENCE_LOOPS.length] ?? DEFAULT_CADENCE_LOOP
}

export function nextCadenceRate(current: CadenceRate): CadenceRate {
  const index = CADENCE_RATES.indexOf(current)
  return CADENCE_RATES[(index + 1) % CADENCE_RATES.length] ?? DEFAULT_CADENCE_RATE
}

/** Visible rate token. `1` is shown as `1.0` so it cannot collide with loop `1×`. */
export function cadenceRateLabel(rate: number): string {
  return rate === 1 ? '1.0' : String(rate)
}
