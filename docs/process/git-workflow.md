# Git workflow

Trunk-based, small PRs, conventional commits.

---

## Branches

| Branch                                    | Purpose                                               |
| ----------------------------------------- | ----------------------------------------------------- |
| `main`                                    | **Trunk.** Always green, always releasable. Protected |
| `feat/*` · `fix/*` · `chore/*` · `docs/*` | Short-lived work branches                             |
| `release/x.y`                             | Cut for a release train; only fixes cherry-picked in  |
| `hotfix/*`                                | Branched from a release tag                           |

**No `develop`.** Feature flags gate unfinished work, not long-lived branches
([experimentation.md](experimentation.md)). Every engine ships behind a flag from day one
([`../architecture/practice-engines.md`](../architecture/practice-engines.md#engine-resolution)), so
half-finished work can live on `main` safely.

### Naming

```
<type>/<REQ-ID>-<short-slug>

feat/P2-04-association-suggestions
feat/LB-25-warming-card
fix/P3-22-asr-accent-normalisation
chore/core-rs-criterion-benches
docs/adr-0015-shared-phrasebooks
```

The requirement ID from [`../product/prd.md`](../product/prd.md) is in the branch, the commits, and
the PR. That's what makes "what's left in M2?" answerable by listing IDs.

### Lifetime

**Branches live under two days.** If a change is bigger than that, stack it:

```
feat/LB-25-warming-card-tokens      → main
feat/LB-25-warming-card-component   → feat/LB-25-warming-card-tokens
feat/LB-25-warming-card-wiring      → feat/LB-25-warming-card-component
```

Each PR reviewable on its own, merged in order. A five-day branch gets a review nobody can do
properly.

---

## Commits

### Secret scanning

Install [Gitleaks](https://github.com/gitleaks/gitleaks) (`brew install gitleaks` on macOS).
`pnpm install` activates the Husky pre-commit hook through the existing `prepare` script. The hook
scans staged changes and blocks commits when secrets are detected or Gitleaks is missing, then runs
`pnpm exec lint-staged` (eslint/prettier/rustfmt on the staged set). Findings are redacted. Run the
same Gitleaks check manually with `gitleaks git --pre-commit --staged --redact --no-banner`.
`scripts/bootstrap.sh` warns when Gitleaks is missing, the same way it warns for watchman.

[Conventional Commits](https://www.conventionalcommits.org/), enforced by commitlint.

```
<type>(<scope>): <subject> (<REQ-ID>)

[body]

[footer]
```

### Types

| Type       | For                                                            |
| ---------- | -------------------------------------------------------------- |
| `feat`     | New behaviour                                                  |
| `fix`      | A bug fix                                                      |
| `perf`     | A performance improvement (cite the budget)                    |
| `refactor` | No behaviour change                                            |
| `test`     | Tests only                                                     |
| `docs`     | Documentation only                                             |
| `chore`    | Tooling, deps, CI                                              |
| `content`  | Catalog changes ([content-authoring.md](content-authoring.md)) |
| `revert`   | A revert                                                       |

### Scopes

`mobile` · `api` · `core` · `core-rs` · `tokens` · `content` · `engines` · `sync` · `audio` · `dsp`
· `widgets` · `ci` · `docs`

### Examples

```
feat(engines): re-rank stream suggestions by theme after add (P2-04)

The blueprint's association mechanic: after adding a phrase, the zero-query
suggestion list becomes same-theme-first, then everything else, capped at 6.
See Loro.dc.html:2304-2308.

fix(dsp): normalise F0 to median before contour comparison (P3D-06)

Absolute pitch was leaking into the melody score, so a bass and a soprano
producing identical intonation scored differently. Normalising to semitones
relative to the speaker's own median fixes it.

Golden scores re-baselined; the diff is documented in the PR.

perf(mobile): prepared statements for the stream queue query

p95 25ms → 6ms at 2000 phrases. Budget is 25ms
(docs/architecture/performance.md#data-layer).

content(es-ES): soften 12 café phrases to spoken register

'Quisiera un café' → 'Me pone un café'. Reviewed by a native speaker.
```

### Rules

- **Subject in the imperative**, lowercase, no trailing period, ≤ 72 chars.
- **The body explains why**, not what — the diff shows what.
- **Cite the blueprint line range** when implementing from it.
- **Cite the budget** on a perf commit.
- `BREAKING CHANGE:` in the footer for a wire-format or schema break.
- **Reference the requirement ID** in the subject.

---

## Pull requests

### Size

**Target: under 400 changed lines.** Above that, split it. Review quality falls off a cliff past
~400 lines and everyone knows it.

Exceptions that don't count: generated files, lockfiles, content data, snapshot updates. Note them
in the PR so a reviewer knows what to skip.

### The description

The template ([`.github/PULL_REQUEST_TEMPLATE.md`](../../.github/PULL_REQUEST_TEMPLATE.md)) asks
for:

- **What and why**, in two sentences
- **Requirement IDs**
- **Blueprint reference** (line range) if implementing from it
- **How it was verified** — and on which device for anything audio, animation, or native
- **Screenshots or a screen recording** for anything visual. A recording, not a still, for anything
  animated
- **The five non-negotiable checks** (below)
- **Budget impact** if it touches a measured surface

### The five checks

Every PR asserts these explicitly. They're the ten rules' teeth
([`../architecture/overview.md`](../architecture/overview.md#the-ten-rules)):

- [ ] No new path moves recorded audio, or a derivative of it, off the device
- [ ] No number shown to a learner is simulated, estimated, or placeholder
- [ ] No copy shames a missed day
- [ ] Every syncable field I added has a declared merge class
- [ ] Every Spanish text node I added carries `lang="es-ES"`

Checks 1 and 2 are why the audio-egress canary and the `latencyMs: number | null` type exist — but a
human assertion is still cheaper than finding out from a learner.

### Merging

- **Squash merge.** The commit message becomes the PR title, so PR titles follow the commit
  convention.
- **Local CI (`pnpm ci:local`) must be green.** No merging through a red build; a flaky test is
  fixed or quarantined with an issue.
- **One approval**, two where CODEOWNERS says so — notably `packages/core/src/sync` needs both a
  tech-lead and a backend review, because a merge-class mistake there is silent data loss.
- **The author merges.** Whoever wrote it decides when it lands.
- **Rebase, don't merge, to update a branch.** Linear history on `main`.

---

## Protection on `main`

| Rule                   |                                                              |
| ---------------------- | ------------------------------------------------------------ |
| Direct pushes          | Blocked                                                      |
| Required approvals     | 1 (2 where CODEOWNERS requires)                              |
| Required status checks | None from GitHub Actions; record local CI evidence in the PR |
| Stale approvals        | Dismissed on new commits                                     |
| Force push / delete    | Blocked                                                      |
| Linear history         | Required                                                     |
| Admin bypass           | Only for a P0 incident, and it's logged                      |

---

## Releases

Full detail: [release-versioning.md](release-versioning.md).

```
main ──●──●──●──●──●──●──●──▶
          │           │
          │           └── release/1.3 ──▶ tag v1.3.0 ──▶ store
          └── release/1.2 ──▶ tag v1.2.0
                              └── hotfix/1.2.1 ──▶ tag v1.2.1
```

- Cut `release/x.y` from `main` at the start of a train.
- Fixes are made on `main` and **cherry-picked** to the release branch — never the reverse, or
  `main` loses the fix.
- Tag on the release branch only as part of an explicitly authorized release; tags do not trigger
  builds.
- Hotfixes branch from the tag, then merge back to both the release branch and `main`.

---

## Reverting

**Reverting is normal and cheap. Prefer it to a forward fix under time pressure.**

```bash
git revert <sha>          # then a PR as usual
```

A revert of a change that violates one of the three non-negotiables
([ways-of-working.md](ways-of-working.md#the-three-non-negotiables)) doesn't need discussion first —
revert, then discuss.

For anything already shipped, an OTA update can ship a JS-only fix in hours; a native change needs a
store release ([ci-cd.md](ci-cd.md#ota-updates)).

---

## Generated files

Committed, and drift-checked in CI ([ADR-0014](../architecture/adr/0014-monorepo-tooling.md)):

- `packages/design-tokens/out/**` — the native widget targets build without the JS toolchain
- `packages/core-rs/bindings/**` — UniFFI-generated Swift and Kotlin

**Never edit these by hand.** CI regenerates them and fails on any difference, so a hand edit cannot
merge. If output looks wrong, fix the generator.

---

## What not to commit

| Never                                          | Instead                                         |
| ---------------------------------------------- | ----------------------------------------------- |
| Secrets, API keys, tokens                      | `.env` (gitignored); managed secret store in CI |
| `.env` files with real values                  | `.env.example` with placeholders                |
| Recorded audio, learner data, DB dumps         | Nothing — see the privacy posture               |
| Large binaries                                 | The CDN, or Git LFS with a reason               |
| `node_modules`, `target`, `Pods`, build output | `.gitignore`                                    |
| Commented-out code                             | Delete it; git remembers                        |
| A `.only` on a test                            | CI lints for it                                 |
| A commented-out CI check                       | Fix it or delete it with an issue               |
