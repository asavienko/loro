/**
 * Documented Refrain numbers for `@loro/core` test doubles.
 *
 * Canonical computation lives in `packages/core-rs/src/select.rs` and is asserted through
 * WASM in `apps/mobile/src/lib/core.test.ts`. `fakeCore()` looks these up; it does not
 * reimplement the formulae. Unknown inputs throw so a new call site cannot go green on a
 * second algorithm.
 *
 * Blueprint: Loro.dc.html:3353–3360 (modes), 3378 (automaticity). Set size is the
 * daily-minutes bands documented beside the Refrain helpers. Remaining
 * planning/recording pairs used by `@loro/core` engine tests follow the same
 * automaticity contract.
 */

export type FixtureRefrainMode = 'echo' | 'chorus' | 'speed' | 'cloze' | 'call' | 'cold'

const AUTOMATICITY = new Map<string, number>([
  ['0,6', 0],
  ['1,6', 17],
  ['2,6', 33],
  ['3,6', 50],
  ['4,6', 67],
  ['5,6', 83],
  ['6,6', 100],
  ['12,6', 100],
  ['3,0', 0],
])

const SET_SIZE = new Map<number, number>([
  [5, 3],
  [10, 5],
  [20, 8],
])

const MODE_FOR_REP = new Map<number, FixtureRefrainMode>([
  [0, 'echo'],
  [1, 'chorus'],
  [2, 'speed'],
  [3, 'cloze'],
  [4, 'call'],
  [5, 'cold'],
  [99, 'cold'],
])

const MODEL_RATE = {
  echo: 0.95,
  chorus: 0.95,
  speed: 1.15,
  cloze: null,
  call: null,
  cold: null,
} as const satisfies Record<FixtureRefrainMode, number | null>

const BEAT_MS = {
  echo: 720,
  chorus: 720,
  speed: 340,
  cloze: 720,
  call: 720,
  cold: 720,
} as const satisfies Record<FixtureRefrainMode, number>

function automaticityKey(reps: number, target: number): string {
  return `${reps},${target}`
}

function missingFixture(label: string, input: string): never {
  throw new Error(`fakeCore has no ${label} fixture for ${input}`)
}

function isFixtureMode(mode: string): mode is FixtureRefrainMode {
  return Object.hasOwn(MODEL_RATE, mode)
}

/** `min(100, round(reps / target * 100))`, or 0 when the target is 0. Loro.dc.html:3378. */
export function fixtureAutomaticity(reps: number, target: number): number {
  const pct = AUTOMATICITY.get(automaticityKey(reps, target))
  return pct ?? missingFixture('automaticity', `(${reps}, ${target})`)
}

/** Daily-minutes bands: ≤5 → 3, ≤10 → 5, else 8. */
export function fixtureRefrainSetSize(dailyMinutes: number): number {
  return SET_SIZE.get(dailyMinutes) ?? missingFixture('refrainSetSize', `${dailyMinutes}`)
}

/** Echo → Chorus → Speed → Cloze → Call, then Cold. Loro.dc.html:3353–3360. */
export function fixtureModeForRep(repIndex: number): FixtureRefrainMode {
  return MODE_FOR_REP.get(repIndex) ?? missingFixture('modeForRep', `${repIndex}`)
}

/** Echo/Chorus 0.95, Speed 1.15; Cloze/Call/Cold withhold the model. */
export function fixtureModelRateForMode(mode: string): number | null {
  return isFixtureMode(mode) ? MODEL_RATE[mode] : missingFixture('modelRateForMode', mode)
}

/** Speed 340 ms; every other manner 720 ms. */
export function fixtureBeatMsForMode(mode: string): number {
  return isFixtureMode(mode) ? BEAT_MS[mode] : missingFixture('beatMsForMode', mode)
}
