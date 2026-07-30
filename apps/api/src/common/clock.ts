/**
 * The server's clock, injected.
 *
 * `Date.now()` was called five times inside the sync endpoint, three of them building
 * strings that go out on the wire (`server_hlc`, `next`, `server_time`) and one deciding
 * a tombstone's timestamp. Injecting it makes those assertable and keeps the repo's
 * one-clock rule true on this side too — it is only ESLint-enforced under
 * `apps/mobile` (see apps/mobile/src/lib/clock.ts).
 *
 * NOT `@loro/core`'s `Clock`, deliberately. That interface also requires `localDay()`
 * and `streakDay()`, which are the DEVICE's local calendar keys: the device owns day
 * boundaries so they keep working offline, and a server-side implementation of them
 * would be an invitation to compute a learner's day in the wrong timezone
 * (docs/architecture/scheduling.md#two-day-keys-not-one). The server needs an instant
 * and nothing else, so it asks for an instant and nothing else.
 */

export interface ServerClock {
  /** Epoch milliseconds. */
  now(): number
}

/** Nest DI token. */
export const SERVER_CLOCK = Symbol('ServerClock')

/** The real clock. The only place in `apps/api` that reads the wall clock. */
export const systemClock: ServerClock = {
  now: () => Date.now(),
}
