# Observability

Three questions this has to answer, in priority order:

1. **Is the app working?** (crashes, errors, performance)
2. **Is sync correct?** (the highest-consequence silent-failure mode — it loses learner data)
3. **Is the learning working?** (the question the whole product exists to answer)

Most apps only instrument #1. Loro's differentiators live in #2 and #3.

---

## Implementation boundary (current repository)

The testing baseline below is selected but not deployed. Later client/domain instrumentation is
feature design, not an inventory of running collectors or dashboards.

- The mobile app has no Sentry (or equivalent) SDK, analytics client, allowlist, event queue,
  diagnostics ring buffer, performance collector, or Rust-panic reporting bridge. The empty
  `EXPO_PUBLIC_SENTRY_DSN` example only reserves configuration.
- The API uses Nest's console logger and a global RFC 9457 exception filter. It has health and sync
  status endpoints, but no request correlation, structured allowlist logger, OpenTelemetry, metrics
  exporter, analytics ingest, dashboards, or alert routing.
- Sync currently uses an in-memory repository. There is no client sync worker or mobile outbox
  integration producing the outbox-age, conflict, claim, or merge signals described below.
- The learning metrics can be derived from domain records once persistence and consented analytics
  exist; there is currently no collection or warehouse path.

Examples, sampling rates, dashboards, SLOs, and alerts below are target contracts. They must not be
used as operational evidence until the producing path, privacy filter, backend sink, and alert test
all exist.

## Testing operations baseline

