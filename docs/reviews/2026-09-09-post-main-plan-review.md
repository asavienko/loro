# Post-main review of the 33 implementation plans

**Reviewed:** 2026-09-09. **Branch:** `codex/P3-30-review-engine`. **Initial revision:**
`de81744c7531c20f44d6eacda6be2461d521d62b`; **resolution commits:** `518abb9`, `24dd313`, `7175335`,
`4e61f95`, `a798440`, `66b7f95`, `5d8f36f`. **Base:** incorporated `origin/main` at
`65b64e97bd2f6221552e3d356138976881424b07`. **Requirements:** F-02/F-03/F-04/F-05/F-08/F-09, NAV-*,
P2-07/P2-09/P2-10, P3-30 and P3E-01.

**Disposition: implementation defects fixed; release acceptance remains open.** The six findings in
this review are now covered by runtime guards, focused tests and a green full local gate. All 33
plans retain work or required acceptance. **No additional whole plan qualifies as complete.**
Completed implementation slices are recorded in the
[dated archive](../../plans/archive/2026-09-09/IMPLEMENTED-SLICES.md), with their remaining owners.
Plans 56–65 were already user-archived as partial plans; their location is unchanged.

A follow-up pass against the current `origin/main` also corrected four implementation defects: the
native binding cleanup now preserves trailing type characters and generated identifiers; Android
document-provider selections are copied to a local cache before streaming; Refrain refreshes its
wave gate when the local minute changes while the route is open; and iOS evidence manifests retain
the artifact revision, path, digest and size. Focused regressions and the full learner E2E suite
pass; native consumer compilation and physical-device acceptance remain open.

This review covers the branch diff, affected runtime callers, plan headers/remaining criteria and
the implemented route registry. Unchanged native, infrastructure and gated product areas were
checked for scope and ownership; this is not a fresh device, deployment, linguistic or security
certification. Runtime code, an isolated foundation and a completed product plan are distinct.

## Findings

### B1 — P2: valid browser files cannot be imported — resolved

**Owners:** 56/58/65. In [add.tsx](../../apps/mobile/app/add.tsx), `chooseFile` always constructs
`new File(asset.uri)` from `expo-file-system` and calls `.stream()`. Installed Expo 19.0.23's web
`FileSystemFile` is an unsupported stub; `File.readableStream()` calls its absent `open()` method.
The document picker already supplies the browser `File` as `asset.file`.

**Resolution:** web selection now streams the picker-provided `asset.file`; native selection keeps
the Expo URI reader. Both paths use the bounded byte reader and strict decoder, and a browser file
chooser regression imports `Hola<TAB>Hello` into the review field.

**Fix A:** add web/native reader adapters. Web streams `asset.file`; native streams a supported
provider URI. Both feed the existing byte limiter and strict decoder. Revoke owned object URLs after
use. **Option B:** keep paste import and hide the unsupported web file action until ready. Accept
only after valid `.txt`/`.tsv`, invalid encoding, cancellation and oversized-file browser tests
pass; retain native document-provider testing separately.

### B2 — P2: picker errors and late results bypass the import recovery policy — resolved

**Owners:** 59/65/87. In [add.tsx](../../apps/mobile/app/add.tsx), `getDocumentAsync()` is outside
the `try`, while `onPress` discards the promise with `void chooseFile()`. Picker rejection is
therefore unhandled. After selection, an asynchronous stream can still call `updateInput` after the
learner has edited the text or started another selection. There is no request generation,
mounted/pair check, abort or busy control. An older result can overwrite a newer draft.

The import editor is now keyed by its native/target pair, and a request generation is invalidated on
edits, pair changes and unmount. Picker selection, byte reading and decoding share one caught
boundary; only the current request can publish text after the durable draft write.

