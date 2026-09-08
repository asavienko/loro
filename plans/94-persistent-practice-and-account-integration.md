# Persistent practice, native speech, canonical core and account sync

- **Requirement IDs:** `F-01`…`F-04`, `F-07`, `F-08`, `AS-01`…`AS-06`, `LB-01`…`LB-27`
- **Status:** 🟡 Runtime implemented; aggregate local CI passed. Remaining gates are full iOS native
  validation, physical-device speech/convergence acceptance, approved ElevenLabs assets (Q-15),
  background transport and production identity/email configuration; see the remaining scope below.
- **Depends on:** Existing contracts in 85 and persistence correctness in 54; implements coordinated
  slices of 58–60, 62–63 and 66–68.

## User request

Implement persistent progress, audio/on-device speech, canonical scheduling, cross-device sync and
sign-in. Work is delegated by file ownership, with integration and local verification in this
branch.

## Integration boundaries

1. Local SQLite commits precede store notifications. Browser storage uses SQLite with durable,
   atomic snapshots; native uses OP-SQLite. Course progress and resume remain independent.
2. Canonical Rust owns scheduling, ranking, matching, HLC and merge. Generated WASM and UniFFI
   boundaries are used by runtime callers, with no approximate fallback.
3. Native TTS uses available device voices. Speech recognition requires a proven on-device path;
   unavailable recognition offers reveal mode. Recorded audio never enters JavaScript or sync.
4. Google/Apple and email verification are optional; authenticated backend data is durable in
   Postgres. Native refresh credentials live in secure storage; browser credentials have page
   lifetime.
5. Sync binds a local installation to one verified account, replays the transactional outbox,
   resolves catalog identity aliases and advances a cursor only after local apply commits.

## Verification

Run the repository gate, browser state/accessibility/text-scale tests, production export, canonical
Rust/WASM parity and real Postgres integration tests. Record native compile/device evidence exactly;
source inspection and browser tests cannot prove native speech accuracy or offline device behavior.
Do not enable GitHub Actions or deploy infrastructure as part of this implementation request.

## Implemented runtime

- Device/browser SQLite, forward migrations, atomic progress/session/outbox writes, course
  hydration, non-destructive storage recovery and durable deletion Undo.
- Reference-backed Rust FSRS-6, selection, cloze, ranking, matching, HLC and merge; generated
  embedded browser WASM and native UniFFI/Expo ports with drift checks.
- Native foreground TTS, strict on-device ASR, Speak recognition/reveal paths and truthful progress.
  The Android release smoke exposed missing Hermes plural support; bundled EN/BG/RU PluralRules now
  initializes before ICU, with a regression that starts without the platform API.
- Optional Google/Apple/email Account screen, native secure refresh storage/rotation, logout and
  account binding. Main's provider authorization-code/PKCE flows and independent API readiness are
  retained alongside the new durable sync service.
- Postgres tenant/device isolation, replay receipts, cursor snapshots, catalog identity aliases,
  deletion/re-add proofs and exact receipt clock corrections. Client acknowledgement/apply/cursor
  changes commit together; foreground/connectivity/write events trigger bounded retries.

## Original implementation validation (before main integration)

- `pnpm check`: 23 tasks passed. The default run explicitly skips database-dependent API tests; the
  separate real-Postgres run passes all 140 API tests, including sign-in, two device identities,
  tenant isolation, sync and logout through actual HTTP controllers.
- Rust: 145 unit tests plus seven integration tests; 42 official FSRS reference vectors execute
  natively and through the shipped WASM. Generated source/output drift checks pass.
- Production web smoke: four tests passed. Developer workbench: three tests passed.
- Full Android debug and release APK builds passed; release includes embedded production JS.
- iOS Metro export passed. Swift syntax/podspec and host Swift-to-UniFFI smoke passed; a full iOS
  native build requires the unavailable Xcode SDK.

Android release smoke passed in an isolated emulator with airplane mode enabled and no Metro
connection. Ten phrases persisted after onboarding. A Refrain rep survived force-stop/cold launch;
Today retained one rep and the next session resumed Chorus at REP 1/6. Speak reveal completed and
advanced while leaving the rep count unchanged; ASR and audio correctly reported unavailable because
no voice/model was installed. Microphone permission remained unrequested. Local evidence is retained
in `test-results/native-smoke/README.md` with screenshots, UI dumps and APK hash.

Original browser run: **136 tests passed in 6.3 minutes**, including invalid-code and
unavailable-sync states, persistence recovery, route/navigation flows, accessibility and full
200%/310% text-scale sweeps. Native builds and source edits were settled before this accepted run.
The repository gate also passes 284 mobile tests, 202 core tests, 34 content tests and 23 token
tests; the separate Postgres run completes the 140 API tests. Temporary test database, emulator and
development servers were stopped after validation.

