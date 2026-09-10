# Validation and integration

Use current package scripts, Node 22 and Cargo on PATH. Install absent dependencies with
`pnpm install --frozen-lockfile`; avoid broad bootstrap for discovery.

## Fresh-checkout prerequisites

Use `context.mjs --full` before build/typecheck setup. Missing ignored `apps/mobile/expo-env.d.ts`
causes misleading web-style errors such as `touchAction`. `node scripts/ci-expo-routes.mjs`
generates route declarations, not that environment declaration. Generate the latter from the
repository root through the installed Expo CLI:

```bash
node -e 'const path = require("node:path"); const cli = path.dirname(require.resolve("@expo/cli/package.json")); require(path.join(cli, "build/src/start/server/type-generation/expo-env.js")).writeExpoEnvDTS(path.resolve("apps/mobile")).catch(error => { console.error(error); process.exitCode = 1 })'
```

Keep both declarations untracked. Recheck this internal SDK entry point after Expo upgrades; do not
change valid styles to compensate for missing generated types.

## Match checks to the change

| Change              | Checks                                                                             |
| ------------------- | ---------------------------------------------------------------------------------- |
| Development commit  | Focused checks, `pnpm check`, scoped formatting, `git diff --check`                |
| Learner behavior    | Update flow/state coverage; `pnpm test:e2e` before committing                      |
| Workbench/theme     | Relevant learner checks plus `pnpm test:e2e:workbench`                             |
| Tokens              | `pnpm tokens:build`, generated diff and contrast checks                            |
| Rust/bindings       | Cargo tests, `pnpm core-rs:build`, drift and platform parity                       |
| HTTP schema         | `pnpm contracts:generate`, `pnpm contracts:check`, wired runtime tests             |
| Auth/persistence    | `bash scripts/ci-auth-postgres.sh` with its isolated database                      |
| Container packaging | `bash scripts/ci-api-image.sh` against the exact image                             |
| Merge/distribution  | `CI_BASE_REF=origin/main pnpm ci:local`; separate native/audit gates as applicable |

For docs/skill edits, check affected links, metadata and changed helpers plus the required fast
gate. Skill helper tests are
`node --test .agents/skills/loro-development/scripts/context.test.mjs .agents/skills/loro-development/scripts/archive-plan.test.mjs`.
Local skill edits need no learner E2E or APK build; requested merges still require full CI. GitHub
Actions stays disabled unless the user changes that policy.

## Shorten review/fix cycles

Inspect changes since the reviewed revision and the original finding's callers on a follow-up. A
whole-branch review still covers the complete requested diff. Reproduce through the real boundary:
import helper tests missed parent-gate unmounts and lossy serialization; Android wrapper tests
missed Expo dotenv loading and separately restarted Metro sessions. Validate bounds through
entry/edit/save and recovery, not only the initial parser. For shared mobile imports, run the
production bundler early: Node-only dependencies can pass unit/type checks and break Metro.

## Reuse evidence, avoid duplicate runs

Use focused checks while editing, then the required aggregate gate on stable source. Full CI already
includes `pnpm check`; avoid running it immediately beforehand unless a development commit requires
it. Keep the runner's forced checks and required stages.

Retain SHA plus dirty scope/source digest, base ref, command/config, exit status and log path in
existing task/review notes. Reuse only while relevant source, dependencies, configuration and
generated inputs match. A source change/rebase invalidates affected evidence; a message-only amend
needs commitlint, not an app rebuild. An old green chat without matching inputs is insufficient.
Partial/timed-out CI is not a full pass; targeted recovery proves only named checks. Use documented
resumption only when supported; otherwise complete the required full run before integration.

Read `scripts/ci-local.sh` and `docs/process/ci-cd.md` before choosing concurrency. Detect the
scripts in this checkout: the shell wrapper execs `scripts/ci-local.mjs` when present.
`LORO_CI_JOBS` (default 2) bounds the dependency-aware scheduler; `LORO_CI_CONCURRENCY` still bounds
Turbo. Isolated workspaces and `.ci-local-reports/` belong to that runner. Do not import a runner
from another worktree. Plan 95 still records unmatched serial/cold/warm comparison as remaining.

For standalone browser runs, use `CI=1` and an unused `LORO_E2E_PORT`. Ports alone do not isolate
shared reports/exports or Metro source reloads: serialize suites or use separate workspaces and
outputs. Stop only owned processes. Diagnose the first navigation/setup failure and Expo trace
before changing selectors. For contention, reduce concurrency before relaxing a timing threshold.

Keep task-specific logs outside tracked source. Read summaries and the first actionable error;
retain the running session ID and wait instead of relaunching. Report completed exits, not merely
started checks. Format changed authored files only; never use repository-wide `pnpm format` to fix
one file. Regenerate owned output instead of hand-editing it.

## Only when the user requests agents

Partition by independent ownership, not plan count. Supply requirement, owned paths, relevant
reference and focused checks. One integrator owns shared manifests, generators, indexes and staging
in a shared checkout. Integrate stable slices before aggregate CI; avoid a full pipeline per agent.
Isolate mutating builds and source where concurrent execution is necessary. Agent reports include
checked inputs and results for integration review; they do not replace combined-tree checks.

## Commits and integration

Preserve `AGENTS.md → CLAUDE.md`. Use `codex/<REQ-ID>-<topic>` and actual commitlint scopes.
Lowercase subject IDs, such as `(f-03)`, satisfy `subject-case`; documentation IDs remain uppercase.
Commit coherent green chunks. Use a file/structured argument for multiline GitHub bodies.

For a requested merge, refresh remote state and inspect checkout ownership. Squash merges mean
`git branch --no-merged` alone cannot identify missing work: use `git cherry` plus PR/patch/content
evidence. Leftover slice worktrees and merged PR branches are not a merge queue. GitHub's conflict
or mergeable flag can be stale; fetch and integrate `origin/main` locally. Keep archive-only PRs off
feature landings. Markdown wrapping can fail `pnpm check`; format the files you touched.

Stay in the named worktree. Preserve concurrent edits, regenerate owned output and validate the
combined tree. Never overwrite a dirty main checkout. Subagents may be unavailable; continue
in-session rather than blocking. Verify the remote merge and final worktree; distinguish push,
merge, PR, deployment, draft upload and publication in the result. A leftover open PR after a direct
`main` push still needs its own conflict/close decision.
