# History and provenance

Reviewed on 2026-09-08 (Codex), with 2026-09-09 F-03/workflow notes and a 2026-09-10 Cursor/cloud
pass. This is an optional decision index, not startup reading and not evidence that an old
implementation is present now. Current repository source and applicable authored design remain
authoritative for implementation and intended behavior respectively.

Search this index by topic, then read only the matching task's recent user/final messages or the
local transcript needed to settle the question. Cursor, Codex and cloud chats are separate stores:

- Cursor: conversation search plus `~/.cursor/projects/*loro*/agent-transcripts/`
- Codex: `~/.codex/history.jsonl` and `~/.codex/sessions/` (cwd filter for `loro`)
- Cloud: SearchConversations / `bc-*` ids; not present in the local Codex index

Empty or truncated records are not evidence of no work. Stop once current source or the relevant
decision resolves the question. Do not replay archives for ordinary development.

## September 10 Cursor and cloud update

The earlier Codex-only index missed the September 9–10 Cursor and cloud chats. Those chats ran
against sibling worktrees while `origin/main` already contained plan 95 (`scripts/ci-local.mjs`)
and, by `45a2305`, plan 96 account screens. #27 (`35b61a8`) later archived implemented-slice plans
including 95/96; do not look for `plans/96-*.md` at repo root on current main. `git cherry` beats
`--no-merged` after squash. Leftover F-04 slice worktrees are historical, not a merge queue.

| Task / topic                  | Session ID                                | Reusable lesson                                                                                                                              |
| ----------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Worktrees and unmerged review | `e37cc962-b79c-4338-9143-e032fe453811`    | Stay in the named checkout. Use `git cherry`. Fast-forward a behind local `main` before treating it as unique work.                          |
| F-01 account screens          | same thread                               | Named-back must match hardware back; busy back cancels; `signIn` no-ops must not stick connecting state. GitHub conflict flags can be stale. |
| Refactoring strategies        | `29014e75-d0db-4895-87a1-313f51e853fa`    | Document shipped-code debt; do not confuse it with unimplemented plans or add a library rewrite.                                             |
| Native libraries companion    | `950f0924-3526-46bb-b6cd-606305873a95`    | Keep Expo SDK 54, OP-SQLite, sql.js, expo-secure-store; local Maestro is not a cloud farm.                                                   |
| Archive implemented plans     | `997e871f-9703-4750-9e90-d7cdf9cbb3cb`    | Archive `✅` in the same change; `--unfinished` only when asked. Do not mix archive PRs with unrelated feature files.                        |
| Batch phrase export plan      | `8c783eb3-ef96-481d-b4fa-bdac5c7bf6a5`    | Licensed neural voices and AAC export are not plan 61 canonical audio or device TTS.                                                         |
| Music and lyrics generation   | `bc-34b61e55-2555-4664-8a62-db94cacf4115` | Separate `MUSIC_PROVIDER` from TTS. Generated tracks never write `ProgressDelta` or become pronunciation references.                         |
| Generative phrase discovery   | `0678bcab-fc92-48c0-9d26-93e4f7904e47`    | Authored catalog stays the floor; Discover is garnish on the existing add path.                                                              |
| Full-stack voice integration  | `a72bc14c-c061-44b8-8b23-34c080607fae`    | Do not duplicate 61/62/63/86. On-device ASR and recorded PCM stay forbidden as uploads.                                                      |
| Cloud environment setup       | `bc-da6b3fcf-99a0-4b05-a8e3-64d1cdad655c` | Default cloud images may lack Docker/`wasm-pack`; that is not local `pnpm ci:local`.                                                         |

Concurrent untracked `plans/97-*.md` files existed in Cursor worktrees `afa6` and `74hn` during this
review. Allocate above every worktree, not only this checkout's README sentence.

## September 9 workflow update

Reviewed recent Codex task requests, outcomes and selected commands; verified the skill at
`50d0eb1`. Plan 95's runner later landed in-tree: detect `scripts/ci-local.mjs` from current source.
Remaining matched serial/cold/warm comparison is still plan 95's open slice. These observations
refine the existing references; they do not require replaying all earlier chats or copying their
commands wholesale.

| Task                                | Session ID                             | Reusable lesson                                                                                                                                      |
| ----------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Create repository development skill | `01a08144-b1be-7e80-8b79-f9be48c7f0b5` | Missing Expo declarations caused repeated fast-gate failures; check generated prerequisites before typecheck.                                        |
| Review app readiness and plans      | `01a082b2-5d19-7703-9fd5-43846271fbb1` | Cross-agent content integration passed unit checks but broke mobile bundling; test that boundary early and integrate before aggregate CI.            |
| Update from main                    | `01a08588-c1bc-7610-9438-9c60c36d4494` | Repeated import fixes missed parent unmounts and lossy round trips; reproduce through callers and retain revision-specific evidence between reviews. |
| Android emulator bug                | `01a085e4-87c0-7122-a861-199c0acc7ccc` | Wrapper-only tests missed later dotenv and Metro restart behavior; preserve separate build, launch and reconnect evidence.                           |
| parallel CI checks                  | `01a08636-c730-7ca0-876f-06fb1a3afc78` | Bounded `LORO_CI_JOBS` and isolated outputs; detect the current runner rather than copying another worktree.                                         |