**Fix A:** put selection and reading inside one error boundary, bind a request token to the
native/target pair, invalidate it on edits/unmount/pair change, and commit only the current result.
Key or reset the editor by pair; publish the recovered text only after the durable save succeeds.
**Option B:** disable overlapping selection/editing while reading, with cancellation and pair
invalidation. Test rejection, overlapping selections, editing during read, pair switch and storage
failure. The earlier R4/R5 closure covered bounded reads and serialized edits, not these cases.

### B3 — P2: corrupt release metadata permits a catalog downgrade — resolved

**Owners:** 61/66/86. [contentRelease.ts](../../apps/mobile/src/data/contentRelease.ts) treats a
malformed installed release pointer as `undefined`. Both monotonic checks then treat the device as a
first installation. A previously signed older release can replace newer installed content.

**Resolution:** an absent release pointer remains an initial install, but malformed or structurally
invalid metadata now throws before candidate verification/activation. The SQLite regression proves a
corrupt pointer cannot be replaced by a signed older candidate.

**Fix A:** distinguish absent from corrupt metadata and fail closed on corruption. **Option B:**
recover a trusted version/hash high-water mark from independently validated installed catalog
metadata before activation. Verify corrupt/truncated/wrong-language/hash pointers, same-version
collisions and concurrent candidates. Real signing keys, multilingual installation and publication
remain separate implementation tasks.

### B4 — P2: duplicate chat choice IDs pass validation and select the wrong edge — resolved

**Owner:** 82. [chat-topic.ts](../../packages/core/src/api/chat-topic.ts) validates unique node IDs
and resolvable edges, but does not require unique suggestion IDs within a node. `advanceChatTopic`
finds the first matching ID.

**Resolution:** the resource schema rejects duplicate suggestion IDs within each node, with a
regression covering the ambiguous graph. `advanceChatTopic` therefore receives an unambiguous edge
identity; stale-turn validation remains coordinator work.

**Fix A:** reject duplicate suggestion IDs within each node and test the exact failing graph.
**Option B:** change action identity to a validated node/edge key with unambiguous lookup. Keep
stale-turn validation in the future coordinator; accepting a caller-supplied node alone cannot prove
that it is still the thread's active node.

### B5 — P2: Refrain navigation acceptance depends on the wall clock — resolved

**Owners:** 64/72/81. [navigation.spec.ts](../../apps/mobile/e2e/navigation.spec.ts) onboards with
the real browser clock and immediately expects Start wave or an active Leave practice control. The
new production guard correctly locks entry before 08:00, making these tests time-dependent.

**Resolution:** active-session navigation tests freeze an open-wave instant before onboarding. The
pause test now records a rep, pauses, reloads, resumes the same cursor/wave, ends, reloads and
confirms the resume action is gone. The finished-session screen retains precedence over the next
wave lock, and the persistent spine resume control meets the 44 px touch-target floor. Boundary and
pre-wave guard tests remain separate.

**Fix:** freeze an open-wave time before onboarding in active-session tests. Add separate tests for
pre-wave, boundary crossing, paused earlier waves and midnight. In particular, the test named
“pauses durably” currently neither records a rep nor reloads; add rep → pause → reload → same
cursor/wave and End → reload to prove its stated acceptance.

### B6 — P2: the branch still fails the full formatting gate — resolved

**Owners:** 72/94. The four remaining implementation/document paths from the reviewed revision are
now formatted, and `CI=1 pnpm format:check` passes. `pnpm check` remains the fast gate; the full
local CI result is recorded below.

The formatting repair was limited to the previously listed authored files; no design or generated
artifact was hand-edited.

## Plan-by-plan disposition

“Inherited” means present on main and retained by this branch, rather than newly delivered here.
Each numbered link resolves to the owning plan. All rows have remaining scope; a foundation with an
open defect is not listed as an accepted feature in the implementation archive.

