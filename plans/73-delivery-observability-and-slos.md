# Delivery, observability, rollout, rollback, and SLOs

- **Requirement IDs:** M0 delivery leftovers, M2 store release, M4 operations, `F-09`
- **Milestone:** M2 → M4
- **Status:** Not started
- **Depends on:** 58 native builds, 66 deployable API, 72 release gates

## Outcome

The exact tested artifacts move through dev/staging/production and app stores with privacy-safe
crash/API visibility, staged rollout, rollback, runbooks, and offline-aware SLOs.

## Work

1. Deploy the plan-66 image and required managed dependencies to dev, then promote immutable
   artifacts/config through staging/prod with infrastructure ownership, backups, restore drills, and
   secret rotation.
2. Configure EAS/native signing, version/build numbers, internal distribution, store metadata,
   review privacy declarations, OTA compatibility policy, staged rollout, kill switches, and
   rollback.
3. Integrate crash reporting and structured logs/traces/metrics with redaction, sampling,
   environment tags, release IDs, offline buffering, and source maps/symbols.
4. Define service and learner SLIs: crash-free sessions, sync convergence, content freshness,
   auth/API availability, audio-asset availability, and local practice success. Do not page on a
   learner being offline.
5. Add alert thresholds, burn rates, dashboards, ownership, escalation, dependency/content/schema/
   auth/sync rollback runbooks, and blameless postmortem feedback.
6. Add nightly production-bundle/native smoke, migration rehearsal, dependency/image scan, restore,
   and synthetic API checks.

## Acceptance criteria

- Dev is reachable and production promotion uses the same tested immutable artifact.
- Rollback/roll-forward is rehearsed for API, schema, content pack, native release, and compatible
  OTA.
- Crash/problem telemetry contains no raw audio/transcript or forbidden learner data.
- Alerts map to actionable runbooks and respect the offline-first product boundary.

## Out of scope

24/7 staffing before traffic justifies it, product analytics design, and feature implementation.
