# Architecture decision records

One file per significant, hard-to-reverse decision. Each records the context, the alternatives we
actually considered, what we chose, and the consequences we accepted.

## Index

Only the records that still govern the code are kept; the others (0001, 0003, 0005–0007, 0009, 0010,
0012–0014) remain in Git history at `e36cc758`.

| #                                       | Decision                              | Status   | Date       |
| --------------------------------------- | ------------------------------------- | -------- | ---------- |
| [0002](0002-shared-rust-core.md)        | A shared Rust core via UniFFI         | Accepted | 2026-07-28 |
| [0004](0004-fsrs-scheduler.md)          | FSRS as the scheduling algorithm      | Accepted | 2026-07-28 |
| [0008](0008-backend-nestjs-postgres.md) | NestJS + Postgres over a BaaS         | Accepted | 2026-07-28 |
| [0011](0011-analytics-and-privacy.md)   | Privacy posture and the audio promise | Accepted | 2026-07-28 |

The next new record is 0015; numbers are never reused.

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
