/**
 * Everything the writer varies by slot comes from a hash of the slot, never from a random source
 * (plan 112 §3): the same slot builds the same request twice, and two slots in one situation build
 * different ones.
 */
import { createHash } from 'node:crypto'

export function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

/** A stable hash of any JSON value: keys sorted, so field order in a file does not matter. */
export function hashJson(value: unknown): string {
  return sha256(canonical(value))
}

export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`
  }
  return JSON.stringify(value)
}

/** A small integer from a hash and a label, for picking from a list deterministically. */
export function pickIndex(seed: string, label: string, size: number): number {
  if (size <= 0) throw new Error('nothing to pick from')
  const digest = sha256(`${seed}:${label}`)
  return Number.parseInt(digest.slice(0, 8), 16) % size
}

/** `n` distinct items of `pool` chosen by the seed: the same every time, different per seed. */
export function pickSome<T>(pool: readonly T[], seed: string, label: string, n: number): T[] {
  const left = [...pool]
  const out: T[] = []
  for (let i = 0; out.length < n && left.length > 0; i += 1) {
    const index = pickIndex(seed, `${label}:${i}`, left.length)
    out.push(...left.splice(index, 1))
  }
  return out
}

const BASE32 = 'abcdefghijklmnopqrstuvwxyz234567'

/**
 * A phrase id: `<code>-<7 base32>`, from the set and the text at the moment of acceptance and never
 * recomputed afterwards (ADR-0017). Seven characters give 2^35 ids per course.
 */
export function phraseId(code: string, setId: string, target: string): string {
  const bytes = createHash('sha256').update(`${setId}\n${target}`, 'utf8').digest()
  let bits = 0
  let acc = 0
  let out = ''
  for (const byte of bytes) {
    acc = (acc << 8) | byte
    bits += 8
    while (bits >= 5 && out.length < 7) {
      out += BASE32.charAt((acc >> (bits - 5)) & 31)
      bits -= 5
    }
    if (out.length === 7) break
  }
  return `${code}-${out}`
}

export const MOODS = [
  'in a hurry',
  'relaxed',
  'unsure what to choose',
  'a regular who knows the place',
  'with a friend',
] as const
export const ACT_ORDERS = [
  'greet, ask, choose, pay',
  'ask what there is, decide, add something, thank',
  'order for two, change the order, ask for something extra',
  'ask about availability, decline an offer, order, pay',
] as const

export interface VariationCard {
  mood: string
  actOrder: string
  /** The three words that anchor the first phrases. */
  anchors: string[]
}

/**
 * What makes two slots of one situation ask different questions, derived from the slot id. The
 * time and place stay the brief's: the card never contradicts the scene.
 */
export function variationCard(setId: string, mustUse: readonly string[]): VariationCard {
  return {
    mood: MOODS[pickIndex(setId, 'mood', MOODS.length)] ?? MOODS[0],
    actOrder: ACT_ORDERS[pickIndex(setId, 'acts', ACT_ORDERS.length)] ?? ACT_ORDERS[0],
    anchors: pickSome(mustUse, setId, 'anchor', 3),
  }
}
