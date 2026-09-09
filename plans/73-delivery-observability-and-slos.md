# Production delivery, observability, rollout and SLOs

- **Requirement IDs:** M0 delivery leftovers, M2 store release, M4 operations, `F-09`
- **Milestone:** M2 → M4
- **Status:** 🟡 Workflow and health scaffolds exist. Production delivery, native release evidence
  and SLO enforcement remain; they need the relevant feature/release artifacts and testing evidence.
- **Depends on:** 58 native artifacts; 66 exact API image; 72 applicable release gates; 86 adapters;
  88 testing deployment/recovery evidence for backend production decisions.

- **Reviewed:** 2026-09-07 against merged backend foundations and the refreshed roadmap.

## Verified starting point

The API/mobile/release workflows still contain scaffolds and TODO steps. The repository does not
establish a deployed shared service, device farm or verified production restore. Plan 88 supplies
testing evidence; 58/66/72 supply the relevant native/API/release artifacts.

## Outcome and ownership

Release the exact tested artifacts to production and app stores, with privacy-safe diagnostics,
verified recovery and measured operating objectives. Plan 88 owns the low-cost EC2/PostgreSQL/S3
testing environment and its deployment, monitoring, cost controls and restore drills. Do not
implement a duplicate managed dev/staging stack here.

## Work

1. [ ] Use plan-88 load, cost, deployment and restore evidence to select production capacity,
       availability/recovery targets, data retention and promotion gates. Document the decision
       before provisioning production. Extra environments, managed databases, replicas, CDN and
       uninterrupted rollout must have an actual requirement.
2. [ ] Implement production promotion of immutable API artifacts with schema compatibility, verified
       rollback/roll-forward, secret rotation and release evidence. Do not count workflow echoes or
       skipped jobs as deployment.
3. [ ] Configure EAS/native signing, version/build numbers, internal distribution, store metadata,
       privacy declarations, OTA compatibility, staged store rollout, halt and rollback.
4. [ ] Add privacy-safe crash reporting and API diagnostics through plan 86. Reuse testing logs and
       metrics; add traces and domain dashboards only when their producer and consumer exist.
5. [ ] Define service and learner SLIs for implemented features: crash-free sessions, sync
       convergence, content freshness, auth and local practice success. Choose alert routing and
       response ownership; do not page merely because a learner is offline.
6. [ ] Turn applicable release/nightly scaffolds into real checks, including native smoke, migration
       rehearsal, image/dependency scans and production recovery drills. Coordinate shared harnesses
       with 72 and feature tests with their owning plans.

Local preparation exists under plan 88: the backup-bundle verifier and recovery-drill record make
integrity evidence explicit without asserting an off-host upload or restore. Production recovery
objectives remain unselected until an isolated testing drill supplies the corresponding evidence.

## Acceptance criteria

- Production uses the same verified immutable artifact and a documented promotion/recovery policy.
- API, schema, content and native/OTA rollback or roll-forward are rehearsed where implemented.
- Diagnostics contain no recorded audio, transcript, learner text or secrets.
- Alerts reach an identified owner and link to a verified runbook.
- Production objectives are measured; testing availability is not presented as a production SLO.

## Out of scope

Rebuilding plan 88, requiring 24/7 staffing before demand justifies it, product analytics design,
feature implementation and speculative 100k-MAU infrastructure.
