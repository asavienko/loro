# Durable settings, privacy-safe telemetry, flags, and the loop experiment

- **Requirement IDs:** `F-05`, `F-06`, `F-08`, `F-09`, `LB-27`, `P3-12`; measurement for `Q-01`,
  `Q-02`, `Q-03`, `Q-05`, `Q-06`
- **Milestone:** M2/M3
- **Status:** 🟡 Language settings, copy resources and engine flag seams exist. General Settings,
  durable preferences, telemetry and remote flags remain; local settings work needs 59, while only
  experiment activation waits on Q-05.
- **Depends on:** 59 durable settings; 56/81 routes; 67/68 only for account-scoped sync; 86 for
  telemetry/config transport; 87 implemented language selection.
- **Reviewed:** 2026-09-09 against checkout `42f4d57`; source/plan review only, no new device or
  deployment acceptance.

## Verified starting point

`apps/mobile/app/languages.tsx`, the reactive copy adapter and atomic languagePair already exist.
`apps/mobile/src/store/engines.ts` supplies local resolution/flag seams; no general Settings route
or event upload pipeline exists. `src/data/learner.ts` already saves and hydrates onboarding goal,
level, dailyMinutes and the language pair through SQLite. Reuse language/course settings from 87. Do
not wait for the entire sync plan to build local privacy/preferences.

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

1. Extend current SQLite settings for local preferences and general Settings UI first. Reuse
   existing onboarding/language writes; coordinate theme values with 57 and route metadata with
   56/81.
2. Classify every new setting as device-local or account-scoped before migration. Add merge policy
   only for syncable fields, then integrate 67/68; local settings must work without sign-in.
3. Deliver allowlisted telemetry/consent and safe flag defaults separately. Align deletion/export
   with 67 and transport with 86. Q-05 gates experiment activation; no consent field may authorize
   recorded-audio upload or restore the excluded legacy cloud-ASR/voice-clone fields.

## Out of scope

Ad-tech tracking, raw audio analytics, pricing experiments, and Run/Phrasebook implementation.