## Original September 8 coverage and limitations

The review enumerated the desktop project's active and archived tasks, then checked the local Codex
thread index by Loro project, checkout and Git origin. This found **37 top-level sessions**
excluding the skill-creation task: **33 with conversation content and four empty records**, plus
**59 associated subagent sessions**. All indexed transcript files were available. The desktop
archive list exposed 18 named Loro tasks; one additional archived record was empty. Older CLI
sessions were included even when absent from the desktop list.

The review read user requests, outcomes and technical findings across those conversations and
associated agent reports, with focused repository verification. It did not replay every shell log or
treat historical instructions as new authorization. Active tasks were reviewed as a snapshot; their
later work may supersede findings. No private transcripts, credentials, user-specific addresses or
raw logs are required to use this skill.

The original review baseline was `origin/main` at `f1dde4c` (2026-09-08). The original task checkout
was older (`442d434`), demonstrating why a fresh context check matters. Persistence and broader
native/account integration were still being reconciled in other worktrees; their reported completion
was not promoted to a claim about this baseline.

## Decisions that supersede older advice

| Earlier history                                        | Retained decision / source to check                                                                                              |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| GitHub CI required and run during older merges         | The explicit September 7 local-CI request supersedes it. Follow `CLAUDE.md` and `scripts/ci-local.sh`; keep Actions disabled.    |
| “master” in user requests                              | It means `main` in this repository; preserve the repository instruction.                                                         |
| Repeated wholesale SOLID/DRY refactor requests         | Plans 52/53 record completed work. Inspect residual problems; do not force every GoF pattern or repeat completed decompositions. |
| Old roadmap counts or suggested next IDs               | Inspect all active/archive paths and concurrent work. Several chats collided over 85/88/90; IDs must not be reused.              |
| Historical cloud-ASR or audio-upload exceptions        | The on-device recording promise is absolute. Current privacy and offline contracts supersede those exceptions.                   |
| Azure/Google or archived rejection of ElevenLabs       | Q-15 records ElevenLabs selection. Language/voice/rights acceptance is still distinct from that decision.                        |
| First EC2 run was SSH-only                             | Later catalog HTTPS gateway has a narrow allowlist. Verify current deployment policy; public health does not prove auth or sync. |
| “No native modules / persistence” or fixed test totals | Check the current tree and platform evidence. New implementations were active during this review.                                |
| An original feature branch is not an ancestor of main  | Squash-merge history requires PR/patch/content inspection, not only ancestry.                                                    |

## Top-level source index

Titles below are the desktop titles where available; older CLI records use concise topic labels. IDs
locate exact history through task tools or a local read-only history index when available. The skill
does not depend on either capability.

