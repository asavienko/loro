# Local Android APK builds and GitHub uploads

This is the local testing APK path for F-03 / plan 58. GitHub Actions remains disabled. The script
uses Expo prebuild and Gradle on your machine and uploads files through the GitHub CLI. It does not
use EAS or submit anything to Google Play.

`pnpm --filter @loro/mobile android` is the Metro-dependent debug workflow and rejects release
variants, custom APKs and caller-supplied app IDs. It forces the Development build flag even when a
local dotenv file selects Preview. Use this Preview APK workflow for a standalone release build.
Development also rejects positional project paths and declares its package directly in the generated
native project so a fresh Metro session can resolve it. Preview retains its own package.

## Prerequisites

- Node 22 and pnpm 9.12.0 (`nvm use 22`).
- JDK 17; set `JAVA_HOME`. On macOS the runner also detects Homebrew's JDK 17 or Android Studio's
  bundled Java runtime. Java must be compatible with the installed Expo/Gradle toolchain.
- Android SDK with platform 36, build-tools 36.0.0, platform-tools, accepted SDK licenses and the
  NDK/CMake versions requested by the generated project. Set `ANDROID_HOME` or `ANDROID_SDK_ROOT`;
  macOS defaults to `~/Library/Android/sdk`.
- `git`, `tar`, `unzip`, and authenticated `gh` for uploads (`gh auth login`).
- Rust and `cargo-ndk` on PATH, with `aarch64-linux-android` and `x86_64-linux-android` installed
  through `rustup target add`. Gradle builds the Rust library with its own NDK and selected ABIs
  before packaging the app; no copied library from a developer checkout is used.
- A clean committed checkout. For uploads, the source commit must already exist in this GitHub repo.
  The script does not push code branches or silently change the source commit.

Run the local validation gate before distributing a changed application:

```bash
nvm use 22
pnpm ci:local
pnpm apk:local
```

Gradle builds both arm64-v8a and x86_64 into one APK. Native projects and dependencies are generated
inside a temporary snapshot of `HEAD`, removed on completion or failure. Your app checkout and any
existing native project are untouched. Dependency/Gradle/SDK downloads use the network; compilation
happens locally. Build output remains under `.local-builds/apk/<commit>/` (gitignored).

## Backend configuration

Without an API URL, the APK supports the implemented local learning flows and reports sign-in as
unavailable. To configure a real backend, supply its public HTTPS URL including `/v1`:

```bash
EXPO_PUBLIC_API_URL=https://your-testing-api.example/v1 pnpm apk:local
```

Use the deployed `ApiUrl` from the [AWS gateway](public-api.md) for standalone internet access.
Account shows the actual server connection and keeps sign-in availability separate.

The URL is public configuration embedded in the APK. It must not contain credentials, query strings
or fragments. The snapshot excludes ignored local environment files; Expo dotenv loading is
disabled. Other inherited `EXPO_PUBLIC_*` values are cleared. No API keys or backend secrets belong
in this build. The backend must register `loro://account` for Preview sign-in. The Metro-dependent
Android development client uses `loro-dev://account`; add that exact redirect to its development
backend only when testing sign-in from that client.

## Upload to GitHub

```bash
pnpm apk:github                 # build, upload and verify a draft prerelease
pnpm apk:github --publish       # publish that prerelease after verification
```

Both commands build from source. They check that GitHub Actions is disabled and the source commit
exists remotely before starting. Each upload creates a unique `apk-<commit>-<timestamp>` draft
prerelease targeting the exact commit. It is never marked as the latest stable release. There is no
asset overwrite or existing-tag reuse.

The upload includes the APK, SHA-256 checksum, and build metadata (source commit, public API URL,
application ID, architectures and signing mode). The workflow downloads the uploaded APK and checks
its hash before optionally publishing. Failed verification leaves a draft for inspection.

## Signing and native boundaries

This uses Gradle's release variant with Expo's **development signing key**, not a production signing
identity. JavaScript/Hermes is bundled, the Android manifest is non-debuggable, and Metro is not
needed. The runner verifies the APK signature, application ID, bundled JavaScript and both Rust and
SQLite shared libraries for each requested ABI before upload.

