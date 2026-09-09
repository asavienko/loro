# Post-main review of the 33 implementation plans

**Reviewed:** 2026-09-09. **Branch:** `codex/P3-30-review-engine`. **Code:**
`de81744c7531c20f44d6eacda6be2461d521d62b`. **Base:** incorporated `origin/main` at
`65b64e97bd2f6221552e3d356138976881424b07`. **Requirements:** F-02/F-03/F-04/F-05/F-08/F-09, NAV-*,
P2-07/P2-09/P2-10, P3-30 and P3E-01.

**Disposition: changes requested.** The Refrain persistence and basic exit/resume repairs hold in
the focused checks, but file import still has runtime defects and the full merge gate is not green.
All 33 plans retain work or required acceptance. **No additional whole plan qualifies as complete.**
Completed implementation slices are recorded in the
[dated archive](../../plans/archive/2026-09-09/IMPLEMENTED-SLICES.md), with their remaining owners.
Plans 56–65 were already user-archived as partial plans; their location is unchanged.

This review covers the branch diff, affected runtime callers, plan headers/remaining criteria and
the implemented route registry. Unchanged native, infrastructure and gated product areas were
checked for scope and ownership; this is not a fresh device, deployment, linguistic or security
certification. Runtime code, an isolated foundation and a completed product plan are distinct.

## Findings

### B1 — P2: valid browser files cannot be imported

**Owners:** 56/58/65. In [add.tsx](../../apps/mobile/app/add.tsx), `chooseFile` always constructs
`new File(asset.uri)` from `expo-file-system` and calls `.stream()`. Installed Expo 19.0.23's web
`FileSystemFile` is an unsupported stub; `File.readableStream()` calls its absent `open()` method.
The document picker already supplies the browser `File` as `asset.file`.

**Reproduced:** onboard → Add → import → choose `phrases.tsv` containing `Hola<TAB>Hello`. The file
chooser accepts it, but the import textarea remains empty; the success assertion fails. The existing
Add suite covers pasted text and never selects a real file, so all seven tests pass.

**Fix A:** add web/native reader adapters. Web streams `asset.file`; native streams a supported
provider URI. Both feed the existing byte limiter and strict decoder. Revoke owned object URLs after
use. **Option B:** keep paste import and hide the unsupported web file action until ready. Accept
only after valid `.txt`/`.tsv`, invalid encoding, cancellation and oversized-file browser tests
pass; retain native document-provider testing separately.

### B2 — P2: picker errors and late results bypass the import recovery policy

**Owners:** 59/65/87. In [add.tsx](../../apps/mobile/app/add.tsx), `getDocumentAsync()` is outside
the `try`, while `onPress` discards the promise with `void chooseFile()`. Picker rejection is
therefore unhandled. After selection, an asynchronous stream can still call `updateInput` after the
learner has edited the text or started another selection. There is no request generation,
mounted/pair check, abort or busy control. An older result can overwrite a newer draft.

The import component also initializes its React input from the pair map only once and has no pair
key. The persisted map itself is tested; that does not establish isolation for a mounted editor or
an outstanding picker. These are source-confirmed gaps; no native picker-failure test was run.

**Fix A:** put selection and reading inside one error boundary, bind a request token to the
native/target pair, invalidate it on edits/unmount/pair change, and commit only the current result.
Key or reset the editor by pair; publish the recovered text only after the durable save succeeds.
**Option B:** disable overlapping selection/editing while reading, with cancellation and pair
invalidation. Test rejection, overlapping selections, editing during read, pair switch and storage
failure. The earlier R4/R5 closure covered bounded reads and serialized edits, not these cases.

### B3 — P2: corrupt release metadata permits a catalog downgrade

**Owners:** 61/66/86. [contentRelease.ts](../../apps/mobile/src/data/contentRelease.ts) treats a
malformed installed release pointer as `undefined`. Both monotonic checks then treat the device as a
first installation. A previously signed older release can replace newer installed content.

