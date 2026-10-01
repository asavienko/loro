# 0008 · Build our own backend (NestJS + PostgreSQL) rather than adopting a BaaS

- **Status:** Accepted (amended 2026-09-07 and 2026-09-09; updated 2026-09-30)
- **Date:** 2026-07-28

## Context

The backend serves content packs, accounts, sharing and AI generation within per-learner limits, and
keeps a copy of each learner's progress. It never runs a practice session, so availability needs are
modest. Supabase or Firebase would give auth and hosting, but the parts that matter — merge
semantics shared with the client, the content seeding, AI budgets and validated output — would be
custom either way, and in a less testable place.

## Decision

**NestJS on Node 22 with PostgreSQL through `pg` and handwritten, additive SQL.** No ORM, no Redis,
no queue or worker tier until a feature needs one. Zod schemas in `packages/core` define the wire
contract. The API runs as one container on a single EC2 development host with local PostgreSQL
([ec2-deployment.md](../../process/ec2-deployment.md)).

## Consequences

- Full control over sharing, limits and AI fallbacks, which is where the product changes most.
- We own auth. There are no passwords (email code, Google, Apple), which removes reset flows and
  password storage.
- We own hosting and operations; the single host accepts downtime and one failure domain.
- Schema is installed on first use with no migration runner. Add a runner (not an ORM) if the schema
  or operators outgrow that.
- Add Redis or a worker tier only with a named feature that consumes it.
