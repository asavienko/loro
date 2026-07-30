# Fix the day boundary: `LOCAL_DAY()` returns a UTC date

- **Requirement IDs:** `LB-01`, `LB-04`, `LB-22`, `F-03`
- **Milestone:** M1 (bug — ships before anything else that reads a day)
- **Size:** S
- **Non-negotiables touched:** #2 (every number shown to a learner is real)
- **Status:** ✅ Implemented 2026-07-29 — `apps/mobile/src/lib/clock.ts` (the only file that may
  construct a `Date`, ESLint-enforced), `Clock.streakDay()` alongside `localDay()`, TZ-swept tests
  in `clock.test.ts`, and the two keys documented in
  `docs/architecture/scheduling.md#two-day-keys-not-one`. **Step 2 landed without the UniFFI hop**:
  the app consumes no Rust yet (plans/09), so the grace-window arithmetic is a TS mirror in
  `packages/core/src/domain/calendar.ts`, held to the Rust by a shared fixture that both
  `calendar.test.ts` and `core-rs/tests/parity.rs` assert. Delete the mirror when the bridge lands —
  see plans/05.

## The problem

`apps/mobile/src/store/index.ts:134`:

```ts
const LOCAL_DAY = (): string => new Date().toISOString().slice(0, 10)
```

`toISOString()` is **UTC**. The `Clock` contract in `packages/core/src/engines/types.ts:148–151`
says the opposite, in as many words:

> `localDay(): string` — The device's **LOCAL** calendar date, 'YYYY-MM-DD'. Drives day boundaries
> offline.

Everything day-shaped reads this one function:

- `ensureRefrainSet()` (`store/index.ts:266`) — freezes the day's set. "You always see today."
- `recordRep()` (`store/index.ts:234`) — `repsTodayDay`, which gates `automaticity`.
- the `Clock` literal at `store/index.ts:300`, which hands `LOCAL_DAY` straight to every engine via
  `engineContext()` (`store/index.ts:342`). One wrong line reaches all of them.

Consequences today, for a learner in UTC+2 (Madrid — the app's own target market):

- Practising between 00:00 and 02:00 local writes reps against **yesterday's** day key, so
  `repsToday` resets to 0 and the warming card jumps backwards mid-session.
- The Refrain set re-rolls at 02:00 local, not midnight — a learner mid-ritual watches today's set
  change under them, which breaks the frozen-set promise.
- A learner in UTC−5 gets the mirror bug: the day rolls at 19:00 local.

`packages/core-rs/src/calendar.rs` already got this right and is unused by the app:
`streak_day_for(at_ms, local_midnight_ms)` (line 25) takes local midnight as a parameter precisely
because the crate has no clock, and `STREAK_GRACE_HOURS = 4` (line 16) encodes the "practising at
01:30 counts for yesterday" rule that the app currently does not implement at all.

## The work

### 1. One clock, in one place

Add `apps/mobile/src/lib/clock.ts` exporting the real `Clock`:

```ts
export const deviceClock: Clock = {
  now: () => Date.now(),
  localDay: () => {
    const d = new Date()
    // Local components, not UTC — the whole point.
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  },
}
```

Delete `LOCAL_DAY` from the store and take the clock from this module. The store must not construct
dates itself — that is how the bug got in.

### 2. Wire the grace window through `core-rs`

Expose `calendar::streak_day_for` over UniFFI and use it for the **streak** day key (which is what
it was written for), passing `local_midnight_ms` computed in `clock.ts`. Keep the plain `localDay()`
for the Refrain's frozen-set key — the set should roll at midnight, the streak should not. Document
the distinction in `docs/architecture/scheduling.md`, which already has a **Day boundaries** section
(`:326`) to extend; two different day keys is a real design decision and needs to be written down,
not inferred.

### 3. Make the bug unrepeatable

- Lint rule (or a `check:no-iso-day` script alongside `scripts/a11yChecks.ts`) that fails on
  `toISOString().slice(0, 10)` anywhere under `apps/mobile/`.
- ESLint `no-restricted-syntax` on `new Date()` outside `src/lib/clock.ts`, matching the existing
  convention that engines never call `Date.now()` (`packages/core/src/testing/index.ts:5`).

## Acceptance criteria

- `localDay()` returns the device's local date for every timezone in `TZ=` sweep tests.
- Practising at 00:30 UTC+2 increments `repsToday` against the current local day; the warming card
  does not reset.
- The Refrain set rolls exactly at local midnight.
- Streak day applies the 4-hour grace window, so a 01:30 session extends yesterday's streak.
- `pnpm check` green; the lint guard fails on a deliberately reintroduced `toISOString` day.

## Tests

`apps/mobile/src/lib/clock.test.ts` with `TZ` set per case (`UTC`, `Europe/Madrid`,
`America/New_York`, `Pacific/Kiritimati` for UTC+14, `Pacific/Marquesas` for the −09:30 half-hour
offset). Vitest respects `process.env.TZ` when set before the date is constructed — set it per
`describe` with `vi.stubEnv` plus a fresh module import, or run the file twice under different `TZ`
in the test script.

## Risks

- **Existing persisted day keys**: none, because nothing persists yet. Doing this _before_
  [SQLite persistence](10-sqlite-persistence-and-outbox.md) avoids a migration.
- **Timezone travel** — flying east skips a local day. `calendar::streak_survives` (line 54) already
  treats a negative gap as the same day; make sure the app path uses it rather than re-deriving.

## Out of scope

Server-side day computation (the server never decides a learner's day — see
`docs/architecture/offline.md`).
