# Offline: prefetch, survival mode, and the airplane-mode test

- **Requirement IDs:** `F-03`, `P5-09`…`P5-11`
- **Milestone:** M2 — the first M2 exit criterion, and on the **never cut** list
- **Spec:** `docs/architecture/offline.md`
- **Size:** L
- **Depends on:** [sqlite-persistence-and-outbox.md](10-sqlite-persistence-and-outbox.md),
  [audio-playback-module.md](11-audio-playback-module.md)

## The bar

`docs/product/roadmap.md`, M2 exit criteria, first item:

> **The airplane-mode test:** airplane mode, fresh launch, survival mode fully usable in **<2 s**.

And the framing from `CLAUDE.md`: _offline-first is not a feature._ The device is the source of
truth; every write succeeds locally and appends to an outbox; **no code path awaits the network.**

Today the app is accidentally offline-capable because it has no network code. The persistence
schema, repositories, and outbox now exist and are tested against real SQLite, but the app store is
not hydrated from them and there is no on-device driver. It therefore still fails the "fresh launch"
half of the test: a restart loses the in-memory learner state.

## The work

### 1. Make "no code path awaits the network" enforceable

A stated rule that nothing checks will be broken by the third contributor. Options, cheapest first:

- A lint rule: `fetch`/`axios`/HTTP clients may only be imported inside `src/data/remote/**` and the
  sync service. The repo already lint-enforces layer boundaries
  (`docs/architecture/mobile-app.md#layers`), so this is an extension of an existing mechanism.
- A test harness that runs the app's screens with the network stubbed to reject, and fails if any
  render or interaction throws or hangs.
- An offline CI job that boots the app with no network and drives the primary flows.

### 2. Prefetch policy

`docs/architecture/offline.md` has it. What must be resident before the learner is offline:

- The active library's audio (catalog audio or pre-synthesised TTS), at the rates actually used.
- Today's and tomorrow's Refrain sets, and the next N trip drops.
- Bundled roleplay scenes (already bundled server-side — `apps/api/src/ai/ai.service.ts`; bundle
  them client-side too).
- Reference data for any phrase the labs will offer.

Policy details that decide whether this is loved or hated: cellular vs Wi-Fi (default Wi-Fi only,
with an explicit override), a visible size budget, and an **honest readiness state** — "ready for
offline" must mean it, verified by checking the files exist, not by assuming the download succeeded.

### 3. Survival mode (screen 20)

The screen you open standing at a counter with no signal: the phrases you need _right now_, found in
one tap, with audio. Design constraints follow from the situation, not from taste — large targets,
no typing, works one-handed, works in bright sunlight (contrast), and works with the phone on silent
(so text, not only audio).

### 4. Cold launch under 2 s

This is a performance requirement, not an offline one, and it is where most of the engineering goes:

- Hydrate a **working set** only
  ([sqlite-persistence-and-outbox.md](10-sqlite-persistence-and-outbox.md) §3); defer the long tail.
- No network call on the launch path — not even a fire-and-forget one that blocks a render.
- Measure on the floor device in `docs/process/qa-device-matrix.md`, cold (not warm), and put the
  number in `docs/architecture/performance.md` with how it was measured. A budget without a
  measurement method is a wish.

### 5. Degradation, stated honestly

Some things genuinely need the network: sign-in, live AI, content pack updates, sync. Each needs a
specific offline state that says what is unavailable and what still works — never a generic "no
internet" screen over a working app, and never a spinner that resolves to nothing.

`Availability` in the engine contract already models `degraded`/`unavailable` with a reason
(`packages/core/src/engines/types.ts:219`). Use the same vocabulary in the UI so the states are
consistent across screens.

### 6. Write-path guarantees

Every mutation offline: succeeds locally, appears immediately in the UI, appends to the outbox, and
never shows a "saved" confirmation that depends on the server. Test with the network down for a
simulated week.

## Acceptance criteria

- Airplane mode + fresh launch + survival mode usable in <2 s on the floor device, measured and
  recorded.
- The offline CI job passes: every primary flow completes with the network rejecting.
- No import of an HTTP client outside the sanctioned modules — lint-enforced.
- Prefetch is Wi-Fi-only by default with a visible, accurate size budget.
- "Ready for offline" is verified against the filesystem, not assumed.
- A week offline: 100+ mutations all succeed locally, all queued in order, none lost, and one
  reconnection drains them.
- Every network-dependent feature has a specific degraded state naming what still works.
- Survival mode is usable one-handed with no typing.

## Tests

- The offline CI job (above) — the highest-value test in this plan.
- Cold-launch timing test on device, tracked over time so a regression is visible.
- Prefetch tests: interrupted download, partial file, disk full, cache eviction under pressure.
- A long-offline simulation (mutations across simulated days, then reconnect).
- The airplane-mode acceptance test, scripted so it can be re-run every release rather than
  remembered.

## Risks

- **Disk full** is a real device state and the usual cause of corrupt caches. Handle it explicitly:
  degrade prefetch, never fail a write of learner data.
- **"It works on my machine with fast Wi-Fi"** — the prefetch path needs testing on a throttled,
  flaky connection, which is the actual condition abroad.

## Out of scope

Peer-to-peer sharing of content packs, and background download scheduling beyond what the platform
offers.
