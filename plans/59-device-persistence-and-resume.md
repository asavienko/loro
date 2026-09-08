# Device SQLite as source of truth, with hydration and resume

- **Requirement IDs:** `F-02`, `F-03`, `F-04`, `LB-01`…`LB-10`
- **Milestone:** M1
- **Status:** 🟡 Native/browser SQLite, safe course writes, hydration, atomic progress/outbox and
  session resume are implemented. Broader upgrade/crash/timezone/erasure and physical-device
  acceptance remain; those checks need the device harness and lifecycle UI.
- **Depends on:** 54 completed; 58 for the device driver; consume the implemented language/course
  contracts from 87.
- **Reviewed:** 2026-09-08 during plan-94 integration; release gates below remain explicit.

## Implemented scope

The app opens OP-SQLite on native and SQL.js on web, migrates existing schemas and hydrates all
courses before routes render. Repository transactions commit before Zustand publishes projections;
settings, target-local day/session state and global streak state retain their separate ownership.
Course saves use owned-column conflict updates, preserving clocks and tombstones.

Durable snapshots include session transitions, deletion Undo and sync metadata. Browser storage uses
atomic local-storage snapshots and an exclusive tab lock. A failed write or unreadable database
shows recovery without resetting learner data. Tests exercise real SQLite and browser relaunch.
Android airplane-mode force-stop/cold-launch smoke preserved onboarding, a completed rep and the
next Refrain step; all-platform/all-course acceptance is not implied.

## Outcome

The mobile app reads durable state from on-device SQLite, writes through repositories and outbox in
one transaction, and resumes practice after process death without mirroring durable truth in
Zustand.

## Remaining work

1. [ ] Expand native acceptance to fresh install/upgrade, all seven language pairs, midnight and
       timezone changes, transaction interruption and process death at each checkpoint boundary.
2. [ ] Verify account/lifecycle erasure and restore flows when plan 67 supplies their UI and policy;
       keep migration recovery non-destructive.
3. [ ] Validate large libraries and long-running writes against device performance budgets.
4. [ ] Complete content-version activation and phrase preservation with plan 61; current bundled
       seeding is idempotent, while independent content delivery remains a separate integration.

## Acceptance criteria

- App relaunch preserves phrase identity, settings, day/streak state, session progress, and outbox.
- No durable field has a second Zustand source of truth or manual refresh path.
- Every write succeeds locally without awaiting the network.
- Migration failure is recoverable/diagnosable and never silently deletes learner data.

## Out of scope

Remote sync transport, auth, audio cache files, and trip-specific tables beyond approved schema
needs.