## Remaining feature and release gates

ElevenLabs is selected; reviewed/licensed audio assets remain gated by Q-15. Recorded-asset cache,
background/lock-screen audio, retained-buffer DSP and measured onset latency are outside the
implemented foreground slice. Latency remains null. Native ASR accuracy, installed-language
availability, hardware interruptions and the full physical-device persistence/convergence matrix
need device/bilingual acceptance. Account export/erasure and rescue UI, OS background sync,
load/security-image acceptance and production service configuration remain with their feature plans.
See [runtime setup](../docs/process/persistent-practice.md).

## Main integration

Plan 94 combines the persistent-practice implementation with main's Google/Apple identity, Android
HTTPS/readiness and text-scale fixes, local CI/APK/deployment tooling and pull gestures. The other
completed persistence/core branch supplies compatible canonical policy and attempt/checkpoint
hardening. Existing roadmap archives and their compatibility paths remain intact. Plan 88 retains
its AWS testing scope; 94 is the next free number for this integration.

### Aggregate local validation — 2026-09-08

`CI_BASE_REF=origin/main pnpm ci:local` passed on runtime commit
`85a005709accf7b5c89a748e216c738588726616`, based on main `f1dde4c`. This includes the unique work
from the separate persistence/core PR #22 at `4d8e783`, both preview schema histories, and main's
OAuth, navigation, preview identity and deployment tooling. Later evidence-only changes do not alter
the validated runtime.

- All 23 fast-gate tasks passed: 346 mobile, 225 core, 34 content and 23 token tests. The separate
  disposable-PostgreSQL gate passed all 171 API tests, for 799 JS/TS cases overall.
- All 169 Rust unit/integration cases passed. Generated tokens, OpenAPI, browser WASM and UniFFI
  output were regenerated and passed drift checks.
- All 155 learner browser tests passed in 7.8 minutes, including the full 71-state accessibility and
  200%/310% text-scale sweeps. The expanded suite now has a documented 12-minute global budget; only
  the two whole-manifest text-scale tests receive a two-minute individual budget. No assertions or
  states were removed after the original eight-minute budget expired at 149 passing tests.
- Three workbench tests and four production web smoke tests passed. Production web and iOS Metro
  exports, API compilation, built-process PostgreSQL smoke and exact Docker-image acceptance passed.
  The image checks cover durable readiness, guarded sync, multilingual content and explicit degraded
  readiness in content-only mode.
- Rust Criterion benchmarks completed; this run does not establish a comparative performance
  regression baseline. GitHub Actions remained disabled, and nothing was deployed.
- [Account and Speak review captures](../docs/reviews/2026-09-08-aggregate/README.md) show the
  production web export with the existing test transport; they are not live-provider or native
  speech acceptance.

The standalone Android preview build (`pnpm apk:local`) also passed from a clean archive of the same
runtime commit: 554 Gradle tasks in 5 minutes 15 seconds. Packaging checks verified
`app.loro.android.preview`, a non-debuggable manifest, bundled production JavaScript, APK signature,
and both `libloro_core.so` and `libop-sqlite.so` for `arm64-v8a` and `x86_64`. This is a
development-signed release for local preview; the API URL is unset and no artifact was uploaded. The
local artifact is `.local-builds/apk/85a005709acc/loro-preview-85a005709acc.apk`, SHA-256
`f876b38cd3e06a2c04c44171a00f7c16ccc755cbb1f78413462b9a2173bb302f`.

The same APK passed the isolated Android emulator smoke with airplane mode enabled and no Metro
connection. Fresh onboarding saved ten phrases. One Refrain rep and its 17% phrase progress survived
force-stop/cold launch; entering Refrain resumed Chorus at REP 1/6. Speak correctly reported
unavailable device speech/audio, revealed 6/6 words before enabling Next, and reset the following
phrase to 0/4 without increasing Today's one-rep total. All 13 captured-UI assertions passed;
microphone permission was not granted and no app-fatal log was observed. One emulator SystemUI
unresponsive dialog after compilation was dismissed with Wait; it was not an app crash. Captures and
the evidence README remain under `.local-builds/apk/85a005709acc/native-smoke/`. The isolated
emulator was stopped afterward. Duplicate callback rejection is covered by browser/unit tests; this
native smoke does not infer it from repeated taps.

The original evidence above remains historical. Full iOS native builds and physical-device speech,
audio interruptions and two-device convergence still require the release acceptance matrix.
