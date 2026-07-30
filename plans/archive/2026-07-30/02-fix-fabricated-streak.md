# Fix the fabricated streak counter

- **Requirement IDs:** `P4-01`, `LB-04`, `N-01`
- **Milestone:** M1 (bug — it violates a non-negotiable today)
- **Size:** S–M
- **Non-negotiables touched:** #2 (every number is real), #3 (no screen shames a missed day)
- **Status:** ✅ Implemented 2026-07-29 — `streakDays: 1` is gone. The store keeps a `practiceDays`
  history keyed on `clock.streakDay()`; the count is derived by `streak()` (Rust, mirrored in
  `@loro/core` and parity-tested), the seven-cell row draws the last seven **real** days from
  history, and zero or broken renders `—` / "start today" with neutral cells. Retention capped at
  400 days. Documented in `docs/product/functional-spec.md#15-progress` and
  `docs/architecture/data-model.md`.

## The problem

The streak is a hardcoded literal:

`apps/mobile/src/store/index.ts:143`

```ts
streakDays: 1,
```

Nothing ever writes it. `reset()` (line 274) does not even clear it. And it is rendered to the
learner as a fact, twice:

- `apps/mobile/app/progress.tsx:83–108` — "Current streak", the number, and a seven-cell row where
  `i < streak ? accent.accent : onDark.surface` paints filled days and `i < streak ? '🔥' : ''` adds
  flames.
- `apps/mobile/app/index.tsx:84` — the home surface.

So every learner sees "1 day, one flame" forever, regardless of what they did. That is a number
shown to a learner that is not real, which the repo's own rule 2 says is reverted rather than
discussed (`CLAUDE.md`, "The three non-negotiables"). It is also the _only_ number on Progress that
isn't derived from the phrase rows.

The maths already exists and is already tested — it is simply not called:

- `packages/core-rs/src/calendar.rs:54` `streak_survives(last_day, today)` — gap of 0 or 1 keeps it;
  negative gap (flying west) counts as the same day.
- `packages/core-rs/src/calendar.rs:25` `streak_day_for(at_ms, local_midnight_ms)` — applies
  `STREAK_GRACE_HOURS = 4`, so 01:30 counts for yesterday.

## The work

### 1. Store the practice-day history, not a count

A count cannot be recomputed after a gap, and cannot survive a clock change. Persist the set of
distinct **streak days** on which the learner completed at least one rep:

```ts
practiceDays: string[]   // 'YYYY-MM-DD', ascending, deduped
```

Append in `recordRep` using the streak day key from [the clock fix](01-fix-local-day-boundary.md).
Cap retention at 400 days (the Progress screen never shows more than a year) and note it in
`docs/architecture/data-model.md`.

### 2. Derive the streak

Add to `@loro/core` a pure `streak(practiceDays, today)` that walks backwards while
`streak_survives` holds, and expose the same function from `core-rs` so the widget (native, no JS)
computes the identical number — this is exactly the class of value ADR-0002 says must live in Rust.
The TS side calls it through the facade rather than re-implementing (see
[fix-shared-maths-duplication.md](05-fix-shared-maths-duplication.md)).

### 3. Make the seven-cell row honest

Today the row is `i < streak`, which is a bar chart pretending to be a calendar. Render the **last
seven local days** and fill each cell from `practiceDays` membership. That is the same visual for a
7-day streak and a truthful one for everything else.

### 4. Honour non-negotiable #3

An unfilled cell is neutral — no red, no "you broke it", no count-down copy. Check the wording
against `docs/design/copy-and-tone.md`. A streak of 0 renders the label without a number and without
apology (`—`, not `0 days 😞`). Add the empty and broken states to
`docs/product/functional-spec.md#15-progress`.

### 5. `reset()` must clear it

`store/index.ts:274` currently leaves `streakDays` and `dailyMinutes` behind — see
[fix-store-invariants.md](07-fix-store-invariants.md), which covers the whole reset surface.

## Acceptance criteria

- No literal streak value anywhere in `apps/mobile`.
- A fresh install shows a streak of 0 with no flame and no negative copy.
- One rep today → 1. A rep yesterday and today → 2. A two-day gap → 1, not 3.
- A 01:30 session extends yesterday's streak (grace window).
- Flying west across the date line does not break a streak.
- The seven-cell row reflects actual practice days, not `i < streak`.
- Rust and TS agree on the same `practiceDays` fixture (parity test).

## Tests

- `packages/core-rs/src/calendar.rs` — extend the existing 6 tests with a `streak()` table: empty,
  single day, contiguous run, one-day gap, two-day gap, grace-hour boundary, west-travel.
- `packages/core/src/…/streak.test.ts` — the same table, asserting identical output.
- A store test: `recordRep` twice on the same day appends one entry.

## Risks

- **Notification copy** reads the streak (`N-01`); check `core-rs/src/notify.rs` gating still holds
  when the streak can be 0.
- **Widget** shows the streak (`P5-06`) and cannot call JS — hence the Rust implementation.

## Out of scope

Streak freezes / repair purchases. That is a monetization surface and Q-08 is open.
