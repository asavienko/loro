# SLOs, alerting, and runbooks

- **Requirement IDs:** the M4 observability scope
- **Milestone:** M4 (but the signals come from M2)
- **Spec:** `docs/process/incident-response.md`, `docs/architecture/observability.md`
- **Size:** M
- **Depends on:** [observability-and-analytics.md](32-observability-and-analytics.md),
  [api-postgres-persistence.md](13-api-postgres-persistence.md),
  [ci-cd-and-release.md](16-ci-cd-and-release.md)

## Current state

`docs/process/incident-response.md` documents severities, on-call, comms, and postmortems. None of
it is wired: there is no deployed API ([ci-cd-and-release.md](16-ci-cd-and-release.md)), no metrics
emission, no alerting, and no dashboards. M4's scope names "Observability: SLOs, alerting,
runbooks".

So today an incident would be detected by a learner telling someone.

## What makes this app's SLOs unusual

Offline-first changes what "available" means, and the difference is worth stating before picking
numbers:

- **A sync outage is not a learner-facing outage.** The device is the source of truth; every write
  succeeds locally. So sync availability is an _internal_ SLO with a long error budget, and the
  learner-facing symptom only appears after days of failure (a second device diverging).
- **The learner-facing SLIs live on the device**, not the server: cold-launch time, crash-free
  sessions (≥99.5% across the device matrix is an M2 exit criterion), audio start success, ASR
  availability. Those come from the mobile telemetry pipeline.
- **The AI endpoints degrade rather than fail** — the bundled fallback means an outage is a quality
  regression, not an error. So the SLI is _fallback rate_, not error rate, and a 100% fallback rate
  would otherwise look perfectly healthy.

Getting these definitions right is most of the value in this plan. A conventional "99.9% HTTP
availability" SLO would monitor the least learner-relevant thing in the system.

## The work

### 1. Define SLIs and SLOs, per surface

Candidates, to be agreed rather than assumed:

| Surface  | SLI                                              | Why it matters                                   |
| -------- | ------------------------------------------------ | ------------------------------------------------ |
| App      | Crash-free sessions                              | M2 exit criterion, ≥99.5%                        |
| App      | Cold launch p95                                  | The <2 s airplane-mode bar                       |
| App      | Outbox oldest-op age p99                         | The real "is sync working" signal                |
| Sync API | Push/pull success rate, p95 latency              | M4 bar: p95 under 800 ms at 2 000 phrases        |
| Sync     | Conflict rate per `(entity, field, mergeClass)`  | Validates the merge classes against real traffic |
| AI       | Fallback rate, cache hit rate, cost per learner  | Degradation and cost, not errors                 |
| Content  | Pack fetch success, staleness                    | Content ships independently of the app           |
| Auth     | Sign-in success rate, token refresh failure rate | The one flow that can lock someone out           |

Each gets an error budget and a documented consequence when it is exhausted.

### 2. Alerting that respects the offline model

Alert on **symptoms with learner impact**, not on every anomaly:

- Page for: sync failure rate sustained, auth failures, database unavailability, cost ceiling
  breached, crash rate spike after a release.
- Ticket (do not page) for: elevated conflict rate, elevated AI fallback rate, content staleness.
- Never page for: individual request failures, a single client's retries, expected offline
  behaviour.

Every alert links to its runbook. An alert with no runbook is a 3am research project.

### 3. Runbooks for the failure modes this system actually has

Write them for the specific things that can go wrong here, not generic ones:

- **The WASM merge missing from the image.** The readiness check already catches it
  (`apps/api/src/health/health.controller.ts`) — the runbook is what to do when readiness fails for
  that reason, and it should be short because the check makes diagnosis trivial.
- **Merge divergence** between server WASM and device UniFFI. Highest-severity possible incident: it
  loses learner data silently. Detection (the cross-runtime golden test,
  [sync-client-loop.md](15-sync-client-loop.md)), containment (stop accepting pushes for the
  affected entity), and recovery.
- **A bad content pack** reaching devices. Rollback path and blast radius.
- **A bad OTA bundle.** Revert, and how to tell it apart from a native issue that OTA cannot fix.
- **AI cost runaway.** The ceiling should make this a ticket, not an incident — verify that.
- **Clock-skew storm** — many clients with wrong clocks producing bad HLCs. The `server_time` field
  exists to detect it (`apps/api/src/sync/sync.controller.ts`).
- **Database migration failure mid-deploy.**

### 4. On-call, sized honestly

`ways-of-working.md` describes a team of 2 mobile, 1 backend, 1 shared designer, 1 part-time content
lead. A 24/7 rotation is not available from that team, and pretending otherwise is worse than a
stated best-effort policy. Write down the real coverage, the real response expectations, and what
learners are told — the offline-first architecture is what makes best-effort defensible, and that
argument should be in the doc.

### 5. Postmortems, and the loop back

Blameless, with actions tracked to closure. The specific thing worth adding for this product: any
incident that touched **learner data** or **a number shown to a learner** gets a non-negotiable
review — did we violate rule 2 or lose a rating? That is the class of failure this codebase's design
is built to prevent, so an incident there is a signal about the design, not just the operation.

## Acceptance criteria

- SLIs and SLOs defined per surface, with error budgets and agreed consequences.
- Dashboards exist for every SLI and someone looks at them weekly.
- Alerts fire on learner-impacting symptoms only; each links to a runbook.
- A runbook exists for each failure mode listed above.
- On-call coverage is written down honestly, matching the actual team.
- A merge-divergence detection mechanism exists and its runbook has been rehearsed.
- Postmortem template includes the non-negotiables check.
- One rollback and one incident have been rehearsed before launch, not after.

## Tests

- Alert-firing tests (synthetic failure injection in staging).
- A rehearsal, documented — the only real test of a runbook.

## Risks

- **Alert fatigue** kills the whole system. Start with fewer alerts than feel comfortable and add on
  evidence.
- **SLOs copied from a stateless web service** would measure the wrong things here. The
  offline-first reasoning above is the guard against that; write it into the doc so the next person
  does not "fix" it.

## Out of scope

Status pages and customer comms tooling. `incident-response.md` covers the comms policy.
