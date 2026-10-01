# Contributing

Loro is source-available, not open source ([LICENSE](LICENSE)): you can read everything, run it
locally and propose changes here, but not reuse it elsewhere. By opening a pull request you accept
the contribution terms in that file.

## What is welcome

- **Bug reports** and **content corrections** through the issue templates. A wrong phrase, a wrong
  translation or an unnatural sentence in any course is worth an issue even if you are not sure how
  to fix it; say which language you speak natively.
- **Small, scoped pull requests**: a fix, a test, a copy correction, a documentation correction.
  Open an issue first for anything larger, because the product decisions are recorded in `docs/` and
  a change that contradicts one will be closed with a pointer to it.

What is not: features that violate [the three non-negotiables](CLAUDE.md#the-three-non-negotiables)
(recorded audio leaving the device, a number that is not real, copy that shames a missed day),
anything that adds a cloud speech-recognition path, and dependency bumps a bot already proposes.

## Setting up

[`README.md`](README.md) has the commands; [`apps/mobile/README.md`](apps/mobile/README.md) and
[`docs/process/local-development.md`](docs/process/local-development.md) have the detail. In short:
Node 22 with pnpm, Rust with `cargo`, and `gitleaks` (the pre-commit hook refuses to commit without
it). The web build of the app and the API with its stubs run with no credentials: AI, voices and
music have labelled local fallbacks. Live voices, models and sign-in providers need keys that are
not shared, so expect those paths to stay stubbed on your machine.

## Making a change

1. Branch from `main` as `<type>/<REQ-ID>-<slug>`; requirement IDs come from
   [`docs/product/prd.md`](docs/product/prd.md) ([git workflow](docs/process/git-workflow.md)).
2. Keep `pnpm check` green on every commit, and run `pnpm ci:local` before the pull request. CI does
   not run in GitHub Actions; the pull request records the commit and result you ran locally
   ([ci-cd.md](docs/process/ci-cd.md)).
3. Conventional Commits with the scopes in `commitlint.config.cjs`; one coherent change per commit.
4. Fill in the pull request template. It asks the five questions every change must answer.
5. A decision made while doing the work goes in `docs/` in the same change: how the app behaves in
   [`v2-prototype-decisions.md`](docs/design/v2-prototype-decisions.md), a hard-to-reverse technical
   choice as an [ADR](docs/architecture/adr/README.md).

Learner-facing text lives in `apps/mobile/src/shared/copy/` in all five interface languages; a copy
change in one language needs the others, or an issue asking for them. Course content changes are
reviewed by a native speaker of that language before they ship (Q-23 in
[open questions](docs/decisions/open-questions.md)).

## Security

Please report vulnerabilities privately as described in [SECURITY.md](SECURITY.md), not in an issue.