Plan 88 uses CloudWatch and SNS email for the single EC2 host. Implement bounded, allowlisted server
logs with seven-day retention; host memory/disk collection; instance/API health; CPU-credit
monitoring; backup-success age; and $25/$35 cost notifications. Missing heartbeat data is a failure.
Thresholds and responses live in the
[testing runbook](../runbooks/backend-testing.md#monitor-and-respond).

Do not add a tracing collector, warehouse, per-user metric dimensions, session replay or mobile
analytics just to host this environment. A host health check needs no learner text. Verify the
metric producer, retention and actual alert delivery before calling monitoring implemented.

The remaining client, sync and learning sections apply when those feature paths exist. Their example
sampling rates and product dashboards are not testing infrastructure requirements.

### Prerequisites for instrumentation

Start with a shared event catalog and a fail-closed property allowlist, covered by tests that feed
it phrase text, notes, transcripts, tokens, and audio-like values and prove they are rejected
**before queueing**. Add consent/opt-out and bounded local retention before adding any transport.
Crash reporting must disable attachments and default SDK data collection explicitly; native and Rust
events need the same scrubber as JavaScript events.

On the server, introduce correlation ids and structured allowlisted logging before traces or domain
metrics, then instrument actual persistence/sync boundaries rather than the current in-memory
stand-in. Each alert needs a synthetic or runbook test that demonstrates both that the signal fires
and that forbidden payload data is absent. The audio-egress control also needs enforcement at the
native module's network boundary; a dashboard query alone is not prevention.

## Client

### Crash and error reporting

|                  |                                                                                                               |
| ---------------- | ------------------------------------------------------------------------------------------------------------- |
| Tool             | Sentry (or equivalent) with native symbolication for iOS, Android, and the Rust core                          |
| Attachments      | **None.** No screenshots, no logs containing free text, no audio ([security-privacy.md](security-privacy.md)) |
| Breadcrumbs      | Navigation, engine transitions, audio-session events, sync attempts. **No phrase text**                       |
| User context     | `user_id` (or `anon_id`) and `device_id` only                                                                 |
| Release tracking | Version + build + OTA update id, so an OTA regression is distinguishable from a binary one                    |
| PII scrubbing    | Allowlist-based, applied before the event leaves the device                                                   |
| Rust panics      | Caught at the UniFFI boundary, reported as a distinct error class with the core's own version                 |

**Target: crash-free sessions ≥ 99.7%** ([`product/metrics.md`](../product/metrics.md#health)).

Panics in `loro-core` get their own class because they mean a scheduling or DSP invariant was
violated — a different kind of bug from a UI crash, and one that could be corrupting numbers rather
than just failing loudly.

### Structured client logs

Ring buffer, in memory, 500 entries, attached to **nothing** automatically. Available via Settings →
Diagnostics → Share (learner-initiated, and they see the content first).

```ts
log.info('engine.session.start', { engine: 'refrain', setSize: 5, offline: true })
log.warn('asr.unavailable', { reason: 'no_language_pack', fallback: 'reveal' })
log.error('sync.push.failed', { code: 'TIMEOUT', outboxDepth: 42, attempt: 3 })
```

Rules: event names are `namespace.thing.verb`; properties are scalars only; **no free text ever**,
so a shared diagnostic bundle can't leak a learner's notes.

### Performance telemetry

Sampled at 10% of sessions, aggregated client-side, sent as events:

| Signal                                | Why                                 |
| ------------------------------------- | ----------------------------------- |
| Cold/warm start to interactive        | The startup budget                  |
| Frame drops per screen, per animation | Catches the warming-card regression |
| Audio start latency                   | The "instant" perception threshold  |
| ASR finalisation latency              |                                     |
| DSP scoring latency, split by stage   | Which stage regressed               |
| DB query duration for the hot queries | Library-size scaling                |
| `loro-core` call durations            |                                     |
| Memory high-water mark per screen     |                                     |

Budgets and gates: [performance.md](performance.md).

---

<a id="sync-observability--the-highest-consequence-signal"></a>

## Sync observability — the highest-consequence signal

Sync fails silently by nature: the learner sees nothing, and the data quietly stops moving. So it
gets first-class treatment.

| Metric                                  | Alert threshold        | What it usually means                                           |
| --------------------------------------- | ---------------------- | --------------------------------------------------------------- |
| Sync success rate                       | < 98%                  | Network, auth, or a schema mismatch                             |
| **Conflict rate**                       | > 0.5% of merged rows  | **A field is in the wrong merge class** — a real data-loss risk |
| Outbox age p95                          | > 24 h                 | Sync has been broken for a cohort without anyone noticing       |
| Outbox depth p95                        | > 200 rows             | Sync is falling behind                                          |
| Rejected ops                            | any sustained non-zero | Client/server schema drift                                      |
| Push batch size p95                     | > 400 ops              | Falling behind, or a write storm                                |
| Claim/merge failures                    | any                    | Sign-in is losing data — **P0**                                 |
| Rows where `max`-class fields regressed | any                    | A merge-class bug                                               |

The last row is a **server-side invariant check** run nightly: for every `max`-class field, assert
it never decreased between snapshots. It's cheap and it catches the exact class of bug that would
silently lower a learner's `reps` ([sync-protocol.md](sync-protocol.md#per-field-lww)).

The conflict rate is the canary. Real concurrency (one learner, two devices) is rare, so a spike
almost always means a field is being LWW-merged that should be `max` or grouped — and because the
merge runs through one shared function, the fix is one change in `loro-core`.

---

## Learning-quality telemetry

The instrumentation nobody builds, and the reason we can eventually answer the loop question
([`product/practice-loops.md`](../product/practice-loops.md#how-well-actually-decide)).

| Signal                                                                        | Question it answers                                    |
| ----------------------------------------------------------------------------- | ------------------------------------------------------ |
| Retention at 30 days, via a common cold probe across all engines              | Which loop actually teaches?                           |
| Production latency trend by rep count                                         | Is automaticity real, or is the chart theatre?         |
| Predicted vs actual recall (FSRS calibration)                                 | Is our scheduler well-calibrated for _these_ learners? |
| **Tag predictiveness** — AUC of declared difficulty predicting recall failure | Is the connective thread real, or decoration?          |
| Score stability across takes of the same phrase                               | Is the DSP trustworthy?                                |
| Ladder rung vs 30-day retention                                               | Is the ladder measuring real depth?                    |
| Automaticity graduation rate                                                  | Is 6 reps / 4 days the right target?                   |
| Cue-level progression rate                                                    | Is 88 the right level-up threshold?                    |
| Phrase-level removal rate                                                     | Which catalog phrases are bad?                         |

Two of these deserve emphasis:

**FSRS calibration.** We plot predicted retrievability against observed recall in buckets. A
well-calibrated scheduler sits on the diagonal. If it doesn't, the parameters need re-optimising
against our own `review_log` — which is exactly why `review_log` is retained forever
([data-model.md](data-model.md)).

**Tag predictiveness.** If learner-declared difficulty doesn't predict failure, the central mechanic
of the product is decoration and we need drift correction (Q-03 in
[`product/learning-model.md`](../product/learning-model.md#open-pedagogical-questions)). This is the
single most important number in the learning dashboard.

---

## Server

### Logging

Structured JSON to stdout, collected by the platform.

```jsonc
{
  "level": "info",
  "ts": "2026-07-28T09:41:00.123Z",
  "trace_id": "4bf92f…",
  "span_id": "00f067…",
  "svc": "api",
  "route": "POST /v1/sync/push",
  "user_id": "usr_8f2c",
  "device_id": "dev_1a3b",
  "duration_ms": 187,
  "status": 200,
  "sync": { "ops": 12, "accepted": 12, "conflicts": 0 },
}
```

Redaction is **allowlist-based**: a field not on the allowlist for its log event is dropped. Never
logged: email, phrase text, notes, captured text, tokens, receipts.

### Tracing and domain metrics — deferred

Testing uses bounded logs and the small operational metric set above. Add request tracing or domain
metrics through plans 71/73/86 only when the real auth, database, sync or provider path exists and
its producer, privacy allowlist, sampling cost and consumer are verified. There is no required
OpenTelemetry collector or SLO burn-rate pipeline on the test host.

### Health

`GET /v1/health` is liveness. `GET /v1/health/ready` currently checks the real WASM merge; plan 66
adds database/schema checks before shared deployment. Use readiness and authenticated smoke checks
to reopen traffic after testing maintenance. Optional S3/provider failures must not disable
otherwise usable sync.

---

## Future product dashboards

| Dashboard                   | Audience              | Contents                                                                              |
| --------------------------- | --------------------- | ------------------------------------------------------------------------------------- |
| **Health**                  | On-call, real-time    | Crash-free rate, error rates, latency, SLO burn                                       |
| **Sync**                    | Eng, daily            | Success rate, **conflict rate**, outbox age/depth, rejections, `max`-regression check |
| **Performance**             | Eng, weekly           | All budgets vs actuals, trended                                                       |
| **Learning quality**        | Product + eng, weekly | Everything in [Learning-quality telemetry](#learning-quality-telemetry)               |
| **North star & guardrails** | Everyone, weekly      | [`product/metrics.md`](../product/metrics.md)                                         |
| **AI cost & cache**         | Eng, daily            | Spend, cache hit rate, validation failures, fallback rate                             |
| **Content quality**         | Content lead, weekly  | Removal rate per phrase, most-tagged-difficult, never-practised                       |

The content-quality dashboard closes the loop back to authoring: a phrase removed by 30% of the
learners who add it is a bad phrase, and that's directly actionable
([`process/content-authoring.md`](../process/content-authoring.md)).

---

## Future product alerting

| Alert                                                           | Severity | Route                    |
| --------------------------------------------------------------- | -------- | ------------------------ |
| **Any audio egress detected** (a request from the audio module) | **P0**   | Page immediately         |
| Claim/merge failure                                             | P0       | Page                     |
| Crash-free rate < 99%                                           | P1       | Page                     |
| Sync success < 95%                                              | P1       | Page                     |
| SLO burn > 10%/hour                                             | P1       | Page                     |
| `max`-field regression detected                                 | P1       | Page                     |
| Conflict rate > 0.5%                                            | P2       | Ticket, same day         |
| AI spend > 80% of daily cap                                     | P2       | Slack                    |
| AI validation failure > 5%                                      | P2       | Slack                    |
| Bundle size or perf budget regression                           | P3       | PR comment, blocks merge |
| Content-quality outlier                                         | P3       | Weekly review            |

The first alert is unusual and deliberate: a canary that watches for **any** network request
originating in the audio module. There should never be one. If there is, the product's central
promise has been broken and that's the most serious thing that can happen here
([threat-model.md](threat-model.md#b2--audio-leaving-the-device--the-one-that-matters-most)).

---

## Privacy constraints on observability

Non-negotiable ([security-privacy.md](security-privacy.md)):

1. **No audio, no derivative of audio beyond a numeric score**, in any telemetry.
2. **No free text.** Not in logs, not in events, not in breadcrumbs, not in crash reports.
3. **Learner-authored phrases are hashed**, so we can count them without reading them.
4. **Analytics opt-out is client-side** — nothing is queued, not merely not sent.
5. **Diagnostics bundles are learner-initiated** and shown before sharing.
6. **Allowlists, not denylists.** A new field is invisible until explicitly permitted, which fails
   safe.

Point 6 is what makes the rest durable: with a denylist, every new event property is a potential
leak until someone remembers to add it.
