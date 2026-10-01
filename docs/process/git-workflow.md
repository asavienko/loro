# Git workflow

Trunk-based on `main`, short-lived branches, Conventional Commits, squash-merged PRs.

## Branches

`<type>/<REQ-ID>-<short-slug>`, e.g. `feat/P3-01-song-rating`, `fix/F-04-like-merge`,
`docs/F-03-trim-docs`. The requirement ID comes from [prd.md](../product/prd.md). No `develop`.

## Commits

```
<type>(<scope>): <subject> (<REQ-ID>)

<body: why, not what>
```

Enforced by commitlint (`commitlint.config.cjs`):

- **Types:** `feat` `fix` `perf` `refactor` `test` `docs` `chore` `content` `revert`.
- **Scopes:** `mobile` `api` `core` `core-rs` `tokens` `content` `engines` `sync` `audio` `dsp`
  `widgets` `ci` `docs` `deps`.
- Subject lowercase, no trailing period; header ≤ 100 characters.
- `BREAKING CHANGE:` in the footer for a wire-format or schema break.

Commit in meaningful chunks: one coherent change each, leaving `pnpm check` green. Don't mix a
refactor into a fix, and don't let generated output ride along in an unrelated commit. PRs are
squash-merged, so the branch's commits are where the reasoning survives.

The pre-commit hook (`.husky/pre-commit`) runs Gitleaks on the staged changes (install it with
`brew install gitleaks`; the hook blocks without it), then lint-staged.

## Pull requests

- Title follows the commit convention; the description gives what and why, the requirement IDs, how
  it was verified (and on which device for audio or native changes) and screenshots for visual
  changes ([template](../../.github/PULL_REQUEST_TEMPLATE.md)).
- `pnpm ci:local` green, with the checked commit and results recorded in the PR
  ([ci-cd.md](ci-cd.md)).
- Confirm the three non-negotiables: no recorded audio leaves the device, every number shown is
  real, no copy shames a missed day. Every new syncable field has a merge class in
  `packages/core/src/sync/fieldPolicy.ts`.
- Rebase to update a branch; history on `main` is linear.

## Reverting

Prefer `git revert <sha>` to a rushed forward fix. A change that breaks a non-negotiable is reverted
first and discussed after.

## Never commit

- Plaintext `.env` values: commit only `.env.example` and SOPS-encrypted `secrets/*.enc.env`
  (`pnpm env:encrypt`). Never `git add -f` around this.
- Private age identities, keys, tokens, learner data, recorded audio or database dumps.
- Hand edits to generated files (UniFFI bindings, the core-rs browser build,
  `apps/mobile/src/ui/iconCodepoints.ts`, the OpenAPI specs): fix the generator instead.