The local-build config uses `app.loro.android.preview` and the name “Loro Preview”, separate from
the planned production app. OTA/EAS placeholders and missing production icon/splash image references
are excluded only for this preview. Android uses the generated template icon and an explicit
transparent splash drawable, preserving a background-only launch screen. Store signing, branded
native assets and version-code policy remain release work. A verified build is not a device-test
result: SQLite, Rust and foreground device speech modules are implemented, while physical-device
audio/ASR acceptance, iOS builds and background playback remain separate gates. See
[persistent practice](persistent-practice.md) for the recorded platform evidence.

The implementation follows
[Expo's local build flow](https://docs.expo.dev/guides/local-app-production/) and
[GitHub CLI release commands](https://cli.github.com/manual/gh_release_create).

## Verified build

### Open emulator startup report

[ANDROID-2026-09-09-01](../reviews/2026-09-09-android-script-load.md) records an “Unable to load
script” startup failure in the installed debuggable `app.loro.android` APK: it has no embedded
JavaScript bundle and fails when launched without Metro. The separately installed
`app.loro.android.preview` APK contains the bundle and was verified to cold-launch into onboarding
without Metro. Open **Loro Preview** for standalone testing. The affected debug APK's source and
recovery with matching Metro remain unverified; port forwarding alone does not start Metro. Future
debug builds use `app.loro.android.dev` and the **Loro Development** launcher label, so they cannot
be mistaken for the standalone application. Its `loro-dev://` scheme also keeps Expo's debug launch
link separate from Preview's `loro://` scheme.

### 2026-09-07 build evidence

On 2026-09-07, commit `6891fe5316a4` produced a 45,511,837-byte APK for both configured ABIs.
Signature, non-debuggable preview manifest, bundled JavaScript and downloaded GitHub asset checksum
passed. The artifact is in
[the draft GitHub release](https://github.com/asavienko/loro/releases/tag/untagged-61fbf2e2b1e7dc39497a).
The native build required explicitly pinning Expo's Worklets 0.5.1 and generating the preview splash
drawable. No emulator/device launch or sign-in backend was tested.

Workspace checks and 128 learner browser tests passed after the dependency fix. Dependency audit
reported 16 high and 8 moderate advisories before and after that fix, with no new advisory IDs;
those existing advisories are not resolved by this workflow.

## Native evidence collection (plan 58)

`pnpm native:evidence --artifact-revision GIT_REVISION --artifact .local-builds/RETAINED_BUILD`
captures Android device metadata, permissions, logs and the current screen. The collector resolves
the revision to a local Git commit and records the retained build file's SHA-256 and byte size in
the evidence manifest. For an already installed iOS simulator app, use:

```bash
pnpm native:evidence --platform ios --package app.loro.ios --serial SIMULATOR-UDID --artifact-revision GIT_REVISION --artifact .local-builds/RETAINED_BUILD
```

Full Xcode must be selected with an installed simulator runtime and a booted simulator. Omitting
`--serial` requires exactly one available booted simulator. The collector checks that the requested
bundle is installed, then retains Xcode version, selected device/runtime metadata, the current
screen PNG and a manifest under `.local-builds/native-evidence/`. It does not launch or install an
app, read app data, grant permissions or collect simulator-wide logs. Use a test simulator and
review screenshots before sharing them. Fixtures exercise collection and prerequisite failures; they
do not constitute a device run.

The installed artifact remains explicitly unverified: the retained file hash identifies reviewed
bytes, but does not prove those bytes are installed. Retain and correlate the app's build metadata
separately. A screenshot does not establish that the app is foregrounded or a scenario passed.

Plan 101 wave-path rows (`stream-to-phrase-refrain`, `menu-hard-refrain`,
`practice-back-swipe-disabled`) are listed on the manifest as `unavailable` until a device run
drives those entries and records the exact URLs. `pnpm native:evidence --list-scenarios` prints the
catalog without collecting. On a connected Android device,
`pnpm native:evidence --execute-scenarios --artifact-revision … --artifact …` dumps the hierarchy,
taps Stream → phrase Refrain and menu hard-filter, and edge-swipes the practice stack. Missing adb,
missing device, or a dump without a matching URL stays `unavailable` or `failed` — a screenshot
collector must not mark those rows passed. Browser mouse/touch coverage for the two navigation
entries is in the learner E2E suite; it is not native proof. iOS `--execute-scenarios` is rejected
(the runner is adb/uiautomator). Clean iOS compilation, minimum OS floors, physical-device
permissions/speech, persistence, lifecycle and interruption scenarios remain plan 58 acceptance
gates.