| Plan                                                                                                | Verified implementation / branch contribution                                                                                                                | Remaining work and gate                                                                                                                           |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| [56](../../plans/archive/2026-09-09/56-navigation-failure-and-input-shell.md) Navigation/input      | Surface laws/group metadata, built-route filtering and cold/active Refrain escapes; browser file selection and request isolation now pass.                   | Exhaustive failure/input/keyboard/list behavior and native Back/focus.                                                                            |
| [57](../../plans/archive/2026-09-09/57-runtime-design-system.md) Design system                      | Settings values feed `ThemeProvider`; inherited production control states and tabular numerals remain.                                                       | Fonts/provenance, dark theme, motion/haptics and device rendering; workbench state coverage.                                                      |
| [58](../../plans/archive/2026-09-09/58-native-workspace-and-device-ci.md) Native workspace          | Inherited CNG/SQLite/native bridges and main's development identity; simulator evidence collector, retained artifact metadata and regenerated bindings.      | Full iOS compilation, physical-device harness/signing and native evidence collection. Collector tests are not collected device evidence.          |
| [59](../../plans/archive/2026-09-09/59-device-persistence-and-resume.md) Persistence                | Wave codec/hydration, local pair-draft map and request-scoped import editor; inherited atomic progress/outbox transactions.                                  | Upgrade/crash/timezone and cross-device acceptance, erasure integration.                                                                          |
| [60](../../plans/archive/2026-09-09/60-authoritative-core-maths.md) Core maths                      | Inherited Rust FSRS/merge/ranking/clocks; notification candidates plus matching committed Swift/Kotlin exports.                                              | Native consumer/parity and device-floor evidence; no completed DSP/onset claim.                                                                   |
| [61](../../plans/archive/2026-09-09/61-content-and-audio-assets.md) Content/audio                   | Shared signed-release schema/verifier and transaction activation helper now fails closed on corrupt pointers; no runtime updater.                            | Real signature/key rotation, bounded fetch, multilingual installer/publication and bilingual review. Q-15 gates production audio.                 |
| [62](../../plans/archive/2026-09-09/62-native-audio-playback.md) Playback                           | Inherited foreground TTS/controller; isolated transition contract.                                                                                           | Wire contract into native owner; recorded/cache/rate/background transport, interruptions and Q-15 assets.                                         |
| [63](../../plans/archive/2026-09-09/63-native-speech-speak-and-latency.md) Speech                   | Inherited on-device ASR/reveal; onset metadata parser added. Native emitters still supply null latency.                                                      | Real same-clock measurement/calibration and active-generation matching; parser validity alone is not measurement provenance.                      |
| [64](../../plans/archive/2026-09-09/64-today-and-refrain-production-loop.md) Today/Refrain          | Timed entry, wave-aware codec, shared resume selection, active Pause/End paths, local-minute gate refresh and deterministic open-wave navigation acceptance. | Drills/tails, completion/boundary matrix, audible modes via 62/63 and Q-14 peak acceptance.                                                       |
| [65](../../plans/archive/2026-09-09/65-import-and-capture.md) Import/capture                        | Paste/review limits, canonical edited TSV, per-pair durable map, bounded reader, browser adapter, request isolation and cache-backed native provider reads.  | Physical provider/encoding acceptance, picker/storage recovery coverage and on-device OCR.                                                        |
| [66](../../plans/archive/2026-09-09/66-backend-contract-data-and-security.md) Backend               | Inherited durable auth/sync and shared runtime contracts; release contract reused in content verifier.                                                       | B3 and actual content endpoint/publication; remaining legacy boundary migration, load/security/image acceptance.                                  |
| [67](../../plans/archive/2026-09-09/67-anonymous-auth-and-account-lifecycle.md) Accounts            | Inherited optional provider/email identity, refresh rotation and installation binding; retained by merge.                                                    | Linking, recovery/export/erasure policies and UI, real provider/device journey.                                                                   |
| [68](../../plans/archive/2026-09-09/68-sync-and-offline-convergence.md) Sync                        | Inherited durable convergence/backoff; quarantine count now reaches Account.                                                                                 | Correction/rescue/export, OS background execution, two-device failure matrix; compensation policy before Review Undo.                             |
| [69](../../plans/69-trip-domain-and-arc.md) Trips                                                   | No new durable trip implementation; draft contracts only.                                                                                                    | Q-07 semantics before schema/lifecycle; then routes, course-bound history and honest readiness.                                                   |
| [70](../../plans/archive/2026-09-09/70-survival-widgets-and-notifications.md) Widgets/notifications | Pure Rust candidate ordering/policy plus generated exports.                                                                                                  | Native scheduler/day partitioning/DST/permission/cancellation, Survival/widgets; Q-07 for trip candidates.                                        |
| [71](../../plans/archive/2026-09-09/71-settings-telemetry-and-experiments.md) Settings              | Reachable durable accent/motion/consent controls; language flow inherited.                                                                                   | Telemetry queue/transport, privacy-safe events and flags; Q-05 for experiment activation.                                                         |
| [72](../../plans/archive/2026-09-09/72-release-quality-gates.md) Release checks                     | Expanded route/state and pseudo-label tests; deterministic navigation and format gates now pass; inherited a11y/geometry/workbench/bundle harnesses.         | Complete combined CI and broad pseudo/device/performance matrices; Q-14 and human sign-off stay open.                                             |
| [73](../../plans/archive/2026-09-09/73-delivery-observability-and-slos.md) Delivery/SLOs            | Inherited health/deployment tooling; docs clarify development versus production operations.                                                                  | Production rollout/store artifacts, telemetry/SLO enforcement and operational acceptance from 88.                                                 |
| [74](../../plans/74-monetization-and-entitlements.md) Monetization                                  | No purchase module or paywall; gated draft boundary retained.                                                                                                | Q-08 pricing and Q-12 billing before product behavior; offline entitlements afterward.                                                            |
| [75](../../plans/archive/2026-09-09/75-review-and-memory.md) Review/Memory                          | Exported pure `ReviewEngine` plans due items and calls canonical FSRS for explicit grades. No runtime constructor.                                           | Canonical due order, **remaining daily** budget rather than per-session cap, conformance, durable route/checkpoint, Memory; Undo after 68 policy. |
| [76](../../plans/archive/2026-09-09/76-roleplay-and-live-ai.md) Roleplay                            | Shared two-scene bundled catalog consumed by API fallback; real provider coordinator absent.                                                                 | Reviewed offline route/turn persistence/resume, locale content and guarded live budget/safety/retention.                                          |
| [77](../../plans/archive/2026-09-09/77-dsp-and-speech-labs.md) DSP/labs                             | Derived-study evaluation CLI and tests; inherited signal helpers.                                                                                            | Consented corpus, actual scorer/pipeline and independent quality evidence before labs; no synthetic quality claims.                               |
| [78](../../plans/78-conditional-run-and-phrasebook.md) Run/Phrasebook                               | Inherited ladder helpers; routes/engine absent.                                                                                                              | Q-05 and comparative M3 evidence; ordinary owned-phrase search can proceed under 56/81.                                                           |
| [80](../../plans/archive/2026-09-09/80-dev-design-system-workbench.md) Workbench                    | Inherited 33-export registry, gallery and production exclusion; no new gallery implementation in this branch.                                                | Cyrillic/long-copy and full production-state/navigation specimens; real geometry and exclusion acceptance.                                        |
| [81](../../plans/archive/2026-09-09/81-navigation-spine-switcher-and-more.md) Spine/More            | Shared resume selector, active Refrain exit sheet and deterministic open-wave navigation acceptance; inherited grouped More/navigation menu.                 | Stream/Speak/session/flow exits, real search/counts/context and travelling audio; Q-17 only final rail priority.                                  |
| [82](../../plans/archive/2026-09-09/82-guided-chat-domain-and-service.md) Chat domain               | Exported graph schema/traversal now rejects duplicate suggestion IDs, currently test-only.                                                                   | Reviewed topics, thread repository/coordinator, Q-19 retention, Q-18/Q-20 live limits and Q-16 launch.                                            |
| [83](../../plans/83-open-chat-and-message-inspector.md) Chat UI                                     | Both routes still declared planned; no new screen.                                                                                                           | Text/offline UI after 82 persistence; real inspector/keep handoffs, voice via 62/63 and Q-16 release.                                             |
| [86](../../plans/archive/2026-09-09/86-provider-integrations.md) Providers                          | Inherited identity verification and Anthropic concurrency/transport; AI fallback now reuses shared scenes.                                                   | Real storage/signature adapter for 61, runtime registration and feature-owned cancellation/spend/output/retention controls.                       |
| [87](../../plans/archive/2026-09-09/87-multilingual-app-and-language-selection.md) Multilingual     | Inherited seven-pair course/API isolation; new copy and regenerated pseudo resources.                                                                        | B2; exact-material human approval and all-pair device/voice/long-copy acceptance.                                                                 |
| [88](../../plans/archive/2026-09-09/88-low-cost-backend-infrastructure.md) Testing infrastructure   | Copied-backup integrity verifier and restore checklist; historical EC2/Google/restore records inherited.                                                     | Scheduled verified off-host retention, restore/load/alerts/cost and consent-to-device proof; preserve infrastructure ownership.                   |
| [90](../../plans/archive/2026-09-09/90-default-english-content-language.md) English target          | Existing registry-derived validation retained; English is still UI/native language, not a learning target.                                                   | Canonical dialect, `CONTENT_LANG` reader/default migration, catalog/API/native identity and bilingual approval.                                   |
| [93](../../plans/archive/2026-09-09/93-mobile-shell-gestures.md) Gestures                           | Inherited pull/dismiss behavior; browser mouse/touch regression passes after merge.                                                                          | Physical iOS/Android touch and assistive-technology acceptance; browser evidence alone does not close this plan.                                  |
| [94](../../plans/archive/2026-09-09/94-persistent-practice-and-account-integration.md) Integration  | Existing SQLite/core/speech/accounts retained; wave codec, resume, import and format repairs verified by fast/focused checks.                                | Complete combined CI; exact-build iOS, provider and two-device speech/convergence acceptance.                                                     |

