/**
 * Branded id types. Passing a catalog id where a user-phrase id is expected is a
 * compile error, which matters because the two are joined constantly and mixing
 * them up would silently read the wrong row.
 */

declare const brand: unique symbol
type Brand<T, B extends string> = T & { readonly [brand]: B }

/** A catalog phrase id — 'cafe1'. Immutable forever. */
export type CatalogPhraseId = Brand<string, 'CatalogPhraseId'>

/** A learner's row id — uuid. NOT the catalog id. */
export type UserPhraseId = Brand<string, 'UserPhraseId'>

export type UserId = Brand<string, 'UserId'>
export type DeviceId = Brand<string, 'DeviceId'>
export type TripId = Brand<string, 'TripId'>
export type SessionId = Brand<string, 'SessionId'>
export type PackId = Brand<string, 'PackId'>
export type ScenarioId = Brand<string, 'ScenarioId'>
export type SceneId = Brand<string, 'SceneId'>

export const catalogPhraseId = (s: string): CatalogPhraseId => s as CatalogPhraseId
export const userPhraseId = (s: string): UserPhraseId => s as UserPhraseId
export const userId = (s: string): UserId => s as UserId
export const deviceId = (s: string): DeviceId => s as DeviceId
export const tripId = (s: string): TripId => s as TripId
export const sessionId = (s: string): SessionId => s as SessionId
export const packId = (s: string): PackId => s as PackId
export const scenarioId = (s: string): ScenarioId => s as ScenarioId
export const sceneId = (s: string): SceneId => s as SceneId

// ─────────────────────────────────────────────────────────────────────────────
// Generating a row id
//
// The casts above are identity functions: they exist to mark a boundary where a
// string is *parsed* into an id, and they should appear at deserialisation points,
// never mid-logic. `userPhraseId(catalogPhrase.id)` type-checks and is a bug — the
// learner's row id is not the content team's phrase id. It collides under sync (two
// devices adding the same phrase produce one row with interleaved fields), it leaves
// learner-authored phrases with no id at all, and it orphans rows when the catalog
// retires an id.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A source of time and entropy for id generation.
 *
 * Injected rather than reached for. The engine contract forbids ambient
 * nondeterminism (`engines/types.ts`) and the conformance suite makes `Math.random`
 * throw, so an id minted from a global at the point of use is neither reproducible in
 * a test nor honest about what it depends on.
 */
export interface IdSource {
  /** Epoch milliseconds. */
  now(): number
  /** Exactly `n` random bytes. */
  bytes(n: number): Uint8Array
}

/** 2^48 − 1 ms ≈ the year 10889. Past that a UUIDv7 timestamp cannot be represented. */
const MAX_UUID_MS = 281_474_976_710_655

/** rand_a is 12 bits, so the intra-millisecond counter wraps at 4096. */
const MAX_COUNTER = 0xfff

/**
 * Assemble a UUIDv7 (RFC 9562): 48-bit big-endian epoch-ms, version, 12 bits of
 * `rand_a`, variant, then 62 bits of `rand_b`.
 */
function assemble(ms: number, randA: number, randB: Uint8Array): string {
  if (randB.length < 8) {
    throw new Error(`IdSource.bytes returned ${randB.length} bytes, need 8`)
  }
  const bytes = new Uint8Array(16)

  // Big-endian 48-bit timestamp, written with division rather than `>>`: bit shifts
  // coerce to 32 bits, which would silently drop the top two bytes and date every id
  // to 1970.
  let remaining = Math.min(Math.max(Math.trunc(ms), 0), MAX_UUID_MS)
  for (let i = 5; i >= 0; i--) {
    bytes[i] = remaining % 256
    remaining = Math.floor(remaining / 256)
  }

  // Version 7 in the high nibble of byte 6; the rest of bytes 6–7 is rand_a.
  bytes[6] = 0x70 | ((randA >>> 8) & 0x0f)
  bytes[7] = randA & 0xff

  for (let i = 0; i < 8; i++) bytes[8 + i] = randB[i] ?? 0
  // Variant 0b10 in the high bits of byte 8.
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-')
}

/**
 * A single UUIDv7, with random `rand_a`.
 *
 * Ordered across milliseconds but **not within one**: two ids minted in the same
 * millisecond sort in random order. For anything that mints more than one id — a batch
 * add, a seeded starter set — use `createIdGenerator`, which makes ordering total.
 */
export function uuidV7(src: IdSource): string {
  const rand = src.bytes(10)
  if (rand.length < 10) {
    throw new Error(`IdSource.bytes(10) returned ${rand.length} bytes`)
  }
  const randA = (((rand[0] ?? 0) << 8) | (rand[1] ?? 0)) & MAX_COUNTER
  return assemble(src.now(), randA, rand.subarray(2))
}

/**
 * A generator whose ids are **strictly increasing**, even within a millisecond.
 *
 * RFC 9562's monotonic-counter method: `rand_a` holds a counter that resets whenever
 * the millisecond changes. This is what makes "ids sort by add time" true without an
 * asterisk — which the Add screen relies on for "most recent first", and which keeps
 * SQLite inserts appending to the end of the primary-key index rather than scattering
 * across it (plans/10-sqlite-persistence-and-outbox.md).
 *
 * Stateful, so it is created once and shared. Two generators over the same clock give
 * no ordering guarantee relative to each other.
 */
export function createIdGenerator(src: IdSource): () => string {
  let lastMs = -1
  let counter = 0

  return () => {
    const now = Math.min(Math.max(Math.trunc(src.now()), 0), MAX_UUID_MS)
    if (now > lastMs) {
      lastMs = now
      counter = 0
    } else if (counter < MAX_COUNTER) {
      // Same millisecond (or a clock that went backwards): keep counting up.
      counter++
    } else {
      // 4096 ids inside one millisecond. Borrow from the next millisecond rather than
      // repeat a counter value — monotonicity matters more than an exact timestamp,
      // and at human speed this is unreachable.
      lastMs++
      counter = 0
    }
    return assemble(lastMs, counter, src.bytes(8))
  }
}

/**
 * A one-shot learner row id. NOT a catalog id.
 *
 * See `uuidV7` on intra-millisecond ordering; prefer `createUserPhraseIds` in an app.
 */
export function newUserPhraseId(src: IdSource): UserPhraseId {
  return uuidV7(src) as UserPhraseId
}

/** A shared, strictly-increasing source of learner row ids. */
export function createUserPhraseIds(src: IdSource): () => UserPhraseId {
  const next = createIdGenerator(src)
  return () => next() as UserPhraseId
}
