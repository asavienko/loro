# Implementation review: 33 roadmap plans

**Reviewed:** 2026-09-09. **Code revision:** `828d296` on `codex/P3-30-review-engine`. **Change
range:** `cf15586..828d296`, with existing runtime inspected for the requested plans.
**Requirements:** F-02/F-03/F-04/F-05/F-08/F-09, NAV-_, LB-_, P2-07, P3-30 and the requirement IDs
in the individual plans.

**Historical disposition: remediation implemented in part.** The
[post-main review](2026-09-09-post-main-plan-review.md) at `de81744` supersedes current-state claims
here: picker/platform recovery and full validation remain open.

**Original follow-up record:** The review at `828d296` found the defects below. The follow-up
implementation repairs R1–R7; the matrix still records the incomplete and externally gated work for
the 33 plans. It does not claim those plans complete or release-ready.

Evidence levels below mean different things: **runtime** has a caller in the app/service;
**foundation** is a helper/contract tested in isolation; **unbuilt** has no corresponding product
surface; **gated** needs a named decision or external evidence. A plan can contain all four.
Historical test/device/deployment records are dated evidence, not proof for this revision.

## Remediation record

The following changes were made after the reviewed revision:

- **R1:** the shared checkpoint codec now validates the optional `morning`/`midday`/`evening` wave
  and SQLite hydration preserves it. A real storage relaunch test covers the route-produced shape.
- **R2/R3:** Refrain supplies Leave only for an active session with its exit sheet mounted. Cold and
  terminal routes keep a working parent/Today escape. Today, the spine and Refrain share one
  checkpoint-aware selector, so a valid paused wave remains resumable after another wave opens.
- **R4/R5:** drafts are keyed by native/target pair and each review edit persists a lossless,
  re-previewable TSV representation. File selection uses Expo FileSystem streams, rejects declared
  oversize files before reading, and cancels a stream as soon as it crosses the byte budget.
- **R6/R7:** full UniFFI output is regenerated, its generator normalizes generated whitespace,
  pseudo-locale resources are regenerated, lint/format issues are fixed, and the affected tests
  pass. The private branch history has valid scopes, lowercase requirement IDs and requirement
  references.

Follow-up verification: `pnpm check` passed; the focused eight-test navigation suite passed with one
worker and no retries; core/mobile typechecks and the 58 affected unit tests passed. Full local CI
and device/provider acceptance remain separate release gates.

## Verification performed

