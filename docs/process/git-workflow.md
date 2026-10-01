# Git workflow

Trunk-based on `main`, short-lived branches, Conventional Commits, squash-merged pull requests.

## Branches

`<type>/<REQ-ID>-<short-slug>`, e.g. `feat/P3-01-song-rating`, `fix/F-04-like-merge`,
`docs/F-03-trim-docs`. The requirement ID comes from [prd.md](../product/prd.md). There is no
`develop` branch. Rebase, rather than merge, to bring a branch up to date.

## Commits

```
<type>(<scope>): <subject> (<REQ-ID>)

<body: why, not what>
```

`commitlint.config.cjs` sets the rules:

- **Types:** `feat` `fix` `perf` `refactor` `test` `docs` `chore` `content` `revert`.
- **Scopes:** `mobile` `api` `landing` `core` `core-rs` `tokens` `content` `engines` `sync` `audio`
  `dsp` `widgets` `ci` `docs` `deps`. A missing scope is a warning, an unknown one an error.
- Subject in lower case, no trailing period; header at most 100 characters.
- `BREAKING CHANGE:` in the footer for a wire-format or schema break.

No hook runs commitlint when you commit. `CI_BASE_REF=origin/main pnpm ci:local` lints the branch's
commits ([ci-cd.md](ci-cd.md)).

Commit in meaningful chunks: one coherent change each, leaving `pnpm check` green. Don't mix a
refactor into a fix, and don't let generated output ride along in an unrelated commit. Pull requests
are squash-merged, so the branch's commits are where the reasoning survives.

The pre-commit hook (`.husky/pre-commit`) runs Gitleaks on the staged changes, then lint-staged
(ESLint and Prettier on staged sources, `rustfmt` on `packages/core-rs`). It refuses to commit
without Gitleaks: `brew install gitleaks`.

## Pull requests

- The title follows the commit convention. The description gives what and why, the requirement IDs,
  how it was verified (and on which device, for audio or native changes) and screenshots for visual
  changes ([template](../../.github/PULL_REQUEST_TEMPLATE.md)).
- `pnpm ci:local` passes, with the checked commit, commands and results recorded in the pull request
  ([ci-cd.md](ci-cd.md)).
- Confirm the three non-negotiables: no recorded audio leaves the device, every number shown is
  real, no copy shames a missed day. Every new field in synced learner state has a merge class
  ([sync-protocol.md](../architecture/sync-protocol.md)).

## Reverting

Prefer `git revert <sha>` to a rushed forward fix. A change that breaks a non-negotiable is reverted
first and discussed after.

## Never commit

- Plaintext `.env` values: commit only `.env.example` and SOPS-encrypted `secrets/*.enc.env`
  ([local-development.md](local-development.md#encrypted-environment-sops--age)). Never `git add -f`
  around the ignore rules.
- Private age identities, keys, tokens, learner data, recorded audio or database dumps.
- Hand edits to generated files (the UniFFI bindings, the core-rs browser build,
  `apps/mobile/src/ui/iconCodepoints.ts`, the OpenAPI specs): fix the generator instead.