| Date    | Task / topic                      | Session ID                             | Lesson retained                                                         |
| ------- | --------------------------------- | -------------------------------------- | ----------------------------------------------------------------------- |
| Jul 29  | Planning alignment                | `019fae0b-052f-73c3-88e9-50625063bf29` | Verify code before plan statuses.                                       |
| Jul 29  | Link instruction files            | `019fae0d-0de6-7893-b978-c2450cb0ff29` | Preserve AGENTS symlink.                                                |
| Jul 29  | Meaningful commits rule           | `019fae0e-e200-7c73-a986-b4c3b0d1bede` | Commit coherent work continuously.                                      |
| Jul 29  | Group pending changes             | `019fae19-ca8e-7303-8674-5a85ae1bd894` | Separate ownership; keep dependent chunks buildable.                    |
| Jul 29  | E2E coverage and development rule | `019fae28-b94a-7c92-b5a5-2b3d142cecca` | Manifest coverage; preserve behavior under refactor.                    |
| Jul 30  | Refactor audit                    | `019fb301-ef97-7a31-bbf7-551d3231708f` | Audit existing seams before adding abstractions.                        |
| Jul 30  | Plan 53 implementation            | `019fb30a-ddc4-79a2-8e9a-6750619114e0` | Semantic core output, copy guard, generated tokens.                     |
| Jul 30  | Roadmap reset                     | `019fb30d-a64f-7162-a2ba-a86dcb7fd01e` | Protected 53; archive records; no reused IDs.                           |
| Jul 30  | v1.1 design planning              | `019fb31a-e85a-7eb2-9655-d50b9bab8b11` | Four artifact scopes; planning stays planning.                          |
| Jul 30  | Documentation alignment           | `019fb31c-ea93-7531-ad37-379499fa4fd8` | Current/target separation; remove audio-egress contradictions.          |
| Jul 30  | Design import commit              | `019fb320-31f1-7c10-987a-2907c2a4d570` | Preserve authored bytes and unrelated config.                           |
| Jul 30  | Plans 79/80 implementation        | `019fb343-c7fa-7113-9c11-b0aff777feb6` | Workbench uses production seams and real state evidence.                |
| Sep 1–7 | run the project                   | `01a05cfd-fc98-7e21-8fc8-5f437d7cc88e` | Verify device/bundle connectivity; preserve separate worktrees.         |
| Sep 6   | Define backend API contracts      | `01a076c4-39fd-7031-b6be-796437296f99` | Separate observed contracts, targets and drafts.                        |
| Sep 6   | Plan API integrations             | `01a076c5-98ff-75d1-a8c8-b47e5e70e088` | Isolated provider boundary and contract handoff.                        |
| Sep 6   | Plan multilingual i18n support    | `01a076d3-6519-7451-ad3d-d8444db6fe1a` | Bundled copy, course isolation, review gates.                           |
| Sep 6   | Merge all changes to master       | `01a07705-ac21-70d1-a457-f28b7b4318a6` | Verify actual trunk, conflicts and merged state.                        |
| Sep 7   | Archive and rework plans          | `01a07b7a-4d50-7d92-901b-bc112be492a2` | Reconcile current roadmap and reserved IDs.                             |
| Sep 7   | Identify required API keys        | `01a07b7b-0c85-7763-9f9e-30343467fd20` | Existing SOPS/Compose workflow.                                         |
| Sep 7   | Plan cheap backend infrastructure | `01a07b83-a99d-79c0-a5eb-997c7aba14bb` | Testing architecture and recovery runbook.                              |
| Sep 7   | Rework CI for local runs          | `01a07b8f-a1ca-79d3-97f3-c7214aa0bab8` | Local CI, local APK, verified draft/publication distinction.            |
| Sep 7   | Show .env.example content         | `01a07b94-1713-79c1-a077-32a9d78d8d3d` | ElevenLabs provider selection.                                          |
| Sep 7   | Add Google Apple sign in          | `01a07b95-9d16-7191-9fdc-5fc2e20ba299` | Preserve OAuth and real Postgres/auth verification.                     |
| Sep 7   | Document env variable setup       | `01a07bb4-2b5f-7261-8777-2dc72d085030` | Encrypt env; distinguish content defaults from UI/course locale.        |
| Sep 7   | Install Gitleaks precommit hook   | `01a07bcb-402c-7d20-aec3-a6607badbe08` | Secret scanning and master/main repository rule.                        |
| Sep 7   | Run Loro locally                  | `01a07bd0-6f37-7e61-a26e-ae838f532b87` | Rebuild source snapshot; verify both services.                          |
| Sep 7   | Implement EC2 backend deployment  | `01a07bd1-8300-7cb1-a878-d541084ea397` | SSO/STS, exact-image readiness, rollback.                               |
| Sep 7–8 | Review plans and pick next task   | `01a07bd3-4d27-7601-b50f-009d1461ada2` | Honor review-only scope; atomic persistence, canonical maths.           |
| Sep 8   | Review mobile EC2 readiness       | `01a080ca-48a7-74b0-9dbd-b89319d1116d` | Packaged dependencies, GET-only gateway, real device connectivity.      |
| Sep 8   | Troubleshoot APK error            | `01a080d9-bb08-7fe0-806b-8704ec92cddb` | Hermes ICU initialization and scaled-text geometry.                     |
| Sep 8   | Add mobile app gestures           | `01a080e5-3e9e-7480-b9e2-cb11c9d3c3b9` | Mouse/touch/cancel coverage; diagnose contention before thresholds.     |
| Sep 8   | Implement progress and sync       | `01a080f5-eb25-7882-81e9-3ca82f3b03bd` | Native evidence, auth migration, clock correction and source stability. |
| Sep 8   | Find unmerged branches            | `01a08145-64c2-7bc0-9c9e-fc987d20f846` | Ancestry inventory needs squash-aware interpretation.                   |

Four empty records yielded no lessons: `019fae09-8a90-72a0-adc9-37c469c963c2`,
`019fae23-738d-7a20-a3cf-9ed9b4c4c449`, `019fb333-5473-7411-a0bb-ab4a7ecef7ff`,
`01a07b8e-7bae-77d1-99f0-5d6813d28aec`.

Associated subagent reports were reviewed with their parent task. Particularly useful follow-up
evidence: `01a08112-4073-74a1-9c2e-7fa2eae9ee1a` (integration regression inventory),
`01a080ff-4f4f-7412-8c8f-b5e53d3061a6` and `01a08147-1d2b-73d3-9dee-eb135218de1b` (sync-shadow
correction and regression), `01a0811a-6921-75d3-9104-aad41b93d270` (Metro reload mistaken for an
accessibility failure). Intermediate findings were not treated as unresolved bugs when subsequent
parent/agent evidence recorded a fix.

This index is a dated audit trail. Update the relevant guidance when verified behavior changes; do
not reread every transcript for ordinary development or append an entire conversation here.

During skill validation, the fresh checkout reproduced `touchAction` type errors caused by the
missing ignored `expo-env.d.ts`. The validation reference records regeneration through the installed
Expo CLI; route generation alone did not resolve the failure.

Repository placement and progressive loading follow the
[official Codex skills documentation](https://learn.chatgpt.com/docs/build-skills).
