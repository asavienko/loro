/**
 * Row id generation.
 *
 * The property that matters is not "looks like a uuid" but "two devices that both add
 * `cafe1` produce two different rows". That is what the old code got wrong, and it is
 * the last assertion in this file.
 */

import { describe, expect, it } from 'vitest'
import { createIdGenerator, newUserPhraseId, uuidV7, type IdSource } from './ids.js'

/** A source with no entropy at all — every byte is the same. */
const flat = (now: number, fill = 0xab): IdSource => ({
  now: () => now,
  bytes: (n) => new Uint8Array(n).fill(fill),
})

/**
 * A device with real entropy at a fixed instant.
 *
 * `crypto` is declared inline because this package compiles with `lib: ["ES2022"]` and
 * no DOM types — the same reason `apps/mobile/src/lib/ids.ts` narrows it by hand.
 */
const webCrypto = (
  globalThis as unknown as { crypto: { getRandomValues: <T extends Uint8Array>(a: T) => T } }
).crypto

const device = (ms: number): IdSource => ({
  now: () => ms,
  bytes: (n) => webCrypto.getRandomValues(new Uint8Array(n)),
})

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

describe('uuidV7', () => {
  it('is a well-formed uuid', () => {
    expect(uuidV7(flat(1_785_231_660_000))).toMatch(UUID)
  })

  it('declares version 7 and the RFC variant', () => {
    // Even with every random byte 0xab, the version nibble and variant bits are ours.
    const id = uuidV7(flat(1_785_231_660_000, 0xab))
    expect(id[14]).toBe('7') // version nibble
    expect(['8', '9', 'a', 'b']).toContain(id[19]) // variant 0b10xx
  })

  it('carries the timestamp in the leading 48 bits, big-endian', () => {
    const ms = 1_785_231_660_000
    const id = uuidV7(flat(ms))
    const prefix = id.slice(0, 8) + id.slice(9, 13)
    expect(parseInt(prefix, 16)).toBe(ms)
  })

  it('does not truncate a timestamp above 2^32', () => {
    // A 32-bit shift would silently drop the top bytes and put every id in 1970.
    const ms = 1_785_231_660_000
    expect(ms).toBeGreaterThan(2 ** 32)
    expect(uuidV7(flat(ms)).startsWith('00000000-')).toBe(false)
  })

  it('sorts lexicographically by the time it was created', () => {
    const ids = [0, 1, 1_000, 86_400_000, 1_785_231_660_000].map((ms) => uuidV7(flat(ms)))
    expect([...ids].sort()).toEqual(ids)
  })

  it('is reproducible from a deterministic source', () => {
    // The whole reason the source is injected: a test can pin it.
    expect(uuidV7(flat(42))).toBe(uuidV7(flat(42)))
  })

  it('clamps a negative clock instead of emitting a malformed id', () => {
    // A device with a clock behind the epoch is broken, but it must not corrupt ids.
    expect(uuidV7(flat(-1))).toMatch(UUID)
    expect(uuidV7(flat(-1)).startsWith('00000000-0000-7')).toBe(true)
  })

  it('refuses a source that under-delivers entropy rather than padding it', () => {
    const stingy: IdSource = { now: () => 1, bytes: () => new Uint8Array(2) }
    expect(() => uuidV7(stingy)).toThrow(/returned 2 bytes/)
  })
})

describe('createIdGenerator', () => {
  it('is strictly increasing within a single millisecond', () => {
    // The case that made this necessary: onboarding seeds the whole starter set in one
    // millisecond, and random rand_a put those rows in arbitrary order.
    const next = createIdGenerator(device(1_785_231_660_000))
    const ids = Array.from({ length: 500 }, next)
    expect([...ids].sort()).toEqual(ids)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('keeps increasing across a millisecond boundary', () => {
    let ms = 1_785_231_660_000
    const next = createIdGenerator({
      now: () => ms,
      bytes: (n) => webCrypto.getRandomValues(new Uint8Array(n)),
    })
    const ids: string[] = []
    for (let i = 0; i < 20; i++) {
      ids.push(next(), next())
      ms += 1
    }
    expect([...ids].sort()).toEqual(ids)
  })

  it('stays ordered when the counter overflows a millisecond', () => {
    // 4097 ids in one millisecond: rand_a wraps, so the generator borrows the next
    // millisecond rather than repeating a counter value.
    const next = createIdGenerator(device(1_785_231_660_000))
    const ids = Array.from({ length: 4_100 }, next)
    expect([...ids].sort()).toEqual(ids)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('stays ordered when the clock jumps backwards', () => {
    // NTP correction, or a learner changing the device clock. An id that sorts before
    // an existing one would break "most recent first" and, later, index locality.
    let ms = 1_785_231_660_000
    const next = createIdGenerator({
      now: () => ms,
      bytes: (n) => webCrypto.getRandomValues(new Uint8Array(n)),
    })
    const before = next()
    ms -= 60_000
    const after = next()
    expect(after > before).toBe(true)
  })

  it('is unique across 10 000 draws in the same millisecond', () => {
    const one = device(1_785_231_660_000)
    const seen = new Set(Array.from({ length: 10_000 }, () => uuidV7(one)))
    expect(seen.size).toBe(10_000)
  })
})

describe('newUserPhraseId', () => {
  it('gives two devices two different rows for the same catalog phrase', () => {
    // The bug this replaces: both devices used `cafe1` as the row id, so per-field LWW
    // keyed on `user_phrase:cafe1` merged two independent add events into one row with
    // interleaved fields — invisible until a second device exists.
    const sameMs = 1_785_231_660_000
    const a = newUserPhraseId(device(sameMs))
    const b = newUserPhraseId(device(sameMs))

    expect(a).not.toBe('cafe1')
    // Same millisecond, so the same time prefix — and still two distinct rows.
    expect(a.slice(0, 13)).toBe(b.slice(0, 13))
    expect(a).not.toBe(b)
  })
})
