/**
 * Row ids for the app.
 *
 * The generator lives in `@loro/core` (pure, injected time and entropy). This file is
 * the platform half: where the entropy actually comes from on a phone.
 *
 * ── The entropy situation, stated plainly ──
 * `crypto.getRandomValues` exists in Node and on the web, so every test and
 * `expo start --web` gets a real CSPRNG. It does **not** exist in Hermes: React Native
 * ships no WebCrypto, and `expo-crypto` is a native module that cannot be installed
 * before the dev client exists (plans/09-native-toolchain-and-dev-client.md). On device,
 * the seeded fallback below is what runs.
 *
 * What the fallback does and does not give:
 *   • Unique within a device — yes. The sequence does not repeat.
 *   • Unique across devices — in practice: a UUIDv7 also carries the millisecond, so a
 *     collision needs two devices to add a phrase in the same millisecond *and* to have
 *     started with the same seed.
 *   • Unpredictable — NO. Nothing here may be used for a token, a key, a session id, or
 *     anything an attacker should be unable to guess. When `expo-crypto` lands, delete
 *     the fallback rather than extending it.
 */

import { createUserPhraseIds, type IdSource, type UserPhraseId } from '@loro/core'
import { deviceClock } from './clock'

/** splitmix32 — small, fast, and well-distributed enough to fill id bytes. */
function seededByteStream(): (n: number) => Uint8Array {
  let state = mix32(deviceClock.now() >>> 0, subMillisecondNoise())

  const nextUint32 = (): number => {
    state = (state + 0x9e37_79b9) >>> 0
    let z = state
    z = Math.imul(z ^ (z >>> 16), 0x21f0_aaad) >>> 0
    z = Math.imul(z ^ (z >>> 15), 0x735a_2d97) >>> 0
    return (z ^ (z >>> 15)) >>> 0
  }

  return (n) => {
    const out = new Uint8Array(n)
    for (let i = 0; i < n; i += 4) {
      const word = nextUint32()
      for (let b = 0; b < 4 && i + b < n; b++) {
        out[i + b] = (word >>> (b * 8)) & 0xff
      }
    }
    return out
  }
}

/**
 * Sub-millisecond process uptime, so two devices launching in the same millisecond
 * still seed differently. `performance.now()` is present in Hermes; the fallback to 0
 * is for a runtime that lacks it, and costs only seed diversity.
 */
function subMillisecondNoise(): number {
  const highRes = globalThis.performance as { now?: () => number } | undefined
  return Math.trunc((highRes?.now?.() ?? 0) * 1000) >>> 0
}

function mix32(a: number, b: number): number {
  return (a ^ Math.imul(b, 0x9e37_79b1)) >>> 0
}

const fallbackBytes = seededByteStream()

export const deviceIdSource: IdSource = {
  now: () => deviceClock.now(),
  bytes: (n) => {
    const webCrypto = globalThis.crypto as
      { getRandomValues?: <T extends Uint8Array>(a: T) => T } | undefined
    if (typeof webCrypto?.getRandomValues === 'function') {
      return webCrypto.getRandomValues(new Uint8Array(n))
    }
    return fallbackBytes(n)
  },
}

/**
 * A fresh row id for a phrase the learner just took on.
 *
 * One shared generator, so ids stay strictly increasing even when a batch is minted in
 * the same millisecond — which is exactly what onboarding does with the starter set.
 */
export const newId: () => UserPhraseId = createUserPhraseIds(deviceIdSource)
