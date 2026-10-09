# Architecture decision records

One file per significant, hard-to-reverse decision. Each records the context, the alternatives we
actually considered, what we chose, and the consequences we accepted.

## Index

| #                                                  | Decision                                | Status             | Date       |
| -------------------------------------------------- | --------------------------------------- | ------------------ | ---------- |
| [0002](0002-shared-rust-core.md)                   | A shared Rust core via UniFFI           | Accepted           | 2026-07-28 |
| [0004](0004-fsrs-scheduler.md)                     | FSRS as the scheduling algorithm        | Accepted           | 2026-07-28 |
| [0008](0008-backend-nestjs-postgres.md)            | NestJS + Postgres over a BaaS           | Accepted           | 2026-07-28 |
| [0011](0011-analytics-and-privacy.md)              | Privacy posture and the audio promise   | Accepted           | 2026-07-28 |
| [0015](0015-open-model-providers.md)               | DeepSeek writes, Muse Image draws       | Accepted           | 2026-10-01 |
| [0016](0016-course-content-at-scale.md)            | Course content at 10,000 per course     | Accepted           | 2026-10-01 |
| [0017](0017-content-per-language-pair.md)          | Content per language pair, in batches   | Accepted           | 2026-10-02 |
| [0018](0018-public-source-available-repository.md) | A public, source-available repository   | Accepted           | 2026-10-02 |
| [0019](0019-transcribing-generated-songs.md)       | The server may transcribe its own songs | Accepted           | 2026-10-01 |
| [0020](0020-posthog-us-cloud.md)                   | Analytics go to PostHog US Cloud        | Accepted           | 2026-10-02 |
| [0021](0021-email-codes-through-amazon-ses.md)     | Email codes are sent through Amazon SES | Superseded by 0022 | 2026-10-02 |
| [0022](0022-email-codes-through-resend.md)         | Email codes are sent through Resend     | Accepted           | 2026-10-05 |
| [0023](0023-headless-end-to-end-tests.md)          | End-to-end tests run headless in Node   | Accepted           | 2026-10-09 |

The next new record is 0024; numbers are never reused.

### Removed records

The other records were removed from the tree on 2026-09-30 and remain in Git history at `e36cc758`
(`git show e36cc758:docs/architecture/adr/<file>`). Code comments still cite some of them by number.

| #    | Decision                               | Status when removed       |
| ---- | -------------------------------------- | ------------------------- |
| 0001 | React Native + Expo for the app        | Accepted                  |
| 0003 | Offline-first SQLite with delta sync   | Accepted; client removed  |
| 0005 | On-device ASR, reveal-mode fallback    | Accepted                  |
| 0006 | Pluggable practice engines             | Accepted; engines removed |
| 0007 | A native audio module, not a JS player | Accepted                  |
| 0009 | Content ships independently of the app | Accepted                  |
| 0010 | LLM roleplay with hard guardrails      | Accepted                  |
| 0012 | Zustand write-through projection       | Superseded                |
| 0013 | Design tokens as generated code        | Superseded                |
| 0014 | pnpm workspaces + Turborepo            | Accepted                  |

## Statuses

`Proposed` → `Accepted` → `Superseded by NNNN` / `Deprecated`

An accepted ADR is never edited to change its decision. It is superseded by a new one, and the old
file gets a header pointing forward. The history is the point.

## When to write one

Write an ADR when a decision is:

- **hard to reverse** — a framework, a data format, a wire protocol, a sync semantic;
- **cross-cutting** — it constrains code that other people will write;
- **contested** — two reasonable engineers would pick differently;
- **surprising** — the obvious choice was rejected for a non-obvious reason.

Don't write one for a library choice inside one module, a naming convention, or anything a code
comment covers.

## Template

```markdown
# NNNN · Title in the imperative

- **Status:** Proposed | Accepted | Superseded by NNNN
- **Date:** YYYY-MM-DD
- **Deciders:** …
- **Supersedes / Superseded by:** …

## Context

What forces are in play? Cite a requirement ID or an open question where relevant.

## Options considered

### A · …

Pros / cons, honestly. Include the option we rejected that a reader would expect us to pick.

## Decision

What we chose, stated plainly.

## Consequences

### Good

### Bad — accepted deliberately

### Revisit if…

The concrete signal that would make us reopen this.
```

The **"Revisit if…"** section is the one that makes ADRs useful a year later. A decision without a
stated trigger for reconsidering it becomes dogma.