**Reproduced with real SQLite and explicit test verification ports:** activate version 10, replace
`content.release.es-ES` with invalid JSON, then activate version 9. The stored version becomes 9.
This is an **uncalled activation foundation**, not a claim that a production updater currently
downgrades user content. The earlier review already identified it; it remains unresolved.

**Fix A:** distinguish absent from corrupt metadata and fail closed on corruption. **Option B:**
recover a trusted version/hash high-water mark from independently validated installed catalog
metadata before activation. Verify corrupt/truncated/wrong-language/hash pointers, same-version
collisions and concurrent candidates. Real signing keys, multilingual installation and publication
remain separate implementation tasks.

### B4 — P2: duplicate chat choice IDs pass validation and select the wrong edge

**Owner:** 82. [chat-topic.ts](../../packages/core/src/api/chat-topic.ts) validates unique node IDs
and resolvable edges, but does not require unique suggestion IDs within a node. `advanceChatTopic`
finds the first matching ID.

**Reproduced:** two choices in node `a`, both named `same`, target `a` and `b`. Schema parsing
succeeds. Selecting the second choice through its ID returns `a` instead of `b`. This affects the
exported graph foundation; no Chat route is yet reachable.

**Fix A:** reject duplicate suggestion IDs within each node and test the exact failing graph.
**Option B:** change action identity to a validated node/edge key with unambiguous lookup. Keep
stale-turn validation in the future coordinator; accepting a caller-supplied node alone cannot prove
that it is still the thread's active node.

### B5 — P2: Refrain navigation acceptance depends on the wall clock

**Owners:** 64/72/81. [navigation.spec.ts](../../apps/mobile/e2e/navigation.spec.ts) onboards with
the real browser clock and immediately expects Start wave or an active Leave practice control. The
new production guard correctly locks entry before 08:00, making these tests time-dependent.

**Reproduced:** pin the browser to `2026-09-09T05:00:00Z` (07:00 Madrid), onboard, then use the
existing `/Start the .* wave/` assertion. It fails; the daytime navigation tests pass. This is a
test defect, not a request to remove the product's timing guard.

**Fix:** freeze an open-wave time before onboarding in active-session tests. Add separate tests for
pre-wave, boundary crossing, paused earlier waves and midnight. In particular, the test named
“pauses durably” currently neither records a rep nor reloads; add rep → pause → reload → same
cursor/wave and End → reload to prove its stated acceptance.

### B6 — P2: the branch still fails the full formatting gate

**Owners:** 72/94. At the reviewed code revision, `pnpm format:check` exits 1 on 12 tracked files:
three mobile source/test files, three docs and six plan files. `pnpm check` does not run that stage.
`scripts/ci-local.sh` requires it before browser acceptance. Commitlint now passes.

The review's documentation edits format touched documents, but leave unrelated implementation
formatting for a coherent repair. Remaining paths are recorded in Verification below. **Fix:**
format only the remaining listed authored files, then run `CI_BASE_REF=origin/main pnpm ci:local`
and retain its exit code. A naturally terminated process or a successful cached fast gate does not
establish that full CI passed.

## Plan-by-plan disposition

“Inherited” means present on main and retained by this branch, rather than newly delivered here.
Each numbered link resolves to the owning plan. All rows have remaining scope; a foundation with an
open defect is not listed as an accepted feature in the implementation archive.

