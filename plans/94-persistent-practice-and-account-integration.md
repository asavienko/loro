# Persistent practice, native speech, canonical core and account sync

- **Requirement IDs:** `F-01`…`F-04`, `F-07`, `F-08`, `AS-01`…`AS-06`, `LB-01`…`LB-27`
- **Status:** 🟡 Runtime implemented and local acceptance passed. Remaining gates are full iOS
  native validation, physical-device speech/convergence acceptance, approved audio assets (Q-15),
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
4. Email verification is optional and authenticated backend data is durable in Postgres. Native
   refresh credentials live in secure storage; browser credentials have page lifetime.
5. Sync binds a local installation to one verified account, replays the transactional outbox,
   resolves catalog identity aliases and advances a cursor only after local apply commits.

## Verification

Run the repository gate, browser state/accessibility/text-scale tests, production export, canonical
Rust/WASM parity and real Postgres integration tests. Record native compile/device evidence exactly;
source inspection and browser tests cannot prove native speech accuracy or offline device behavior.
Do not enable GitHub Actions or deploy infrastructure as part of this implementation request.

## Implemented runtime

- Device/browser SQLite, four migrations, atomic progress/session/outbox writes, course hydration,
  non-destructive storage recovery and durable deletion Undo.
- Reference-backed Rust FSRS-6, selection, cloze, ranking, matching, HLC and merge; generated
  embedded browser WASM and native UniFFI/Expo ports with drift checks.
- Native foreground TTS, strict on-device ASR, Speak recognition/reveal paths and truthful progress.
  The Android release smoke exposed missing Hermes plural support; bundled EN/BG/RU PluralRules now
  initializes before ICU, with a regression that starts without the platform API.
- Optional email/code Account screen, native secure refresh storage/rotation, logout and account
  binding. Google/Apple server verification exists; native provider buttons remain future work.
- Postgres tenant/device isolation, replay receipts, cursor snapshots, catalog identity aliases,
  deletion/re-add proofs and exact receipt clock corrections. Client acknowledgement/apply/cursor
  changes commit together; foreground/connectivity/write events trigger bounded retries.

## Validation record

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

Final browser run: **136 tests passed in 6.3 minutes**, including invalid-code and unavailable-sync
states, persistence recovery, route/navigation flows, accessibility and full 200%/310% text-scale
sweeps. Native builds and source edits were settled before this accepted run. The repository gate
also passes 284 mobile tests, 202 core tests, 34 content tests and 23 token tests; the separate
Postgres run completes the 140 API tests. Temporary test database, emulator and development servers
were stopped after validation.

## Remaining feature and release gates

Recorded audio assets/cache (Q-15), background/lock-screen audio, retained-buffer DSP and measured
onset latency are outside the implemented foreground slice. Latency remains null. Native ASR
accuracy, installed-language availability, hardware interruptions and the full physical-device
persistence/convergence matrix need device/bilingual acceptance. Account export/erasure and rescue
UI, OS background sync, load/security-image acceptance and production service configuration remain
with their feature plans. See [runtime setup](../docs/process/persistent-practice.md).
