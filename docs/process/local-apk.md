# Local Android APK builds and GitHub uploads

This is the local testing APK path for F-03 / plan 58. GitHub Actions remains disabled. The script
uses Expo prebuild and Gradle on your machine and uploads files through the GitHub CLI. It does not
use EAS or submit anything to Google Play.

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
in this build. The backend must register the existing `loro://account` redirect for sign-in.

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

`pnpm native:evidence --artifact-revision GIT_REVISION` captures Android device metadata,
permissions, logs and the current screen, bound to the retained revision of the installed build. For
an already installed iOS simulator app, use:

```bash
pnpm native:evidence --platform ios --package app.loro.ios --serial SIMULATOR-UDID --artifact-revision GIT_REVISION
```

Full Xcode must be selected with an installed simulator runtime and a booted simulator. Omitting
`--serial` requires exactly one available booted simulator. The collector checks that the requested
bundle is installed, then retains Xcode version, selected device/runtime metadata, the current
screen PNG and a manifest under `.local-builds/native-evidence/`. It does not launch or install an
app, read app data, grant permissions or collect simulator-wide logs. Use a test simulator and
review screenshots before sharing them. Fixtures exercise collection and prerequisite failures; they
do not constitute a device run.

The installed artifact revision remains explicitly unverified: retain and correlate the app's build
metadata separately. A screenshot does not establish that the app is foregrounded or a scenario
passed. Clean iOS compilation, minimum OS floors, physical-device permissions/speech, persistence,
lifecycle and interruption scenarios remain plan 58 acceptance gates.
