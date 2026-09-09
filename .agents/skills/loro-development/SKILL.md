---
name: loro-development
description:
  Develop, debug, review, and plan changes in the Loro language-learning repository. Use for its
  mobile UI, shared core, API, persistence, native integrations, tests, and local build or
  deployment workflows. Routes to the relevant code and verified project lessons without rereading
  the entire roadmap or chat history.
---

# Loro development

Use the current checkout to establish what exists, then load only the reference needed for this
task. This skill supplements `AGENTS.md` (a symlink to `CLAUDE.md`); it does not replace the product
specification or turn a review/planning request into implementation.

## Start with a small context budget

1. Read applicable repository instructions once. If already supplied in context, do not reread them.
   Read the required orientation documents once per fresh task; search their relevant sections on
   subsequent passes. Use `docs/README.md` as an index, not a request to read every doc.
2. Establish checkout, available commands and active work before coding:

   ```bash
   source "${NVM_DIR:-$HOME/.nvm}/nvm.sh"
   nvm use 22
   export PATH="$HOME/.cargo/bin:$PATH"
   node .agents/skills/loro-development/scripts/context.mjs
   ```

   Run from the repository root; the helper itself also works when invoked from a subdirectory. If
   Node 22 is already supplied without nvm, use it directly. The helper reads local metadata; it
   neither fetches nor installs dependencies, reads secret values, or modifies files.

3. Locate the existing requirement/plan and its implementation with bounded `rg` searches. Use
   active and archived plan filenames to resolve moved plans; never infer the next number from this
   skill. `git worktree list` identifies concurrent checkouts when ownership matters.
4. Classify the requested result: explanation, plan/docs, implementation, or delivery. Continue
   authorized work to that result. Historical requests to implement, delegate, push, publish or
   deploy apply to their original tasks, not automatically to a new task.

## Choose the relevant reference

Code paths are repository-relative unless a reference defines a shorthand. Follow only the rows that
apply.

| Work                                                           | Read                                            | Primary entry points                                                                      |
| -------------------------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Screens, navigation, gestures, copy, tokens, i18n              | [Mobile](references/mobile.md)                  | `docs/design/screen-catalog.md`, `apps/mobile/app/`, `apps/mobile/src/ui/`                |
| Engines, Rust, SQLite, API contracts, accounts or sync         | [Core and data](references/core-and-data.md)    | `packages/core/src/`, `packages/core-rs/src/`, `apps/mobile/src/data/`, `apps/api/src/`   |
| Tests, refactors, generated output, commits or merges          | [Validation](references/validation.md)          | `package.json`, `scripts/ci-local.sh`, `apps/mobile/e2e/`                                 |
| Run locally, APK, environment, provider or EC2 work            | [Operations](references/operations.md)          | `docs/process/ci-cd.md`, `docs/process/local-development.md`, `docs/process/local-apk.md` |
| Explain an earlier decision or reconcile contradictory history | [History and provenance](references/history.md) | Dated chat index and supersession notes; then current source                              |
| Create, review, update, complete or archive plans              | [Plan management](references/plans.md)          | `plans/README.md`, `plans/archive/README.md`, owning plan and acceptance evidence         |

## Resolve truth and scope before editing

- **Current implementation:** inspect code, tests and generated artifacts at the actual ref. A
  completed chat, merged PR, archived plan or existing branch name alone does not prove the feature
  exists in this checkout or deployed binary. Fetch when current remote state matters; compare with
  `origin/main`. In Loro, the user's “master” means `main`.
- **Intended behavior:** use the applicable v1.1 authored artifact. `Loro.dc.html` owns screens
  1–21, `Loro Chat.dc.html` owns 22–23, `Navigation.dc.html` owns shared chrome, and
  `Design System.dc.html` owns the visual reference. Read cited ranges plus the relevant
  `DCLogic.renderVals()`, not every HTML file. Preserve the authored files.
- **Hard invariants:** recorded audio stays on-device; learner numbers must be measured or come from
  real algorithms; missing measurements stay `null`; missed days are never shamed. Prototype scores,
  intervals, timers, masks and reply generators are not implementations.
- **Unfinished work:** check the plan's remaining acceptance criteria and named gates. Continue
  independent slices. A selected provider, compiled module or passing browser test does not close
  linguistic, hardware, account-configuration or release gates.
- **Plans:** follow [plan management](references/plans.md) when changing the roadmap or an owning
  plan. Keep completed records only in the archive; active listings show remaining work. Link
  directly to the actual files, without compatibility symlinks or redirect files.

Keep task notes to the requirement, owned files, key decision, verified commands and remaining gate.
Prefer an existing seam over a new framework. For a behavior-preserving refactor, retain existing
E2E expectations and exact values; do not combine it with a product correction.

Finish with the result, validation actually completed, commit/artifact location, and any material
remaining gate. Update changed implementation claims in the owning docs and `CLAUDE.md` in the same
change. Do not copy transient test counts or deployment addresses into this skill.
