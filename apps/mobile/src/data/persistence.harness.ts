import { openMemoryPersistence, openSqlPersistence, type Clock, type Persistence } from '@loro/core'
import { openNodeSqlite } from './driver.node'

export const AT = 1_785_231_660_000
export const DAY = '2026-07-28'

/** A deterministic stand-in for production HLC ticks (`hlc_tick` is already bridged). */
export function fakeHlc(): () => string {
  let n = 0
  return () => `${String(AT)}:${String(n++).padStart(4, '0')}:test`
}

/** The store needs a clock injected; nothing here reads a wall clock. */
export const storeClock: Clock = { now: () => AT, localDay: () => DAY, streakDay: () => DAY }

/** The same suite against both implementations: SQL on device, memory on web. */
export const implementations: [string, () => Persistence][] = [
  ['sqlite', () => openSqlPersistence(openNodeSqlite(), fakeHlc(), AT)],
  ['memory', () => openMemoryPersistence()],
]
