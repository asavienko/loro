# Architecture decision records

One file per significant, hard-to-reverse decision. Each records the context, the alternatives we
actually considered, what we chose, and the consequences we accepted.

## Index

| #                                                | Decision                               | Status   | Date       |
| ------------------------------------------------ | -------------------------------------- | -------- | ---------- |
| [0001](0001-cross-platform-react-native-expo.md) | React Native + Expo for the app        | Accepted | 2026-07-28 |
| [0002](0002-shared-rust-core.md)                 | A shared Rust core via UniFFI          | Accepted | 2026-07-28 |
| [0003](0003-offline-first-sqlite-sync.md)        | Offline-first SQLite with delta sync   | Accepted | 2026-07-28 |
| [0004](0004-fsrs-scheduler.md)                   | FSRS as the scheduling algorithm       | Accepted | 2026-07-28 |
| [0005](0005-on-device-asr-cloud-fallback.md)     | On-device ASR, opt-in cloud fallback   | Accepted | 2026-07-28 |
| [0006](0006-pluggable-practice-engines.md)       | Pluggable practice engines             | Accepted | 2026-07-28 |
| [0007](0007-audio-pipeline.md)                   | A native audio module, not a JS player | Accepted | 2026-07-28 |
| [0008](0008-backend-nestjs-postgres.md)          | NestJS + Postgres over a BaaS          | Accepted | 2026-07-28 |
| [0009](0009-content-pipeline-and-packs.md)       | Content ships independently of the app | Accepted | 2026-07-28 |
| [0010](0010-llm-roleplay-and-guardrails.md)      | LLM roleplay with hard guardrails      | Accepted | 2026-07-28 |
| [0011](0011-analytics-and-privacy.md)            | Privacy posture and the audio promise  | Accepted | 2026-07-28 |
| [0012](0012-state-management.md)                 | Zustand + live SQLite queries          | Accepted | 2026-07-28 |
| [0013](0013-design-tokens-pipeline.md)           | Design tokens as generated code        | Accepted | 2026-07-28 |
| [0014](0014-monorepo-tooling.md)                 | pnpm workspaces + Turborepo            | Accepted | 2026-07-28 |

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

What forces are in play? Cite the blueprint or a requirement where relevant.

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
