# 0008 · Build our own backend (NestJS + Postgres) rather than adopting a BaaS

- **Status:** Accepted
- **Date:** 2026-07-28
- **Deciders:** Backend lead, tech lead

## Context

The backend has four jobs, and notably **none of them is running a practice session**
([overview.md](../overview.md#the-ten-rules), rule 2):

1. **Arbitrate sync** — apply the per-field merge rules from
   [sync-protocol.md](../sync-protocol.md), using the _same_ merge implementation as the client.
2. **Distribute content** — versioned catalog, diffs, packs, signed CDN URLs
   ([ADR-0009](0009-content-pipeline-and-packs.md)).
3. **Proxy AI and TTS** — with caching, budgets, rate limits, and output validation
   ([ai-services.md](../ai-services.md)).
4. **Verify purchases** and resolve entitlements.

Plus a worker tier: content builds, TTS rendering, LLM enrichment, counter reconciliation, analytics
ETL.

Because the app is offline-first, the availability requirement is modest (99.9%) and there is no
per-session server work. The traffic profile is small, bursty syncs plus highly cacheable content.

## Options considered

### A · Supabase

**Pros** Postgres, auth, storage, realtime, and edge functions on day one. Very little backend code
to own. **Cons**

- **The sync semantics don't fit.** We need per-field LWW over HLC with _different merge classes per
  field_ (LWW, max, grouped-FSRS, append-only, tombstone-wins). That is not a primitive Supabase
  offers; we would implement it in Postgres functions or edge functions — i.e. write our own sync
  anyway, but in a less testable place and without sharing the implementation with the client.
- **The merge cannot be the client's merge.** [ADR-0002](0002-shared-rust-core.md) requires one
  implementation, run on both sides. Postgres functions can't run `loro-core`.
- The content pipeline (build, validate, render TTS, extract reference contours, version, diff)
  would be custom regardless.
- The AI proxy needs budgets, per-user rate limits, caching, and output validation — again custom.

So Supabase would save us auth and hosting, and leave the three hard parts custom.

### B · Firebase

**Pros** Excellent offline SDKs, mature. **Cons** Firestore's document model and its own conflict
semantics fight our per-field HLC design rather than helping. Query patterns for a 2 000-phrase
library with due-date indexes are awkward. Vendor lock-in is deep and the migration path is poor.
Same custom-anyway problem for content and AI.

### C · NestJS + Postgres, ours

**Pros**

- The sync endpoint is **thin** because the logic is in `loro-core` (WASM) — the same bytes the
  client runs. This is the single most important property and it's only available if we control the
  request handler.
- ~~Drizzle schemas are shared with the client, so client and server DDL come from one definition.~~
  **Withdrawn.** The client's DDL is handwritten SQL and there is no Drizzle on the device
  ([ADR-0003's amendment](0003-offline-first-sqlite-sync.md#amendment--2026-07-30--handwritten-sql-on-the-client-no-orm)).
  The two definitions are separate; what keeps them honest is the sync contract in
  `packages/core/src/sync/fieldPolicy.ts`, which CI enforces, not a shared schema. This was a
  supporting pro, not the reason option C won — the thin WASM sync endpoint below is.
- Zod schemas from `packages/core` validate both sides of every endpoint; the contract cannot drift.
- NestJS module boundaries suit a service that will grow a worker tier and several proxies.
- Team familiarity — this is the stack already run elsewhere in the org.
- No vendor lock-in on the highest-consequence path in the product.

**Cons**

- We own auth (Apple, Google, magic link, token rotation).
- We own hosting, migrations, monitoring, and on-call.
- More initial work than option A.

## Decision

**NestJS 11 on Node 22, Postgres 16 with Drizzle, Redis 7 for cache/rate limits/queues,
S3-compatible storage behind a CDN.** Workers run from the same image with a different entrypoint.

`loro-core` compiled to WASM runs the merge in the sync endpoint.

## Consequences

### Good

- **Client and server cannot disagree about a merge.** The single decision this ADR exists to
  protect.
- One schema definition, one set of domain types, one validation schema per endpoint, shared with
  the app.
- Full control over the content pipeline, which is the part that changes most often.
- Full control over AI budgets, caching, and validation — which is what keeps AI cost at cents per
  learner and keeps invalid scenes away from learners.
- No vendor coupling on sync, so [ADR-0003](0003-offline-first-sqlite-sync.md) can evolve freely.
- The modest 99.9% availability target is genuinely achievable by a small team, because
  offline-first means an outage degrades sync rather than the product
  ([backend.md](../backend.md#slos)).

### Bad — accepted deliberately

- **We own auth.** Mitigated by having no passwords at all — provider sign-in plus magic links
  removes the reset flows, the hashing decisions, and the breach liability
  ([security-privacy.md](../security-privacy.md#authentication)).
- We own hosting and on-call. Mitigated by using managed Postgres and Redis, IaC for everything, and
  keeping the service genuinely small (four route groups).
- More upfront work than Supabase. Recovered quickly, because the three hard parts were custom in
  every option.
- WASM in Node for the merge is slightly unusual and adds a build step. Benchmarked; the merge is
  ~20 µs per row, so a 500-op batch costs 10 ms.

### Revisit if…

- The merge in WASM proves problematic in Node (memory, cold start, or maintenance burden).
  Fallback: a native Node addon, or a small Rust sidecar service that owns the merge endpoint.
- We add multi-writer shared phrasebooks, which changes the sync model enough that a purpose-built
  sync platform might genuinely fit ([ADR-0003](0003-offline-first-sqlite-sync.md#revisit-if)).
- The operational burden of owning auth and hosting starts to cost more engineering time than the
  correctness benefit is worth — the honest trigger would be on-call load, measured.

## Amendment — 2026-09-07 — single-instance testing infrastructure

The user selected
[plan 88](../../../plans/archive/2026-09-09/88-low-cost-backend-infrastructure.md): one On-Demand
EC2 instance in Frankfurt with the API and PostgreSQL, private S3, Caddy HTTPS and a $25–35/month
target. This supersedes the original assumption that managed PostgreSQL/Redis, workers and a CDN are
required for testing. None is provisioned by this documentation decision.

The NestJS/PostgreSQL/shared-WASM decision stands. Testing accepts maintenance downtime and one
failure domain, with nightly and pre-migration backups and verified restores. A 99.9% availability
statement above is a historical production objective, not a promise for this host. Plan 73 owns
production objectives and topology after testing evidence; plan 88 owns this testing deployment.
