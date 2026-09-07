# Delivery, observability, rollout, rollback, and SLOs

- **Requirement IDs:** M0 delivery leftovers, M2 store release, M4 operations, `F-09`
- **Milestone:** M2 → M4
- **Status:** 🟡 Delivery/nightly workflow scaffolds and readiness checks exist. Deployment
  evidence, operational diagnostics, restore/rollback and SLO enforcement remain; needs the
  deployable slices of 58/66 and release evidence from 72.
- **Depends on:** 58 native artifacts; 66 exact API image; 72 applicable release gates; 86
  infrastructure/diagnostic adapters.
- **Reviewed:** 2026-09-07 against merged baseline `2d9e8c3`.

## Verified starting point

`.github/workflows/{api-deploy,_deploy,mobile-build,nightly}.yml` contain scaffolding and TODO
steps. Repository evidence does not establish a deployed dev service, device farm, production
restore or crash dashboard. Distinguish skipped/unconfigured jobs from completed delivery; connect
the existing health/readiness seams.

Plan [88](88-low-cost-backend-infrastructure.md) owns the approved single-EC2 AWS testing profile,
manual deployment and testing recovery. This plan retains later production delivery and operations;
it does not require separate managed dev/staging infrastructure before testing can begin.

## Outcome

The exact tested artifacts move through dev/staging/production and app stores with privacy-safe
crash/API visibility, staged rollout, rollback, runbooks, and offline-aware SLOs.

## Remaining work

1. [ ] Deploy the plan-66 image and required managed dependencies to dev, then promote immutable
       artifacts/config through staging/prod with infrastructure ownership, backups, restore drills,
       and secret rotation.
2. [ ] Configure EAS/native signing, version/build numbers, internal distribution, store metadata,
       review privacy declarations, OTA compatibility policy, staged rollout, kill switches, and
       rollback.
3. [ ] Integrate crash reporting and structured logs/traces/metrics with redaction, sampling,
       environment tags, release IDs, offline buffering, and source maps/symbols.
4. [ ] Define service and learner SLIs: crash-free sessions, sync convergence, content freshness,
       auth/API availability, audio-asset availability, and local practice success. Do not page on a
       learner being offline.
5. [ ] Add alert thresholds, burn rates, dashboards, ownership, escalation,
       dependency/content/schema/ auth/sync rollback runbooks, and blameless postmortem feedback.
6. [ ] Replace delivery/nightly TODO jobs with production-bundle/native smoke, migration rehearsal,
       dependency/image scans, restore and synthetic API checks. Coordinate 60's missing simulation
       target and 72's release wiring; an echo, skip or missing target cannot establish an SLO.

## Acceptance criteria

- Dev is reachable and production promotion uses the same tested immutable artifact.
- Rollback/roll-forward is rehearsed for API, schema, content pack, native release, and compatible
  OTA.
- Crash/problem telemetry contains no raw audio/transcript or forbidden learner data.
- Alerts map to actionable runbooks and respect the offline-first product boundary.

## Out of scope

24/7 staffing before traffic justifies it, product analytics design, and feature implementation.