## Verification

- `pnpm check`: **passed, exit 0**, 23/23 Turbo tasks. Includes Android configuration, deployment,
  native-evidence/DSP fixtures and contracts. PostgreSQL-dependent tests skipped by the ordinary
  unit command are not database acceptance.
- `CI_BASE_REF=origin/main pnpm ci:local`: **passed, exit 0**. The complete local pipeline ran
  install, Rust/WASM and token generation, the fast gate, PostgreSQL auth tests, formatting,
  commitlint, learner/pseudo/workbench/production browser suites, mobile/API builds and smoke,
  API-image validation and the core benchmark.
- Focused Chromium, `CI=1 LORO_E2E_PORT=8264`, one worker, no retries: browser file import and the
  three active-session navigation/double-press tests passed. The full CI run also passed the
  complete E2E suites.
- Mobile unit/typecheck/lint: **passed**, 446 tests, lint and typecheck. Core unit/typecheck/lint:
  **passed**, 254 tests, lint and typecheck. The corrupt-pointer and duplicate-suggestion regression
  tests are included in those totals.
- `CI=1 pnpm format:check`: **passed, exit 0** after formatting the four paths listed in the prior
  review. No generated or authored design artifact was hand-edited.
- Native physical-device speech/audio, iOS compilation, live providers, AWS operations and
  bilingual/device acceptance remain separate release gates and were not claimed by this review.

The original reproduction steps and traces remain in the earlier review history; ignored browser
traces may be overwritten by later runs.

## Implementation order

1. Keep the fixed import, release-pointer and chat-graph guards covered as their owning features
   grow; native picker/device evidence is still required for 58/65.
2. Deliver the remaining daily-loop and durable Review slices (64/75/81), then independent text
   content (61/66/86) and account recovery (67/68). Device/human/operations acceptance runs
   alongside.
3. Keep 69/74/78/90 decisions explicit; do not archive those unbuilt products as implemented.
