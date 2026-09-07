# Incident response

**Testing response:** use the [backend testing runbook](../runbooks/backend-testing.md). The
selected single-instance environment has maintenance downtime, SNS email and verified restore
targets; monitoring and operator procedures are still to be implemented. The production pager,
status-page, store-release and regulatory response arrangements below are future policy, not
deployed services.

---

## Severities

| Sev    | Definition                                                                                                    | Response                    | Comms                                                             |
| ------ | ------------------------------------------------------------------------------------------------------------- | --------------------------- | ----------------------------------------------------------------- |
| **P0** | Recorded audio left the device · data loss or sync corruption · crash on launch · cross-tenant exposure       | Page immediately, all hands | Learner comms within 24 h; regulator within 72 h if personal data |
| **P1** | A core loop is broken for many learners · offline broken · sync down · auth down · a wrong score shown widely | Page, fix same day          | Status page; in-app notice if > 4 h                               |
| **P2** | A feature broken with a workaround · elevated errors · AI degraded                                            | Ticket, next business day   | Status page if learner-visible                                    |
| **P3** | Cosmetic, edge case, single-device                                                                            | Backlog                     | None                                                              |

### Automatically P0, regardless of scale

These are the ten rules' teeth in triage
([`../architecture/overview.md`](../architecture/overview.md#the-ten-rules)):

- Any recorded audio, or a derivative of it, leaving the device
- Any cross-tenant data exposure
- Any path that loses a learner's ratings, notes, or phrase library
- A sign-in that discards local data

One learner affected is enough. These aren't scaled by blast radius, because the failure is
categorical.

---

## On-call

Small team, so on-call is honest about its limits:

|            |                                                                                     |
| ---------- | ----------------------------------------------------------------------------------- |
| Rotation   | Weekly, backend + one mobile engineer                                               |
| Hours      | Business hours + best-effort out of hours. **We are not a 24/7 service, by design** |
| Paging     | P0/P1 only. P2+ goes to a channel                                                   |
| Escalation | 15 min unacknowledged → the other on-call; 30 min → tech lead                       |

**Why best-effort is defensible here:** the app is offline-first, so an API outage delays sync
rather than blocking learning ([ADR-0003](../architecture/adr/0003-offline-first-sqlite-sync.md)).
Production response objectives will be selected from testing evidence in plan 73
([backend objectives](../architecture/backend.md#slos)); the testing host has no production
availability guarantee.

The exception is a P0 privacy or data-loss incident, which is paged out of hours without
qualification.

---

## The flow

```
1 · DETECT     alert, learner report, or someone notices
2 · ACKNOWLEDGE within 15 min. Open an incident channel
3 · ASSESS     severity, blast radius, is it still happening?
4 · MITIGATE   stop the bleeding. Correctness before elegance
5 · COMMUNICATE status page / in-app / learner comms per severity
6 · RESOLVE    verify with real data, not just a green deploy
7 · POSTMORTEM within 3 working days for P0/P1
```

### Mitigation levers, in order of speed

| Lever                                  | Speed      | For                                              |
| -------------------------------------- | ---------- | ------------------------------------------------ |
| **Feature flag off**                   | Seconds    | A misbehaving feature. **Always try this first** |
| Halt the store rollout                 | Minutes    | A bad binary not yet widely installed            |
| OTA republish (previous JS)            | Minutes    | A bad JS release                                 |
| Rollback a schema-compatible API image | Minutes    | A bad backend deploy                             |
| Disable an endpoint                    | Minutes    | An abused or leaking endpoint                    |
| Ship a hotfix binary                   | Hours–days | A native bug already installed                   |

**Mitigate before diagnosing.** Turn it off, then find out why. A flag flip costs nothing and buys
the time to be careful.

### The OTA rollback trap

An OTA rollback can leave a **migrated database behind a downgraded binary**. The schema-floor check
catches it (the DB refuses to open and prompts for an app update rather than misreading data), but
check it explicitly during any OTA rollback
([release-versioning.md](release-versioning.md#the-rollback-trap)).

---

## Privacy incidents

Handled separately because the duties are legal, not just operational
([`../architecture/security-privacy.md`](../architecture/security-privacy.md#incident-response)).

|                                                                  | Response                                                                                                                                              |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P0 privacy** — audio left the device, or cross-tenant exposure | Disable the path immediately. Notify affected learners within 72 h. Regulator notification assessed same-day. **All feature work stops until closed** |
| **P1 privacy** — P1/P2 data exposed to an unauthorised party     | Same-day containment; assess notification duty                                                                                                        |
| **P2 privacy** — analytics captured data outside the allowlist   | Purge affected events, fix the allowlist, document                                                                                                    |

The audio-egress canary is what surfaces the worst case: a **P0 alert on any network request
originating in the audio module**, because there should never be one
([`../architecture/observability.md`](../architecture/observability.md#alerting)).

**A P0 privacy incident is the only class that halts all feature work.** The product's central trust
claim is printed on a screen; if it's broken, nothing else matters until it's fixed and explained.

---

## Communication

### Status page

Public, for P0/P1. What's affected, what still works, when we'll update next.

**Always say what still works**, because with an offline-first app the answer is usually "almost
everything":

> **Sync is unavailable** — 09:41 UTC Practice, listening, and your phrase library are working
> normally and your progress is being saved on your device. It will sync automatically when we're
> back. Next update at 10:15.

### In-app

Only for P1+ lasting over 4 hours, as a dismissible banner. Never a modal — never block someone's
practice to tell them about a problem that isn't affecting their practice.

### Learner comms

For P0, and for any privacy incident. Plain language, what happened, what data, what we did, what
they should do. Signed by a person.

**No euphemisms.** "A bug caused recordings from 40 learners to be uploaded to our servers; they
have been deleted and here's what we changed" — not "we identified an issue with our data handling".

---

## Postmortems

Within 3 working days for P0/P1. **Blameless**: the question is what made the mistake easy, not who
made it.

```markdown
# Postmortem · <date> · <one-line summary>

- Severity · Duration · Detected by · Learners affected

## Timeline

UTC, from first cause to resolution. Include what we thought was happening and when.

## Impact

What learners experienced. Data affected. Whether anything was lost.

## Root cause

The technical cause, and the process gap that let it reach production.

## What went well

Detection, mitigation, comms — name what worked so it's kept.

## What went badly

Honestly.

## Actions

| Action | Owner | Due | Type                        |
| ------ | ----- | --- | --------------------------- |
| …      | …     | …   | prevent / detect / mitigate |
```

### Rules

1. **Blameless.** Human error is a symptom; the cause is a system that permitted it.
2. **Every action has an owner and a date.** An action list with neither is a wish list.
3. **Prefer "prevent" and "detect" over "be more careful".** The audio-egress canary and the
   `latencyMs: number | null` type both came from asking "how do we make this impossible or loud?"
4. **Actions go into the next milestone**, not a backlog nobody reads.
5. **Published internally**, always. A postmortem nobody reads was a waste of the incident.

---

## Runbooks

[Backend testing operations](../runbooks/backend-testing.md) covers the selected EC2 environment. It
is a planned runbook until its commands and drills are verified. The following feature-specific
runbooks remain to be written when their implementations exist:

| Runbook               | Covers                                                         |
| --------------------- | -------------------------------------------------------------- |
| `sync-degraded`       | Conflict-rate spike, outbox backlog, rejected ops              |
| `db-recovery`         | Retained-volume recovery, S3 restore and connection exhaustion |
| `ai-budget-exceeded`  | Global cap hit; verify silent fallback is working              |
| `content-bad-publish` | Roll back `catalog_version`, purge the CDN                     |
| `ota-rollback`        | Republish previous, verify the schema floor                    |
| `store-rollout-halt`  | Halting on both platforms                                      |
| `audio-egress-alert`  | **The P0 canary** — how to confirm, contain, and assess duty   |
| `token-compromise`    | Revoke families, rotate signing keys                           |
| `cert-pin-rotation`   | Rotate pins without bricking clients                           |

The last one is worth writing early: a botched certificate-pin rotation bricks every installed app
and cannot be fixed by OTA, because OTA needs the network the pin just broke.

---

## Practice

Testing restore drills run before tester access and monthly under plan 88. Broader production game
days below follow implementation of the relevant features and plan-73 release policy; they do not
require a second staging stack now.

| Scenario                      | Tests                                                                     |
| ----------------------------- | ------------------------------------------------------------------------- |
| PostgreSQL host/volume fails  | Retained-data recovery or verified S3 restore, alerting and communication |
| A bad content publish         | Rollback and CDN purge                                                    |
| Sync returns 500 for 30 min   | Client behaviour: does the outbox survive and converge?                   |
| The audio-egress canary fires | The P0 path end to end, including the comms draft                         |
| Certificate pin rotation      | The one that could brick clients                                          |

The sync scenario is the most valuable, because it tests a client property we otherwise only assert:
that an outage delays sync and never loses data.
