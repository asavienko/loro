# Loro documentation

Only what is true of the current code. The running app in [`apps/mobile`](../apps/mobile/README.md)
is the design reference. Older docs, reviews and plans were removed on 2026-09-30 and remain in Git
history at `e36cc758`.

## Product

- [Vision](product/vision.md) — what Loro is and who it is for
- [Product requirements](product/prd.md) — the requirement IDs used in branches and commits

## Architecture

- [Overview](architecture/overview.md) — the system end to end, and where each part is described
- [The library](architecture/library.md) — content, accounts, sharing, limits and AI generation
- [Sync](architecture/sync-protocol.md) — how progress merges across tabs, devices and the account
- [FSRS model](architecture/fsrs-model.md) — the scheduler and Loro's policy (upstream licence:
  [`fsrs-upstream-license.txt`](architecture/fsrs-upstream-license.txt))
- [Backend](architecture/backend.md) and [API](architecture/api.md) — the NestJS service and its
  routes; `openapi.current.json` and `openapi.target.json` are generated and drift-checked
- [Security and privacy](architecture/security-privacy.md)
- [Decision records](architecture/adr/README.md)

## Design

- [v2.0 design decisions](design/v2-prototype-decisions.md)
- [Copy and tone](design/copy-and-tone.md)

## Process

- [Git workflow](process/git-workflow.md) — branches, Conventional Commits, requirement IDs
- [CI](process/ci-cd.md) — `pnpm check` and `pnpm ci:local`
- [Local development](process/local-development.md) — on the host or in containers, SOPS and age
- [Environments](process/environments.md) — configuration variables
- [Local APK](process/local-apk.md) — Android testing builds
- [Local iOS builds](process/local-ipa.md) — iPhone testing builds, and installing without the App
  Store
- [Landing page deployment](process/landing-deployment.md) — `pnpm landing:deploy` to Amplify
  Hosting, and the CloudFront stack waiting on account verification
- [The landing page's video](process/promo-video.md) — `apps/promo`: Remotion, synthesized sound,
  the app's voices
- [EC2 deployment](process/ec2-deployment.md) and
  [EC2 backups and recovery](runbooks/backend-testing.md)
- [The public repository](process/public-repository.md) — what is public, the GitHub settings it
  relies on, what must never be committed; with [`CONTRIBUTING.md`](../CONTRIBUTING.md),
  [`SECURITY.md`](../SECURITY.md) and [`LICENSE`](../LICENSE) at the root

## Decisions

- [Open questions](decisions/open-questions.md) — unresolved decisions, with owners and dates

## Next to the code

- [`apps/mobile`](../apps/mobile/README.md) and its
  [`LoroCore` module](../apps/mobile/modules/loro-core/README.md)
- [`apps/api`](../apps/api/README.md), its [authentication](../apps/api/src/auth/README.md), the
  [ElevenLabs](../apps/api/src/integrations/elevenlabs/README.md) integration and the text-model
  transports in `apps/api/src/integrations/`
  ([ADR-0015](architecture/adr/0015-open-model-providers.md))
- [`apps/landing`](../apps/landing/README.md) — the one-page site and how its build list stays
  current
- [`packages/core`](../packages/core/README.md),
  [`packages/core-rs`](../packages/core-rs/README.md),
  [`packages/content`](../packages/content/README.md) and its
  [bilingual review records](../packages/content/reviews/README.md)
