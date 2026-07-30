# Durable settings, privacy-safe telemetry, flags, and the loop experiment

- **Requirement IDs:** `F-05`, `F-06`, `F-08`, `F-09`, `LB-27`, `P3-12`; measurement for `Q-01`,
  `Q-02`, `Q-03`, `Q-05`, `Q-06`
- **Milestone:** M2/M3
- **Status:** Infrastructure not started; experiment blocked on Q-05 owner/decision/sample
- **Depends on:** 59 settings persistence, 68 identity/sync boundaries

## Outcome

Learners control privacy, audio/speech, theme/accessibility, notifications, downloads, account, and
practice settings. Typed allowlisted events answer named product questions; deterministic flags can
run the approved loop experiment without changing data meaning or shaming learners.

## Work

1. Define the settings schema, defaults, migrations, device-vs-account scope, sync policy, reset,
   and lossless engine switching. Persist onboarding answers that currently disappear.
2. Build settings/practice/privacy/download/debug routes through the navigation and design systems.
3. Define typed event names/properties, consent, retention, redaction, local queue, upload budgets,
   deletion/export, and banned fields. Audio/transcripts/phrase text are denied by default.
4. Implement deterministic flag assignment and exposure logging with offline cache, safe defaults,
   kill switches, debug override, and server configuration validation.
5. Resolve Q-05 before activation: owner, decision, common outcome, guardrails, sample, duration,
   stopping rule, and migration after winning/ending an arm.
6. Test migrations, offline queue/retry, consent changes, erasure, assignment stability,
   cross-device consistency, no-event control, and engine-switch preservation.

## Acceptance criteria

- Settings survive relaunch/sync and can be changed without losing progress or an active session.
- Static/runtime gates reject sensitive event fields and unregistered flags.
- An experiment cannot start without exposure, common outcome, guardrails, owner, and stop rule.
- Disabled/unknown/expired flags choose documented safe product behavior.

## Out of scope

Ad-tech tracking, raw audio analytics, pricing experiments, and Run/Phrasebook implementation.
