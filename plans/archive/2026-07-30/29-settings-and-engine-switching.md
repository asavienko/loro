# Settings, and switching the practice loop

- **Requirement IDs:** `F-05`, `F-06`, `F-08`, `F-09`, `LB-27`, `P3-12`
- **Milestone:** M2 (basic settings) / M3 (engine switching)
- **Size:** M
- **Open questions:** Q-06 (setting or assignment?), Q-01 (rep target)

## Current state

There is no Settings screen. Settings that exist are hardcoded in the store:

- `dailyMinutes: 10` (`apps/mobile/src/store/index.ts:104`) — set once during onboarding, never
  editable.
- `waveTimes: ['08:00', '13:00', '19:00']` (line 356) — a literal in `engineContext()`.
- `repTarget: DEFAULT_REP_TARGET` (line 357).
- `flags: { bool: (_k, d) => d, number: (_k, d) => d }` (line 360) — every flag returns its default,
  so nothing is configurable and nothing is experimentable.
- `seed: 42` (line 362).

Meanwhile 21 screens' worth of features assume settings exist: accent theming (`F-05`), dark theme
(`F-06`), notification preferences, audio voice/rate, offline cache management, account, and the
engine choice.

## The design decision to make first

**Q-06: is the practice loop a setting or an assignment?** The leaning is recorded: assign a default
from the onboarding goal, allow switching in Settings, log switches as a signal — "implemented in
`resolveEngine`" per `docs/architecture/practice-engines.md#engine-resolution`. The caveat is also
recorded: a hybrid means the loop experiment has self-selection leakage, which Q-05's design must
account for.

So build the hybrid, and make the switch **observable** — every switch logged with from/to/when,
because that log is what makes the experiment analysable despite the leakage.

## The work

### 1. A real settings store

Persisted (`SettingsRepository` from
[sqlite-persistence-and-outbox.md](10-sqlite-persistence-and-outbox.md)), synced where it should be
(device-local vs account-level is a real distinction: notification times are device-local; the
engine choice is account-level), and each synced key declared in
`packages/core/src/sync/fieldPolicy.ts`.

Delete the literals from `engineContext()`. A setting read from a hardcoded object is a setting that
will be forgotten when the screen ships.

### 2. The screen

Group by what the learner is trying to do, not by subsystem:

- **Practice** — daily minutes (3/5/8 set size follows via `refrain_set_size`), wave times, the
  practice loop, rep target if exposed.
- **Audio** — voice, default rate, download-over-cellular, cache size and clear.
- **Notifications** — per category, matching `core-rs/src/notify.rs Category`. Wave nudges are
  "opt-out by default _and_ conditional" (`docs/architecture/widgets-notifications.md:129`), so the
  UI must express a conditional default honestly rather than as a plain toggle.
- **Appearance** — accent theme (Coral / Sunset / Teal / Berry, `F-05`) and dark theme (`F-06`).
  Contrast is already gated in CI across all four accents, so this is mostly plumbing the token
  pipeline through a runtime theme.
- **Account** — sign in, sync status, **delete account and data** (launch-blocking for store
  review).
- **Diagnostics** — outbox depth, last sync, cache size, a support bundle with no learner content.

### 3. Engine switching, done losslessly

The point of ADR-0006 and rule 5: switching engines loses nothing because every engine maintains
every signal. So the switch is genuinely just a resolution change — but verify it, because it is
easy to assume:

- A test that runs N sessions on engine A, switches to B, and asserts every progress signal is
  continuous and none reset.
- `resolveEngine` centralises the decision: assignment from the onboarding goal, learner override,
  flag override. One function, unit-tested against a table of inputs.
- `availability()` gates the list — an engine that needs a mic or missing reference data is shown as
  unavailable with a reason, not hidden (hiding it makes the app look like it lacks the feature).

### 4. A real flag provider

Replace the identity `flags` object with a provider that reads: local overrides (a debug screen),
remote config, and defaults, in that precedence. This unblocks
[experimentation-and-flags.md](33-experimentation-and-flags.md) and several flags that already exist
in the code but cannot be set — `prosody.levelUpThreshold` (`core-rs/src/dsp/score.rs:44`),
`refrain.repTarget` (Q-01), the ASR `fuzzy` flag (`core-rs/src/asr.rs`), and the new/old set mix.

### 5. Onboarding writes real settings

`completeOnboarding` (`store/index.ts:147`) already captures goal, minutes, and packs. Route them
through the settings store, and derive the assigned engine from the goal there — that is the one
place the assignment is legible.

## Acceptance criteria

- Every setting is persisted and survives relaunch; none is a literal in `engineContext()`.
- Changing daily minutes changes tomorrow's set size (and does **not** re-roll today's frozen set).
- Accent theme and dark theme apply app-wide with no colour literals and contrast gates green.
- Notification categories map to the real policy, including the conditional wave default.
- Delete-account works end to end.
- Engine switching preserves every progress signal, proven by test.
- Unavailable engines are visible with a reason.
- Flags are settable locally and remotely, with local winning.
- Every engine switch is logged with from/to/timestamp.

## Tests

- Settings persistence and sync-class coverage.
- `resolveEngine` table test: goal × override × flag.
- The lossless-switch test described above — this is the one that matters.
- Theme test across all four accents in light and dark.

## Out of scope

Q-01's actual answer (is 6 reps right?) — this plan makes it configurable and measurable; the
experiment answers it.