| Plan                                                                                           | Verified implementation / branch contribution                                                                               | Remaining work and gate                                                                                                                           |
| ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| [56](../../plans/archive/2026-09-09/56-navigation-failure-and-input-shell.md) Navigation/input | Surface laws/group metadata, built-route filtering and cold/active Refrain escapes; 8 navigation tests pass at daytime.     | B1/B2; exhaustive failure/input/keyboard/list behavior and native Back/focus.                                                                     |
| [57](../../plans/archive/2026-09-09/57-runtime-design-system.md) Design system                 | Settings values feed `ThemeProvider`; inherited production control states and tabular numerals remain.                      | Fonts/provenance, dark theme, motion/haptics and device rendering; workbench state coverage.                                                      |
| [58](../../plans/archive/2026-09-09/58-native-workspace-and-device-ci.md) Native workspace     | Inherited CNG/SQLite/native bridges and main's development identity; simulator evidence collector and regenerated bindings. | Full iOS compilation, physical-device harness/signing and B1 native/web reader distinction. Collector tests are not collected device evidence.    |
| [59](../../plans/archive/2026-09-09/59-device-persistence-and-resume.md) Persistence           | Wave codec/hydration and local pair-draft map; inherited atomic progress/outbox transactions.                               | B2; upgrade/crash/timezone and cross-device acceptance, erasure integration.                                                                      |
| [60](../../plans/archive/2026-09-09/60-authoritative-core-maths.md) Core maths                 | Inherited Rust FSRS/merge/ranking/clocks; notification candidates plus matching committed Swift/Kotlin exports.             | Native consumer/parity and device-floor evidence; no completed DSP/onset claim.                                                                   |
| [61](../../plans/archive/2026-09-09/61-content-and-audio-assets.md) Content/audio              | Shared signed-release schema/verifier and transaction activation helper; no runtime updater.                                | B3; real signature/key rotation, bounded fetch, multilingual installer/publication and bilingual review. Q-15 gates production audio.             |
| [62](../../plans/archive/2026-09-09/62-native-audio-playback.md) Playback                      | Inherited foreground TTS/controller; isolated transition contract.                                                          | Wire contract into native owner; recorded/cache/rate/background transport, interruptions and Q-15 assets.                                         |
| [63](../../plans/archive/2026-09-09/63-native-speech-speak-and-latency.md) Speech              | Inherited on-device ASR/reveal; onset metadata parser added. Native emitters still supply null latency.                     | Real same-clock measurement/calibration and active-generation matching; parser validity alone is not measurement provenance.                      |
| [64](../../plans/archive/2026-09-09/64-today-and-refrain-production-loop.md) Today/Refrain     | Timed entry, wave-aware codec, shared resume selection and active Pause/End paths.                                          | B5; drills/tails, completion/boundary matrix, audible modes via 62/63 and Q-14 peak acceptance.                                                   |
| [65](../../plans/archive/2026-09-09/65-import-and-capture.md) Import/capture                   | Paste/review limits, canonical edited TSV, per-pair durable map and bounded byte reader.                                    | B1/B2 before file import acceptance; picker/storage recovery coverage, on-device OCR afterward.                                                   |
| [66](../../plans/66-backend-contract-data-and-security.md) Backend                             | Inherited durable auth/sync and shared runtime contracts; release contract reused in content verifier.                      | B3 and actual content endpoint/publication; remaining legacy boundary migration, load/security/image acceptance.                                  |
| [67](../../plans/67-anonymous-auth-and-account-lifecycle.md) Accounts                          | Inherited optional provider/email identity, refresh rotation and installation binding; retained by merge.                   | Linking, recovery/export/erasure policies and UI, real provider/device journey.                                                                   |
| [68](../../plans/68-sync-and-offline-convergence.md) Sync                                      | Inherited durable convergence/backoff; quarantine count now reaches Account.                                                | Correction/rescue/export, OS background execution, two-device failure matrix; compensation policy before Review Undo.                             |
| [69](../../plans/69-trip-domain-and-arc.md) Trips                                              | No new durable trip implementation; draft contracts only.                                                                   | Q-07 semantics before schema/lifecycle; then routes, course-bound history and honest readiness.                                                   |
| [70](../../plans/70-survival-widgets-and-notifications.md) Widgets/notifications               | Pure Rust candidate ordering/policy plus generated exports.                                                                 | Native scheduler/day partitioning/DST/permission/cancellation, Survival/widgets; Q-07 for trip candidates.                                        |
| [71](../../plans/71-settings-telemetry-and-experiments.md) Settings                            | Reachable durable accent/motion/consent controls; language flow inherited.                                                  | Telemetry queue/transport, privacy-safe events and flags; Q-05 for experiment activation.                                                         |
| [72](../../plans/72-release-quality-gates.md) Release checks                                   | Expanded route/state and pseudo-label tests; inherited a11y/geometry/workbench/bundle harnesses.                            | B5/B6, complete combined CI and broad pseudo/device/performance matrices; Q-14 and human sign-off stay open.                                      |
| [73](../../plans/73-delivery-observability-and-slos.md) Delivery/SLOs                          | Inherited health/deployment tooling; docs clarify development versus production operations.                                 | Production rollout/store artifacts, telemetry/SLO enforcement and operational acceptance from 88.                                                 |
| [74](../../plans/74-monetization-and-entitlements.md) Monetization                             | No purchase module or paywall; gated draft boundary retained.                                                               | Q-08 pricing and Q-12 billing before product behavior; offline entitlements afterward.                                                            |
| [75](../../plans/75-review-and-memory.md) Review/Memory                                        | Exported pure `ReviewEngine` plans due items and calls canonical FSRS for explicit grades. No runtime constructor.          | Canonical due order, **remaining daily** budget rather than per-session cap, conformance, durable route/checkpoint, Memory; Undo after 68 policy. |
| [76](../../plans/76-roleplay-and-live-ai.md) Roleplay                                          | Shared two-scene bundled catalog consumed by API fallback; real provider coordinator absent.                                | Reviewed offline route/turn persistence/resume, locale content and guarded live budget/safety/retention.                                          |
| [77](../../plans/77-dsp-and-speech-labs.md) DSP/labs                                           | Derived-study evaluation CLI and tests; inherited signal helpers.                                                           | Consented corpus, actual scorer/pipeline and independent quality evidence before labs; no synthetic quality claims.                               |
| [78](../../plans/78-conditional-run-and-phrasebook.md) Run/Phrasebook                          | Inherited ladder helpers; routes/engine absent.                                                                             | Q-05 and comparative M3 evidence; ordinary owned-phrase search can proceed under 56/81.                                                           |
| [80](../../plans/80-dev-design-system-workbench.md) Workbench                                  | Inherited 33-export registry, gallery and production exclusion; no new gallery implementation in this branch.               | Cyrillic/long-copy and full production-state/navigation specimens; real geometry and exclusion acceptance.                                        |
| [81](../../plans/81-navigation-spine-switcher-and-more.md) Spine/More                          | Shared resume selector and active Refrain exit sheet; inherited grouped More/navigation menu.                               | B5; Stream/Speak/session/flow exits, real search/counts/context and travelling audio; Q-17 only final rail priority.                              |
| [82](../../plans/82-guided-chat-domain-and-service.md) Chat domain                             | Exported graph schema/traversal, currently test-only.                                                                       | B4; reviewed topics, thread repository/coordinator, Q-19 retention, Q-18/Q-20 live limits and Q-16 launch.                                        |
| [83](../../plans/83-open-chat-and-message-inspector.md) Chat UI                                | Both routes still declared planned; no new screen.                                                                          | Text/offline UI after 82 persistence; real inspector/keep handoffs, voice via 62/63 and Q-16 release.                                             |
| [86](../../plans/86-provider-integrations.md) Providers                                        | Inherited identity verification and Anthropic concurrency/transport; AI fallback now reuses shared scenes.                  | Real storage/signature adapter for 61, runtime registration and feature-owned cancellation/spend/output/retention controls.                       |
| [87](../../plans/87-multilingual-app-and-language-selection.md) Multilingual                   | Inherited seven-pair course/API isolation; new copy and regenerated pseudo resources.                                       | B2; exact-material human approval and all-pair device/voice/long-copy acceptance.                                                                 |
| [88](../../plans/88-low-cost-backend-infrastructure.md) Testing infrastructure                 | Copied-backup integrity verifier and restore checklist; historical EC2/Google/restore records inherited.                    | Scheduled verified off-host retention, restore/load/alerts/cost and consent-to-device proof; preserve infrastructure ownership.                   |
| [90](../../plans/90-default-english-content-language.md) English target                        | Existing registry-derived validation retained; English is still UI/native language, not a learning target.                  | Canonical dialect, `CONTENT_LANG` reader/default migration, catalog/API/native identity and bilingual approval.                                   |
| [93](../../plans/93-mobile-shell-gestures.md) Gestures                                         | Inherited pull/dismiss behavior; browser mouse/touch regression passes after merge.                                         | Physical iOS/Android touch and assistive-technology acceptance; browser evidence alone does not close this plan.                                  |
| [94](../../plans/94-persistent-practice-and-account-integration.md) Integration                | Existing SQLite/core/speech/accounts retained; wave codec and resume repairs verified by fast/focused checks.               | B1/B2/B5/B6 and complete combined CI; exact-build iOS, provider and two-device speech/convergence acceptance.                                     |

