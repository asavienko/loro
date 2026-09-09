---
name: loro-development
description:
  Develop, debug, review, and plan changes in the Loro language-learning repository, including
  mobile, core, API, tests, local builds and deployment. Use focused code/reference discovery and
  reusable validation evidence to avoid repeating repository and chat exploration.
---

# Loro development

Supplement the current checkout's `AGENTS.md` / `CLAUDE.md`; do not duplicate their rules or turn
review/planning into implementation. Keep existing task authorization across follow-ups; historical
chat instructions belong to their original tasks.

## Start or resume

- **Continuing:** retain the requirement, owned paths, decisions and validation results already in
  context. Check changes since the last inspected revision; reopen only affected source. Do not
  restart orientation because the user asks to review, fix or continue.
- **Fresh task:** read applicable instructions and required orientation once, unless already in
  context. Use documentation indexes for navigation. For checkout/runtime context, run the helper
  from the checkout being worked on:

  ```bash
  source "${NVM_DIR:-$HOME/.nvm}/nvm.sh"
  nvm use 22
  export PATH="$HOME/.cargo/bin:$PATH"
  node .agents/skills/loro-development/scripts/context.mjs
  ```

  Existing Node 22 needs no nvm setup. The helper is read-only and reports **its own checkout**,
  even when invoked elsewhere. Add a filename keyword to locate an owner; use `--full` only for
  setup/build troubleshooting or plan allocation. Cached `origin/main` is not live remote evidence.

- **Narrow lookup:** start with supplied paths or a scoped diff, then `rg -n` in the owning
  directory. Batch independent reads and bound output. Stop discovery once the owner, caller,
  relevant test and acceptance gate are clear. Broaden for an unresolved boundary, not a fixed
  reading quota.

## Load only the needed reference

Start with one relevant reference; add another when the change crosses its boundary. History is
optional. Search its topic/session index before retrieving a specific old decision; do not replay
project archives for ordinary development.

| Task                                             | Reference                                    |
| ------------------------------------------------ | -------------------------------------------- |
| Screens, navigation, copy, tokens, i18n          | [Mobile](references/mobile.md)               |
| Engines, Rust, SQLite, contracts, accounts, sync | [Core and data](references/core-and-data.md) |
| Checks, review/fix cycles, commits, integration  | [Validation](references/validation.md)       |
| Local runtime, APK, environment, EC2             | [Operations](references/operations.md)       |
| Plan ownership, status, archival                 | [Plans](references/plans.md)                 |
| Earlier decisions or contradictory reports       | [History](references/history.md)             |

## Work and finish

Use current source/tests for implementation, the applicable v1.1 artifact and cited `renderVals()`
range for intended behavior, and the owning plan for remaining acceptance. Preserve authored files,
on-device recordings, real learner numbers and non-shaming behavior. Archive location, compilation
and old green reports do not close device, linguistic or service gates.

Reproduce a reported failure through its real caller before fixing it. Use focused checks while
editing, then the required stable-source gate in [validation](references/validation.md). Preserve a
compact continuation record in the existing review/plan or task context: revision and dirty scope,
decision, commands/results/log paths, remaining gate and next step. Avoid a second status document.

Update affected implementation claims and plan status in the same change. Finish with the result,
completed validation, commit/artifact location and material remaining gate. Recheck the requested
end state after a write, merge, build or deployment; distinguish each operation's result.
