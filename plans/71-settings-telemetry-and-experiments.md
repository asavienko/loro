# Durable settings, privacy-safe telemetry, flags, and the loop experiment

- **Requirement IDs:** `F-05`, `F-06`, `F-08`, `F-09`, `LB-27`, `P3-12`; measurement for `Q-01`,
  `Q-02`, `Q-03`, `Q-05`, `Q-06`
- **Milestone:** M2/M3
- **Status:** 🟡 Language, installation-local privacy, accent and motion preferences persist through
  SQLite. General Settings exposes those supported controls; telemetry and remote flags remain. The
  event queue/transport is not implemented. Only experiment activation waits on Q-05.
- **Depends on:** 59 durable settings; 56/81 routes; 67/68 only for account-scoped sync; 86 for
  telemetry/config transport; 87 implemented language selection.
- **Reviewed:** 2026-09-09 against `aafa61f`; current source, tests and retained review records
  inspected. This plan refresh supplies no new runtime, device or deployment acceptance.
- **Priority:** 5; local Settings/privacy controls with 57.

## Verified starting point

`apps/mobile/app/languages.tsx`, the reactive copy adapter and atomic languagePair already exist.
`apps/mobile/src/store/engines.ts` supplies local resolution/flag seams. General Settings now
exposes accent, motion and analytics consent; no event upload pipeline exists. `src/data/learner.ts`
saves and hydrates onboarding goal, level, dailyMinutes and the language pair through SQLite. Reuse
language/course settings from 87. Do not wait for the entire sync plan to build local
privacy/preferences.

## Outcome

Learners control privacy, audio/speech, theme/accessibility, notifications, downloads, account, and
practice settings. Typed allowlisted events answer named product questions; deterministic flags can
run the approved loop experiment without changing data meaning or shaming learners.

Language selection is implemented separately in plan 87. Reuse its language-pair contract and
course-session repositories when wiring durable settings; do not recreate an independent setting.

## Remaining work

1. [ ] Define the settings schema, defaults, migrations, device-vs-account scope, sync policy,
       reset, and lossless engine switching. Extend the existing durable onboarding fields in
       `src/data/learner.ts` (goal, level and dailyMinutes), rather than adding another persistence
       path; preserve languagePair as one atomic value and keep session/course changes lossless.
2. [ ] Build settings/practice/privacy/download/debug routes through the navigation and design
       systems.
3. [ ] Define typed event names/properties, consent, retention, redaction, local queue, upload
       budgets, deletion/export, and banned fields. Audio/transcripts/phrase text are denied by
       default.
4. [ ] Implement deterministic flag assignment and exposure logging with offline cache, safe
       defaults, kill switches, debug override, and server configuration validation.
5. [ ] Resolve Q-05 before activation: owner, decision, common outcome, guardrails, sample,
       duration, stopping rule, and migration after winning/ending an arm.
6. [ ] Test migrations, offline queue/retry, consent changes, erasure, assignment stability,
       cross-device consistency, no-event control, and engine-switch preservation.

## Acceptance criteria

- Settings survive relaunch/sync and can be changed without losing progress or an active session.
- Static/runtime gates reject sensitive event fields and unregistered flags.
- An experiment cannot start without exposure, common outcome, guardrails, owner, and stop rule.
- Disabled/unknown/expired flags choose documented safe product behavior.

## Delivery order and gates

1. Deliver a reachable general Settings surface and privacy consent control using existing SQLite
   onboarding/language/device-preference writes. Register the route and each state through 56/81.
   Persist before rendering success; show recoverable write failures. Prove changes and consent
   revocation survive relaunch without changing course, progress or active checkpoints. With 57,
   expose only preferences backed by working runtime capabilities; downloads/audio controls follow
   their actual owners rather than appearing as nonfunctional settings.
2. Classify every new setting as device-local or account-scoped before migration. Add merge policy
   only for syncable fields, then integrate 67/68; local settings must work without sign-in.
3. Deliver allowlisted telemetry queue/transport and safe flag defaults separately from Settings.
   The existing consent field defaults off and enables no collector by itself. Test that revocation
   stops collection, clears pending events according to policy and prevents in-flight retry from
   resuming uploads. Align deletion/export with 67 and transport with 86. Q-05 gates experiment
   activation; no consent field may authorize recorded-audio upload or restore the excluded legacy
   cloud-ASR/voice-clone fields.

## Out of scope

Ad-tech tracking, raw audio analytics, pricing experiments, and Run/Phrasebook implementation.

## Delivered slice — 2026-09-09

`F-05`/`F-06`: version 1 device preferences now store analytics consent, off by default, in the
existing SQLite `kv` table via `src/data/learner.ts`. This is installation-local, excluded from
settings sync/outbox, and does not grant audio/transcript upload permission. Missing, malformed or
unsupported versions read as consent off; no SQL migration is needed for the existing key/value
table. Reset clears consent. The store action commits before publishing and preserves current
course/progress state. Existing onboarding and atomic language-pair settings retain their owner.

Real SQLite tests cover relaunch, durable revocation, absent/malformed/future data, reset, outbox
exclusion, progress preservation, and write-failure rollback. This is a persistence seam only: there
is no Settings consent control, event collection/queue, retention/export/erasure pipeline, remote
flag assignment or experiment activation yet. Theme, audio, notification and practice preferences
remain separately scoped work.

## Delivered Settings UI slice — 2026-09-09

`/settings` is reachable from the shared menu and More. It links to the existing language-pair flow,
offers the generated Coral/Sunset/Teal/Berry accents and system/reduced motion through the real
runtime provider, and exposes the existing analytics-consent control. Version 2 device preferences
migrate version-1 consent, remain installation-local and never enter the sync outbox. Audio,
downloads, notifications, telemetry transport, flags, experiments and dark theme remain outside this
slice.