## Verification

- `pnpm check`: **passed, exit 0**, 23/23 Turbo tasks. Includes Android configuration, deployment,
  native-evidence/DSP fixtures and contracts. PostgreSQL-dependent tests skipped by the ordinary
  unit command are not database acceptance.
- Commitlint, `--from origin/main --to HEAD`: **passed, exit 0**.
- Isolated Chromium, `CI=1 LORO_E2E_PORT=8264`, one worker, no retries: **15 existing Add/navigation
  tests passed**. Two temporary review probes failed as described in B1/B5; total 15 passed, 2
  failed in 55.4 seconds, exit 1. Probes were removed from the source tree afterward.
- Direct graph probe: duplicate IDs accepted; requested destination `b`, actual `a` (B4).
- Real SQLite activation probe with explicit fake signing/validation ports: version 10 → corrupt
  pointer → version 9 accepted (B3). This tests storage rollback handling, not real cryptography.
- `pnpm format:check` at `de81744`: **failed, exit 1**, 12 tracked files. Documentation formatting
  is corrected where this review edits it. Remaining implementation/untouched-document paths:
  `apps/mobile/src/lib/audioSessionContract.test.ts`, `apps/mobile/src/lib/importFile.test.ts`,
  `apps/mobile/src/lib/readBoundedImportFile.ts`, and `docs/architecture/widgets-notifications.md`.
  A second full formatting run after documentation edits confirms those four remaining files.
- Full `ci:local`, complete learner/pseudo/workbench/export suites, native builds, live providers,
  AWS operations and bilingual/device acceptance: **not run in this review**. The known formatting
  failure and targeted regressions prevent claiming full acceptance.

Local logs: `/tmp/loro-post-main-review-{check,browser,format,commits}.log`. Temporary reproduction
sources: `/tmp/loro-post-main-review-probe.spec.ts` and `/tmp/loro-post-main-domain-probe.ts`.
Browser traces live under ignored `test-results/mobile-e2e/` and may be overwritten. The evidence
and reproduction steps above are the retained review record.

## Implementation order

1. Repair B1/B2 together at the file-picker/reader/draft boundary; add actual browser file coverage.
2. Repair B5, finish B6 and obtain the complete local CI result for the combined branch.
3. Fix B3/B4 before integrating the content updater or Chat coordinator. These fixes can proceed
   without activating the externally gated features.
4. Deliver the remaining daily-loop and durable Review slices (64/75/81), then independent text
   content (61/66/86) and account recovery (67/68). Device/human/operations acceptance runs
   alongside.
5. Keep 69/74/78/90 decisions explicit; do not archive those unbuilt products as implemented.
