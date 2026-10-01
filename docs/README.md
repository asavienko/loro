# Loro documentation

Only what is true of the current code. The running app in [`apps/mobile`](../apps/mobile/README.md)
is the design reference; older docs, reviews and plans were removed on 2026-09-30 and remain in Git
history at `e36cc758`.

## Product

- [Vision](product/vision.md) — what Loro is and who it is for
- [Product requirements](product/prd.md) — the requirement IDs used in branches and commits

## Architecture

- [Overview](architecture/overview.md) — how the pieces fit
- [The library](architecture/library.md) — packs, accounts, sharing, limits and AI generation
- [Sync protocol](architecture/sync-protocol.md) — progress sync and merge
- [FSRS model](architecture/fsrs-model.md) — the scheduler in `packages/core-rs`
- [Backend](architecture/backend.md), [API contract](architecture/api.md) — the NestJS API
  (`openapi.current.json` / `openapi.target.json` are generated and drift-checked)
- [Security and privacy](architecture/security-privacy.md)
- [Decision records](architecture/adr/README.md)

## Design

- [v2.0 design decisions](design/v2-prototype-decisions.md)
- [Copy and tone](design/copy-and-tone.md)

## Process

- [Git workflow](process/git-workflow.md) — branches, Conventional Commits, requirement IDs
- [CI / CD](process/ci-cd.md) — `pnpm check` and `pnpm ci:local`
- [Local development](process/local-development.md) — containers, SOPS and age
- [Environments](process/environments.md) — configuration variables
- [Local APK](process/local-apk.md) — Android testing builds
- [EC2 deployment](process/ec2-deployment.md) and the
  [backend testing runbook](runbooks/backend-testing.md)

## Decisions

- [Open questions](decisions/open-questions.md) — unresolved decisions, with owners and dates
