# Validation and integration

Inspect current package scripts before copying commands. Use Node 22 and put Cargo on PATH in each
fresh shell. Install with `pnpm install --frozen-lockfile` when dependencies are absent. Do not run
the broad bootstrap script merely to discover what it installs or changes.

A fresh checkout can fail mobile typecheck on web-only styles such as `touchAction` because ignored
`apps/mobile/expo-env.d.ts` is absent. It loads Expo's React Native Web type extensions.
`node scripts/ci-expo-routes.mjs` generates route declarations, not this environment declaration.
Regenerate through the installed Expo CLI instead of changing valid styles or hand-editing output:

```bash
node -e 'const path = require("node:path"); const cli = path.dirname(require.resolve("@expo/cli/package.json")); require(path.join(cli, "build/src/start/server/type-generation/expo-env.js")).writeExpoEnvDTS(path.resolve("apps/mobile")).catch(error => { console.error(error); process.exitCode = 1 })'
```

This installed SDK entry point was verified for the current Expo version; inspect it again after an
SDK upgrade. Run from the repository root. Keep both generated declarations untracked.

## Match checks to the change

| Change                          | Checks                                                                                                |
| ------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Any coherent development commit | Relevant focused checks, `pnpm check`, scoped formatting, `git diff --check`                          |
| Learner-visible behavior        | Corresponding flow/state coverage, then `pnpm test:e2e` before committing                             |
| Workbench/theme                 | Relevant learner checks plus `pnpm test:e2e:workbench`; use `pnpm test:e2e:bundle` for release gating |
| Tokens                          | `pnpm tokens:build`, inspect generated diff and contrast gates                                        |
| Rust/bindings                   | Relevant cargo tests, `pnpm core-rs:build`, generated drift and platform parity                       |
| HTTP schema                     | `pnpm contracts:generate`, `pnpm contracts:check`, runtime tests where wired                          |
| Auth/server persistence         | `bash scripts/ci-auth-postgres.sh` using its isolated database                                        |
| Container packaging             | `bash scripts/ci-api-image.sh`; host/workspace success does not prove runtime dependencies            |
| Merge/distribution              | `CI_BASE_REF=origin/main pnpm ci:local` when that script exists; inspect separate native/audit gates  |

`pnpm check` is the fast gate; it does not replace browser or native acceptance. Current local CI
orchestrates installs, generated output, PostgreSQL, formatting/commitlint,
browser/workbench/export, API image smoke and benchmarks. Read `scripts/ci-local.sh` and
`docs/process/ci-cd.md` for the current stages. GitHub Actions stays disabled unless the user
explicitly changes that policy. Do not enable or dispatch it to satisfy a stale PR/process document.

For docs/skill-only work, validate links, metadata and any new helper; there is no reason to add
learner E2E tests or rebuild an APK. Preserve the repository's required fast gate.

## Avoid repeated expensive runs

Use focused tests while editing, then the required full gate after source stabilizes. Keep logs in a
task-specific ignored/temp location; report the exit code and relevant failure, not the whole
successful log. Reuse valid build caches. A new source change or rebase invalidates affected
evidence; a commentary update or commit-message-only correction does not require rebuilding the
unchanged app. Rerun the failed check and any checks invalidated by its fix.

Set an unused `LORO_E2E_PORT` for an isolated run. `CI=1` prevents accidental reuse of another
task's server. Multiple suites in one worktree also share report/output paths; serialize them or
configure distinct outputs using the installed Playwright CLI. Separate worktrees avoid source
reloads during accepted suites. Stop only processes started by the task.

If many tests fail after the first navigation/setup timeout, inspect that trace and the Expo log
before rewriting selectors. Past causes included shared server termination and concurrent Metro
reloads. A cold-build timing regression also disappeared with `LORO_CI_CONCURRENCY=1`; diagnose
contention and rerun unchanged tests before altering a performance threshold.

Scope formatting to changed authored source. Never apply repository-wide `pnpm format` to solve one
failing file: it can rewrite unrelated documents or authored design. Generated files are regenerated
by their owner and inspected separately. Report pre-existing failures honestly; do not call the full
gate green if only focused checks passed.

## Commits and merges

Preserve `AGENTS.md → CLAUDE.md`. Use `codex/<REQ-ID>-<topic>` branches and the scopes in
`commitlint.config.cjs`. Commit coherent, green changes as they finish. Lowercase requirement IDs in
commit subjects (for example `(f-03)`) satisfy the actual `subject-case` rule; uppercase IDs in
documentation remain canonical. Write multiline GitHub bodies through a file/structured argument.

When merging is requested, inspect current remote main, worktree ownership and actual PR state.
Squash merges can leave original branch commits non-ancestors; `git branch --no-merged` alone does
not prove missing functionality. Check merged PRs, patches and relevant files. Preserve concurrent
auth/navigation/translation work during conflict resolution, regenerate owned output, and validate
the combined tree. Never overwrite a dirty main checkout just to make it match the remote.

Verify the resulting remote merge and final status. A push is not a merge; a merge is not a
deployment; an uploaded draft APK is not a published release. Report which one actually happened.
