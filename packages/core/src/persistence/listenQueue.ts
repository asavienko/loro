/** Device-local listen-queue order. Not catalog rank, not FSRS, not a sync entity. */
import { isTargetLocale, type TargetLocale } from '../domain/languages.js'

export const LISTEN_QUEUE_VERSION = 1 as const
export const LISTEN_QUEUE_KEY_PREFIX = 'listen_queue:'

const MAX_BYTES = 1_000_000
const MAX_ITEMS = 2_000
const MAX_ID = 1_024

export interface ListenQueue {
  readonly version: typeof LISTEN_QUEUE_VERSION
  readonly targetLocale: TargetLocale
  readonly phraseIds: readonly string[]
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function keys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key))
}

function phraseId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_ID
}

function queue(value: unknown): value is ListenQueue {
  if (
    !record(value) ||
    !keys(value, ['version', 'targetLocale', 'phraseIds']) ||
    value.version !== LISTEN_QUEUE_VERSION ||
    typeof value.targetLocale !== 'string' ||
    !isTargetLocale(value.targetLocale) ||
    !Array.isArray(value.phraseIds) ||
    value.phraseIds.length === 0 ||
    value.phraseIds.length > MAX_ITEMS ||
    !value.phraseIds.every(phraseId)
  )
    return false
  return new Set(value.phraseIds).size === value.phraseIds.length
}

export function listenQueueKey(targetLocale: TargetLocale): string {
  return `${LISTEN_QUEUE_KEY_PREFIX}${targetLocale}`
}

/** Fail-closed builder. Empty, duplicate or unknown-locale lists never persist. */
export function buildListenQueue(input: {
  readonly targetLocale: TargetLocale
  readonly phraseIds: readonly string[]
}): ListenQueue | null {
  const value: ListenQueue = {
    version: LISTEN_QUEUE_VERSION,
    targetLocale: input.targetLocale,
    phraseIds: input.phraseIds,
  }
  return queue(value) ? value : null
}

/** Unknown versions and malformed/truncated data are discarded, never cast into a playlist. */
export function decodeListenQueue(raw: string): ListenQueue | null {
  if (raw.length > MAX_BYTES) return null
  try {
    const value: unknown = JSON.parse(raw)
    return queue(value) ? value : null
  } catch {
    return null
  }
}

export function encodeListenQueue(value: ListenQueue): string {
  if (!queue(value)) throw new Error('Invalid listen queue')
  const raw = JSON.stringify(value)
  if (raw.length > MAX_BYTES) throw new Error('Listen queue exceeds storage limit')
  return raw
}

/**
 * Overlay a learner playlist on a Rust-ranked active list.
 * Missing ids drop. Newcomers append in ranked order. Null stored means ranked as-is.
 */
export function applyListenOrder<T extends { readonly id: string }>(
  ranked: readonly T[],
  stored: readonly string[] | null,
): readonly T[] {
  if (stored === null) return ranked
  const byId = new Map(ranked.map((item) => [item.id, item]))
  const seen = new Set<string>()
  const ordered: T[] = []
  for (const id of stored) {
    const item = byId.get(id)
    if (item === undefined || seen.has(id)) continue
    seen.add(id)
    ordered.push(item)
  }
  for (const item of ranked) {
    if (seen.has(item.id)) continue
    ordered.push(item)
  }
  return ordered
}

/**
 * Move one id. `frozenBefore` keeps Now Playing and Earlier fixed.
 * No-ops and out-of-range moves return null so a handle never persists a no-change.
 */
export function moveListenItem(
  phraseIds: readonly string[],
  from: number,
  to: number,
  frozenBefore = 0,
): string[] | null {
  if (
    !Number.isSafeInteger(from) ||
    !Number.isSafeInteger(to) ||
    from < frozenBefore ||
    to < frozenBefore ||
    from >= phraseIds.length ||
    to >= phraseIds.length ||
    from === to
  )
    return null
  const next = [...phraseIds]
  const [item] = next.splice(from, 1)
  if (item === undefined) return null
  next.splice(to, 0, item)
  return next
}