| Check at the reviewed revision                                                                      | Result                                                                                                                                                                                                                                            |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm check` with Node 22 and Cargo on PATH                                                         | **Failed**, exit 1: two core lint errors listed in R7. Turbo stopped before aggregate completion. Route ownership, deployment fixtures, native-evidence fixtures, DSP fixtures, contracts and browser-source drift checks completed before Turbo. |
| `pnpm --filter @loro/mobile test`                                                                   | **Failed**, exit 1: 435 passed, 1 failed across 43 files. Failure is pseudo-locale fixture drift.                                                                                                                                                 |
| `pnpm --filter @loro/mobile typecheck`                                                              | **Passed**, using the existing generated Expo environment/route declarations.                                                                                                                                                                     |
| Isolated navigation Playwright, `CI=1 LORO_E2E_PORT=8257`, one worker, zero retries                 | **4 passed, 4 failed**, completed in 2.1 minutes. Cold Refrain escape, shared-menu traversal, More return, and Refrain pause/end flow fail. Unknown-route recovery, Add Back, Escape/focus restoration, and browser pull gestures pass.           |
| Direct `encodeCheckpoint` / `decodeCheckpoint` probe with `refrainResume.wave`                      | Encoding throws `Invalid course checkpoint`; decoding returns `null`. See R1.                                                                                                                                                                     |
| `pnpm exec commitlint --from cf15586 --to HEAD`                                                     | **Failed** on four commits; see R7. This range covers the implementation wave, not the whole branch history.                                                                                                                                      |
| Scoped Prettier check of five changed implementation files                                          | **Failed** for `audioSessionContract.ts` and `chat-topic.ts`. Not a full formatting inventory.                                                                                                                                                    |
| Full local CI, native builds/device tests, live providers/AWS, full browser/workbench/export suites | **Not run in this review.** Existing failures already prevent acceptance; no new hardware, deployment or linguistic approval is claimed.                                                                                                          |

Temporary logs are `/tmp/loro-33-plan-review-{check,mobile,navigation,commits,format}.log` on the
review machine. Browser traces/screenshots are under ignored `test-results/mobile-e2e/`. They may be
overwritten by later runs; the outcomes and reproduction instructions above are the durable record.

The earlier task's final answer saying the combined `pnpm check` passed is superseded by this
verification. The isolated navigation failures are not adequately explained by concurrent SQLite
writers: R1 reproduces without a browser, and the browser reaches that same storage-recovery state.

## Findings and repair options

### R1 — P1: new Refrain wave identity is rejected by persistence — resolved

**Plans:** 59, 64, 81, 94. **Evidence:**
[`refrain.tsx:337`](../../apps/mobile/app/practice/refrain.tsx#L337) writes a checkpoint containing
`wave`; [`learner.ts:375`](../../apps/mobile/src/data/learner.ts#L375) passes the whole resume
object to `encodeCheckpoint`;
[`checkpoint.ts:165`](../../packages/core/src/persistence/checkpoint.ts#L165) permits only
`session/cursor/lastLatency/history/done`. The core type also lacks `wave`. Hydration in
[`learner.ts:114`](../../apps/mobile/src/data/learner.ts#L114) reconstructs the object without wave
identity.

**Effect:** starting a wave attempts a transaction that fails validation. The store reports a
persistence failure, practice does not become usable, and the app shows “Your progress could not be
opened.” This occurs in the fresh one-worker browser run. Adding the field only to TypeScript's
mobile interface did not extend the runtime codec. Ignoring it on write would also lose it on
restart.

**Recommended option A:** extend the shared checkpoint contract with a validated optional wave enum,
preserve it through encode/decode and hydration, and explicitly migrate/infer legacy entries. Use
the same shared resume shape in mobile rather than a separately drifting interface. Keep unknown
fields rejected. **Option B:** remove the new wave-aware navigation feature and return to the prior
validated checkpoint as an emergency rollback; this defers plan 81 rather than completing it.

**Acceptance:** real SQLite start → rep → Pause → reload → same wave/cursor; End → reload without
resume; all three waves; legacy/malformed wave values; storage failure preserves prior state;
cross-course switch and late attempt. Include the actual route-produced object, not only hand-built
codec fixtures. All four navigation failures need rerunning after repairs.

### R2 — P2: Leave practice can point at an unmounted exit sheet — resolved

**Plans:** 56, 64, 81. [`refrain.tsx:98`](../../apps/mobile/app/practice/refrain.tsx#L98) always
overrides the header with Leave practice. Empty, locked, complete, finished and unresolved-phrase
branches return before the `ExitSheet` at line 230. Clicking Leave only sets state in those
branches; there is no sheet to display. The cold-entry regression visibly replaces the expected
Today escape with Leave practice. Warm More traversal also still expects Back, while the route
unconditionally replaces it.

**Recommended A:** derive the header from a pure session-state/exit policy. Idle, empty and terminal
states retain a working parent/home escape; actual resumable work uses Pause/End/Keep going. Render
the exit controller outside conditional bodies and handle pending plan/write states. **B:** move
exit ownership into the shared shell for all session routes; broader work but prevents
Stream/Speak/Refrain policies diverging. Preserve normal Back for ordinary Push routes.

**Acceptance:** exercise Leave/Back from empty, pre-wave, completed, error, loading and active
states; verify cold home and warm parent behavior, Android Back and sheet dismissal, plus accessible
focus. Update More's test to use the approved session exit behavior; do not just delete the
assertion.

### R3 — P2: Today, the spine and Refrain disagree about a saved wave — resolved

**Plans:** 56, 64, 81. [`index.tsx:169`](../../apps/mobile/app/index.tsx#L169) hides Resume unless
the saved wave equals `waveEntry`'s current wave.
[`_layout.tsx:56`](../../apps/mobile/app/_layout.tsx#L56) offers ongoing work whenever a non-done
checkpoint exists. The route selects the current wave, but
[`refrain.tsx:320`](../../apps/mobile/app/practice/refrain.tsx#L320) gives a saved wave precedence
and line 331 reuses any existing session. After a paused morning wave crosses 13:00, Today can say
Start midday while the spine and route still refer to morning. R1 currently blocks normal creation
of new wave-bearing checkpoints; this conflict becomes reachable once R1 is repaired.

The authored
[Navigation artifact](../../design/Language%20Learning%20by%20Phrases%20-%20V1.1/Navigation.dc.html)
lines 461 and 520–575 requires one ongoing-work model across the three views, with marks expiring
with the day's set. The previous integration's “same currently ready wave only” restriction was not
reconciled with that rule.

**Recommended A:** one selector decides resumability by course/day/content/checkpoint; resumable
work takes precedence over new-wave entry until ended or expired. Timing guards still apply to
starting new work. **B:** atomically transfer a checkpoint to the newly opened wave, preserving
earned attempts and cursor, if product semantics explicitly adopt that behavior. Document this
design divergence before implementing it. Do not silently change the wave at rendering time.

**Acceptance:** pause before a boundary and resume after it; same checks from Today, spine and URL;
completed gaps, midnight, timezone changes, changed/deleted content and course switching. Freeze
clock values in browser fixtures so tests work before 08:00 as well as during daytime.

### R4 — P2: import review edits are not part of durable recovery — resolved

**Plans:** 59, 65, 87. [`add.tsx:618`](../../apps/mobile/app/add.tsx#L618) saves raw input, but
[`add.tsx:649`](../../apps/mobile/app/add.tsx#L649) only updates React state when the learner edits
reviewed target/meaning fields. Restarting or leaving/remounting before Add restores the original
raw input, losing those corrections. The “durable draft” claim therefore covers raw text and the
post-save remainder, not the editable review. A single `import-draft` key also replaces another
course's draft when typing in a second pair; matching identity on hydration does not preserve both.

**Recommended A:** persist a bounded, versioned draft per target/native pair containing the review
stage and edited candidates (or a lossless serialization of them). Route all edit and partial-save
transitions through this owner; clear only the owning completed draft. Bind async file selection and
local React state to that pair. **B:** persist only canonical edited text after every review change
and explicitly re-preview on return; smaller schema, less exact UI restoration.

**Acceptance:** edit a meaning → leave/restart → correction survives; create drafts in two pairs →
both survive; switch pair while a picker is open; simulate quota/SQLite failure during draft writes
and partial saves. No imported phrase enters sync before explicit Add.

### R5 — P2: file-size enforcement happens after reading the whole file — resolved

**Plans:** 56, 58, 65. [`add.tsx:626`](../../apps/mobile/app/add.tsx#L626) fetches the selected URI
and awaits the entire `arrayBuffer()` before
[`decodeImportFile`](../../apps/mobile/src/lib/importFile.ts) enforces its roughly 60 KB limit. A
very large text file can exhaust memory before rejection. The picker call is also outside the `try`,
so picker failure rejects the handler without the intended error state. Pure decoder tests do not
exercise either behavior.

**Recommended A:** introduce a platform file-reader boundary that checks available size/extension
metadata first and stops reading at limit + 1 bytes even when metadata is absent or wrong. Catch
selection as well as read errors, preserve existing input, and disable or invalidate overlapping
requests. Use an installed-SDK-supported native document URI reader and verify cache/provider URI
access on iOS and Android. **B:** keep paste import available and defer the file button until a
bounded native reader is ready.

**Acceptance:** huge file rejected without a full allocation; unknown or dishonest size; picker
exception/cancel; read permission revoked; local and document-provider files; invalid UTF-8; a late
selection cannot overwrite newer text or another course's draft.

### R6 — P2: notification UniFFI source and committed bindings disagree — resolved

**Plans:** 58, 60, 70, 72. [`notify.rs:68`](../../packages/core-rs/src/notify.rs#L68) adds
`NotificationCandidate`, expands `PlannedNotification` and exports `plan_notifications`. Committed
[`loro_core.swift:1505`](../../packages/core-rs/bindings/loro_core.swift#L1505) and
[`loro_core.kt`](../../packages/core-rs/bindings/uniffi/loro_core/loro_core.kt) retain the old
four-field notification record and lack the new planner/candidate interface. The final
implementation commit regenerated browser WASM only. The mobile JSON dispatcher also does not expose
this planner yet; this is a Rust foundation, not a native scheduling feature.

**Recommended A:** run the full host/WASM/UniFFI generator, review all changed Swift/Kotlin/header
outputs, and commit them separately. Add either a typed JSON dispatcher operation or a native
adapter calling the generated function; keep one Rust policy. **B:** keep notification candidate
planning internal to Rust until a consumer is ready and remove its premature public FFI changes. Do
not hand-edit generated records or treat browser source hashes as native ABI verification.

**Acceptance:** regeneration leaves a clean tracked tree, both binding languages expose matching
fields/functions, actual native callers compile, and fixtures cover cap/quiet hours/route filtering.
Platform scheduling, cancellation, day partitioning/DST and foreground suppression remain separate.

### R7 — P1: the implementation is not passing the required gates — fast/history repaired; full gate open

**Plans:** 58, 60, 72, 75, 87, 94. Current failures:

- `packages/core/src/engines/review.test.ts:124`: unused `_grade`.
- `packages/core/src/engines/review.ts:157`: required optional-chain style.
- `apps/mobile/src/lib/i18n/pseudoLocale.test.ts:23`: committed `en-XA.json` differs from generated
  English resources, including the new sync and wave messages.
- Scoped Prettier: `apps/mobile/src/lib/audioSessionContract.ts` and
  `packages/core/src/api/chat-topic.ts`; broader changed-file formatting still needs checking.
- Commitlint: `490e18a` uses unsupported scope `persistence`; `88f7327`, `cba8738`, `2a0b438` put
  uppercase requirement IDs in lowercase-only subjects. `e8c09d1` and `828d296` also omit
  requirement IDs requested by the repository convention, although that omission is not the observed
  lint error.

**Recommended A:** fix the lint issues, regenerate pseudo resources with the existing generator,
format only changed authored files, regenerate bindings, then run sequential verification on the
combined tree. Reword private branch commits to valid scopes/lowercase subjects while retaining
requirement IDs. **B:** if history must be preserved, integrate through an approved squash with a
valid subject and run the relevant history gate against that actual integration history. A new
correctly named commit alone does not repair old commits checked by `--from`.

**Acceptance:** `pnpm check`, complete learner E2E, workbench and production export suites,
generated drift and `CI_BASE_REF=origin/main pnpm ci:local` pass at the actual reviewed revision.
Retain exit codes/logs. Do not substitute historical plan-94 success or isolated agent tests for
combined CI.

## Foundations that need integration before they can ship

These are readiness gaps, not claims that an uncalled helper is currently corrupting learner data.

- **Review (75):** `ReviewEngine` is not constructed by the mobile runtime, and Review/Memory routes
  are still planned. Its `slice(0, dailyMinutes * 4)` limits each newly planned session, not all
  reviews over the local day. [Scheduling](../architecture/scheduling.md#daily-load) requires a
  daily cap and due-date overflow order. Supply a canonical ordered due query plus the remaining
  budget derived from committed review history; persist engine-specific checkpoints and grades
  atomically. A smaller first release can expose due reviews without Undo/Memory, but must retain
  the daily budget and empty/unscheduled states. Add the engine to conformance coverage.
- **Content (61/66/86):** `activateContentRelease` is used only by its tests. Its test installer
  writes a marker table, not the production catalog, and its verification ports are test doubles.
  Supply a trusted signature/key-rotation adapter, real catalog validator/installer, bounded fetch,
  signed publication and loader activation. `readInstalledContentRelease` treats a corrupt pointer
  as missing; fail closed or recover the high-water mark from installed catalog metadata before
  allowing updates, so pointer corruption cannot bypass rollback protection. The current release
  schema targets `Catalog`; explicitly reconcile that with the multilingual `LearningCatalog`
  consumed by current course flows before publishing any of the seven pairs.
- **Audio/onset (62/63):** the session transition validator has only test callers; native modules
  still emit null latency. `latencyFromNativeOnset` checks a supplied session ID and validates that
  generation is an integer but does not compare it with an expected active generation. Carry an
  authoritative `(sessionId, generation)` through the real audio controller and reject stale events
  before measurements reach a practice delta. Keep null until real same-clock native emission is
  implemented and calibrated. Timestamp-schema tests are not onset-accuracy evidence.
- **Chat (82):** schema/traversal do not supply a thread store, authored topic packs, turn IDs or
  coordinator. Before consumption, reject duplicate suggestion IDs within a node and define how
  stale turn/version checks prevent an otherwise valid old node/suggestion from advancing the
  current thread. Keep local thread retention distinct from kept-phrase sync and live provider
  retention.
- **Roleplay/providers (76/86):** shared scenes are useful offline material, but Nest still injects
  only `StubSceneProvider`; Anthropic is an unregistered transport. Complete the local route/session
  first or build the coordinator against fake transports while decisions are resolved. Enabling live
  calls requires principal admission, atomic spend, prompt/output validation and approved retention.
- **DSP (77):** derived-results evaluator is not acoustic analysis. Before a real study, freeze the
  analysis plan, independently review how disputed annotations are adjudicated, and whether repeated
  phrase/speaker observations require clustered resampling. Do not tune thresholds using the release
  evaluation set. Implement and evaluate the actual device pipeline; a JSON fixture passing the
  evaluator does not close M1 or M3.
- **Operations (73/88):** backup checksums and retained APK hashes prove specific artifact
  properties. They do not prove remote retention, PostgreSQL restoration, permissions after restore,
  installed APK identity, or a two-device signed-in journey. Collect those as separate acceptance
  records.

## Per-plan assessment and implementation options

All 33 requested plans appear exactly once below. **A** is the recommended next implementation
slice; **B** is a bounded alternative or deliberate deferral. “Remaining” includes ordinary code
work even where another part of the plan needs external evidence. No new plan number is required.

| Plan                                                                                               | Verified current state / main gap                                                                                                 | A: recommended next change                                                                                            | B: alternative and tradeoff                                                                                        | Evidence needed to close the slice                                                                                                                 |
| -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| [56](../../plans/archive/2026-09-09/56-navigation-failure-and-input-shell.md) Navigation/input     | Runtime registry, route guard and shell; session escape regression R2; exhaustive route laws, failure/input/list work incomplete. | Fix R2/R3 and centralize the work-at-stake/exit policy, then keyboard and virtualized owned-phrase lists.             | Repair Refrain alone first; faster but Stream/Speak still need common session policy.                              | Cold/warm/empty/error routes, deep-link collision, keyboard, large library, 200%/310% and native input.                                            |
| [57](../../plans/archive/2026-09-09/57-runtime-design-system.md) Design system                     | ThemeProvider, four accents, control states and local preference wiring; fonts/dark/haptics/motion incomplete.                    | Complete provenance-approved fonts and runtime variants incrementally with real component specimens.                  | Retain light theme/system fonts for an explicitly scoped preview; defer branded/native fidelity.                   | Font provenance, measured contrast/geometry, theme reload, reduced motion and native rendering.                                                    |
| [58](../../plans/archive/2026-09-09/58-native-workspace-and-device-ci.md) Native workspace         | Native modules, temporary prebuild/APK and artifact evidence tools; new FFI drift R6, iOS/device acceptance open.                 | Repair R6; build both platforms from one retained revision and correlate installed artifacts.                         | Android-only development acceptance while maintaining an explicit iOS gate.                                        | Clean bindings, native compilation, install identity, permissions/lifecycle/physical-device matrix.                                                |
| [59](../../plans/archive/2026-09-09/59-device-persistence-and-resume.md) Persistence               | Real SQLite transactions/hydration/outbox, calendar/cursor hardening; new wave codec breaks start R1.                             | Shared versioned checkpoint + real adapter round-trip coverage; extend engine types as needed.                        | Roll back wave-aware navigation until codec support lands.                                                         | Start/rep/pause/restart, migration, quota failure, timezone and course isolation.                                                                  |
| [60](../../plans/archive/2026-09-09/60-authoritative-core-maths.md) Canonical core                 | Rust FSRS/ranking/matching/merge used through facade; new notification native exports not generated.                              | Regenerate all targets and keep selection/review policy in canonical interfaces.                                      | Keep unfinished planner internal until there is a bridge consumer.                                                 | Golden vectors, WASM/native parity, clean regeneration and device-floor tests.                                                                     |
| [61](../../plans/archive/2026-09-09/61-content-and-audio-assets.md) Content/audio                  | Starters, immutable verifier and transaction activation foundation; no runtime updater/publication.                               | Signed text-only pilot with real keys, bounded resources, multilingual catalog installer and last-good rollback.      | Continue bundled releases while developing updater offline; slower content fixes.                                  | Real signature failures, corrupt pointer, concurrent updates, all-pair content validation; human sign-off. Q-15 separately gates production audio. |
| [62](../../plans/archive/2026-09-09/62-native-audio-playback.md) Playback                          | Foreground TTS/controller; transition helper is not wired; recorded cache/background transport absent.                            | Connect one native session owner, then verified local assets/cache/transport.                                         | Preserve foreground TTS-only preview while approved assets are prepared.                                           | Interruption, route/headphone changes, offline cache, rate/background/lock-screen and Q-15 assets.                                                 |
| [63](../../plans/archive/2026-09-09/63-native-speech-speak-and-latency.md) Speech/onset            | On-device ASR and Speak reveal runtime; new onset metadata parser, no measured native onset.                                      | Bind real same-clock prompt-end/onset and active generation to controller; validate each target.                      | Ship current reveal/ASR capability states with latency null.                                                       | Hardware ground truth, silence/noise, stale generation, models/permissions and no PCM export.                                                      |
| [64](../../plans/archive/2026-09-09/64-today-and-refrain-production-loop.md) Today/Refrain         | Manual runtime and timing guard; R1 prevents start; R2/R3 break exit/resume consistency.                                          | Repair transactions/navigation and timed-wave state model; then tag drills/tails and real audio.                      | Explicit manual-practice preview until audio is accepted.                                                          | Timed boundaries, graduation/substitution, day change, pause/end/reload and audible mode behavior.                                                 |
| [65](../../plans/archive/2026-09-09/65-import-and-capture.md) Import/capture                       | Paste/file decoder and raw draft persistence; R4/R5 leave review loss and unbounded read.                                         | Bounded file reader plus durable edited per-pair drafts; OCR later.                                                   | Paste-only import with durable edited text first.                                                                  | Native picker, huge/invalid files, edits/restarts, failed partial save, pair change; on-device OCR separately.                                     |
| [66](../../plans/archive/2026-09-09/66-backend-contract-data-and-security.md) Backend              | PostgreSQL auth/sync, shared runtime boundaries and multilingual queries; planned release contract is not an endpoint.            | Integrate signed manifest/publication and audit/version repository; finish legacy boundary validation.                | Keep content bundled and prioritize exact-image/load/restore acceptance.                                           | Real PostgreSQL tenant/receipt tests, malformed requests, image readiness/security and load.                                                       |
| [67](../../plans/archive/2026-09-09/67-anonymous-auth-and-account-lifecycle.md) Accounts           | Optional identity, rotating refresh and installation binding; linking/export/erasure absent.                                      | Define deletion/recovery ownership, then export and deliberate device/account management.                             | Continue restricted testing of sign-in/sync while lifecycle UI is built.                                           | Two accounts/devices, revoke/reinstall/offline rotation, real provider flow, deletion propagation and backup policy.                               |
| [68](../../plans/archive/2026-09-09/68-sync-and-offline-convergence.md) Sync                       | Durable push/pull, cursor recovery and quarantine count; no correction/export or OS background worker.                            | Preserve rejected records and add policy-backed correction/rescue; define Review compensation separately.             | Keep read-only quarantine diagnostics while validating foreground convergence.                                     | Partial ACK, duplicate/reordered payloads, partitions/process death, correction retry, no cross-tenant leakage.                                    |
| [69](../../plans/69-trip-domain-and-arc.md) Trips                                                  | Unbuilt durable lifecycle/routes; Q-07 expressly gates semantics/schema.                                                          | Record return/relocation/edit/cancel/history choices, then course-bound lifecycle and repositories.                   | Prepare reviewed destination content/design without committing lifecycle semantics.                                | Decision record, timezone/edit/cancel/missed-day histories, offline arc and truthful readiness.                                                    |
| [70](../../plans/archive/2026-09-09/70-survival-widgets-and-notifications.md) Survival/widgets     | Pure Rust policy/candidate planner; R6 native exports stale; no scheduler/widgets/Survival.                                       | Repair bindings, then non-trip notification adapter for built destinations with explicit day partitioning.            | Keep policy offline-tested until native harness is ready; trip content remains Q-07-gated.                         | OS schedule/replace/cancel, daily cap, DST/permissions/foreground, cold offline widget/Survival later.                                             |
| [71](../../plans/archive/2026-09-09/71-settings-telemetry-and-experiments.md) Settings             | `/settings` and durable accent/motion/consent; no event transport, flags or experiment.                                           | Add reload/state E2E for controls, then allowlisted local event queue and consent deletion.                           | Keep local settings only until provider/retention contract is chosen.                                              | Persistence error/reload, checked states, consent off sends nothing, bounded queue; Q-05 before experiment activation.                             |
| [72](../../plans/archive/2026-09-09/72-release-quality-gates.md) Quality                           | Broad harness/evidence scripts; R7 means combined gates are red.                                                                  | Repair and run sequential exact-revision local CI; retain native acceptance separately.                               | Stop at a clearly labelled non-release review snapshot until failures are resolved.                                | Green required commands plus real native/a11y/performance matrix; fixture success cannot replace devices.                                          |
| [73](../../plans/archive/2026-09-09/73-delivery-observability-and-slos.md) Production delivery     | Release scaffolds, recovery verifier, runbooks; no new production delivery/SLO evidence.                                          | Define objectives from measured testing, diagnostics/redaction and deployment rollback evidence.                      | Continue restricted development EC2 until operations evidence supports expansion.                                  | Exact image, failed cutover/rollback, actionable alerts, objectives/load and store signing.                                                        |
| [74](../../plans/74-monetization-and-entitlements.md) Billing                                      | Gated draft contracts only; Q-08/Q-12 unresolved.                                                                                 | Decide products/entitlements/provider/grace/refunds, then sandbox verification and cache.                             | Leave billing unavailable; preserve free local practice while deciding.                                            | Approved policy, purchase/restore/refund/replay/account/offline sandbox histories.                                                                 |
| [75](../../plans/archive/2026-09-09/75-review-and-memory.md) Review/Memory                         | Pure due ReviewEngine exists; lint fails; no route/Review checkpoint/Memory.                                                      | Daily history-aware budget + canonical due ordering + typed durable grade route, no Undo initially.                   | Deliver the engine contract/conformance alone; no learner Review claim.                                            | Atomic attempt/history/checkpoint, cap across sessions, unscheduled/no-due states; real Memory curves afterward.                                   |
| [76](../../plans/archive/2026-09-09/76-roleplay-and-live-ai.md) Roleplay                           | Shared two-scene catalog and stub service; no local route/session/live coordinator.                                               | Bundled en→es text route with durable turns and real completion before voice/live expansion.                          | Build coordinator/evals against fake transports first; does not deliver a learner surface.                         | Offline completion/resume, unsupported pair, content quality; live budget/safety/retention before activation.                                      |
| [77](../../plans/archive/2026-09-09/77-dsp-and-speech-labs.md) DSP/labs                            | Helpers and derived-study evaluator; F0/alignment/scoring pipeline and labs unbuilt.                                              | Preregister and run consented Spanish offline/device spike, review failure clusters, then choose production approach. | Keep DSP unavailable if quality fails; revise scope before labs.                                                   | Real corpus/annotations, held-out quality, timing/memory/battery, per-target calibration and privacy.                                              |
| [78](../../plans/78-conditional-run-and-phrasebook.md) Run/Phrasebook                              | Ladder helpers only; routes/engine gated by Q-05 comparative M3 evidence.                                                         | Establish experiment/decision and audit ladder data before approving Loop C.                                          | Defer Loop C; ordinary owned-phrase search can proceed under 56/81.                                                | Decision, measured comparison, then durable engine/ladder UI and cross-engine conformance.                                                         |
| [80](../../plans/archive/2026-09-09/80-dev-design-system-workbench.md) Workbench                   | All 33 exports registered; state APIs exist, remaining locale/navigation specimens incomplete.                                    | Add real Settings/exit/resume interactions and bg/ru long-copy specimens.                                             | Keep route-owned single-use components tested through learner flows rather than extracting just for the workbench. | Registry drift, keyboard/geometry at 200%/310%, inspection does not mutate learner settings, production exclusion.                                 |
| [81](../../plans/archive/2026-09-09/81-navigation-spine-switcher-and-more.md) Spine/More           | Grouped More/spine and new Refrain exit/resume; R1–R3 break integrated behavior; search/transport absent.                         | One checkpoint/ongoing/exit owner, then real counts/search and travelling transport.                                  | Stabilize current destinations first, defer search/transport.                                                      | Same state across spine/switcher/Today, cold/warm exits, focus, collision, native Back; Q-17 only final rail ordering.                             |
| [82](../../plans/archive/2026-09-09/82-guided-chat-domain-and-service.md) Chat domain              | Validated graph/traversal foundation; no authored pack/thread repo/coordinator.                                                   | Author one reviewed offline topic, validate IDs, build typed thread persistence after Q-19 policy.                    | Session-only prototype in development if explicitly documented; no durable-chat claim.                             | Edge/stale-turn tests, offline reload, keep boundary; Q-18/Q-20 for live, Q-16 release.                                                            |
| [83](../../plans/83-open-chat-and-message-inspector.md) Chat surfaces                              | Both routes remain unbuilt/planned.                                                                                               | Text/offline UI after 82 with shared shell and real inspector data.                                                   | Wait for domain persistence; no simulated conversation/typing/score stand-in.                                      | Authored states, a11y, keep/review handoffs, process death; voice 62/63 and Q-16 launch later.                                                     |
| [86](../../plans/archive/2026-09-09/86-provider-integrations.md) Providers                         | Anthropic transport/concurrency, identity verifier seams; no live scene registration or content storage adapter.                  | Content storage/signature adapter for 61, then feature-owned budget/retention controls.                               | Use bundled content/fake transports while provider decisions are prepared.                                         | Bounded time/bytes, cancellation, key rotation, atomic spend, output validation and deployed isolation.                                            |
| [87](../../plans/archive/2026-09-09/87-multilingual-app-and-language-selection.md) Languages       | Seven-pair runtime and exact-material review gate; R7 pseudo fixture fails, human approval absent.                                | Repair fixture; obtain attributable review against exact new content/copy digests, then all-pair device matrix.       | Keep preview explicitly unapproved; avoid widening language claims.                                                | Bilingual records, same/different-course preservation, long copy, voices/models and device persistence.                                            |
| [88](../../plans/archive/2026-09-09/88-low-cost-backend-infrastructure.md) Testing infra           | Restricted deployment has historical evidence; new backup integrity check is local, full off-host operations incomplete.          | Preserve existing infrastructure owner; schedule/verify copied backups and run isolated restore/load/alerts.          | Keep narrow existing tester profile until recovery proof exists.                                                   | Off-host object verification, tenant/schema/role restore, reboot/storage retention, load and measured cost.                                        |
| [90](../../plans/archive/2026-09-09/90-default-english-content-language.md) English target         | Shared registry validation exists; targets still exclude English and `CONTENT_LANG` reader/default migration absent.              | Choose canonical dialect, add reviewed English catalog and config/default/migration across domain/API/mobile.         | Keep current targets until that decision; English UI is not English learning content.                              | Explicit saved choices win, fresh default, old-data migration, API/catalog/audio identity and human review.                                        |
| [93](../../plans/archive/2026-09-09/93-mobile-shell-gestures.md) Gestures                          | Existing pull/dismiss implementation; focused mouse/touch browser test passes at this revision.                                   | Retain gesture code and collect physical iOS/Android assistive-technology evidence after exit repairs.                | Browser-only acceptance for preview; do not claim native validation.                                               | Short/horizontal/cancel/multitouch, content scroll, native Back, sheet focus and device minimums.                                                  |
| [94](../../plans/archive/2026-09-09/94-persistent-practice-and-account-integration.md) Integration | Broad runtime exists with older aggregate CI evidence; this wave regresses Refrain and combined verification.                     | Close R1–R7, run full combined local CI, then exact-build provider/device journey.                                    | Retain earlier known-good scoped artifact for testing while this branch is repaired.                               | Fresh process restart and two-device sign-in/sync/convergence, exact native build, hardware speech and release gates.                              |

## Recommended delivery order

1. **Restore basic correctness:** R1 codec + hydration; R2 usable exits; R3 one ongoing-work policy.
   Owners 59/64/56/81. These changes need one coordinated contract and route test set.
2. **Protect learner input:** R4 durable reviewed drafts and R5 bounded file selection. Owners
   65/59, with 58 for platform URI validation.
3. **Restore the integration gate:** R6 generated native outputs and R7 lint/pseudo/format/history;
   run full combined local CI before claiming this implementation wave accepted. Owners 60/58/72.
4. **Finish the usable daily loop:** remaining 64 tag drills/tails, 81 search/ongoing presentation,
   and 75 durable Review route/budget; Memory follows actual history.
5. **Deliver independent text content:** real 61 activation/publication via 66/86, reusing 87's
   language contracts and exact-material approval gate. No audio decision is needed for text.
6. **Complete settings and lifecycle:** 57/71 production preferences and consent; 67/68 export,
   erasure and repair. Define Review Undo separately rather than blocking the first Review route.
7. **Integrate native audio:** 62/63 controller and measurement into 64/81, then 70 platform
   surfaces whose destinations/content actually exist. Device evidence runs throughout.
8. **Build approved offline new surfaces:** 76 bundled Roleplay and 82/83 chat domain/text UI;
   release each only after its content/retention/launch gates. Prepare 77 evidence alongside, not
   fake labs.
9. **Resolve conditional products and operational release:** 69 Q-07, 74 Q-08/Q-12, 78 Q-05, 90
   English dialect; 73/88/58/72/87/94 acceptance begins in parallel with step 1 and gates release.

Work should be assigned by shared contract and file ownership, not one independent writer per plan.
The reviewed wave demonstrates why route state, codecs, generated outputs and localization need an
integration owner. Use isolated worktrees, require a completed handoff result, and test the combined
tree after integration. Partial helpers should be reported as foundations, with remaining ordinary
implementation listed separately from actual decision/device/human gates.

## Documentation corrections

- Retain all 33 plan owners and direct links to actual archive paths. No plan is completed by
  archival or by this review.
- Treat status rows/review timestamps at `aafa61f`, `2d9e8c3` or older plan-94 evidence as
  historical; use this revision's matrix for implementation and release decisions.
- Plan 71's starting-point text saying no Settings route exists is stale. Plan 75's roadmap row
  saying the engine remains is stale. Plan 81 now has exit/resume code, but it is defective rather
  than absent. Plan 80's old 30-component inventory conflicts with its 33-export registry.
- Settings, Languages, Account and More are utilities. They do not change the eight-of-23 authored
  learner-screen count. Update overview claims accordingly; do not call a JavaScript iOS export a
  compiled or device-accepted iOS app.
- Preserve historical successful checks, but attach revision and scope; no unchecked “all local
  checks pass” statement should be read as current branch acceptance.
