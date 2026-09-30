# Local Android APK builds and GitHub uploads

This is the local testing APK path for F-03 / plan 58. GitHub Actions remains disabled. The script
uses Expo prebuild and Gradle on your machine and uploads files through the GitHub CLI. It does not
use EAS or submit anything to Google Play.

`pnpm --filter @loro/mobile android` is the Metro-dependent debug workflow and rejects release
variants, custom APKs and caller-supplied app IDs. It forces the Development identity
(`LORO_ANDROID_DEV_CLIENT=1`, `app.loro.android.dev`) even when a local dotenv file selects Preview.
Use this Preview APK workflow (`LORO_LOCAL_APK=1`, `app.loro.android.preview`) for a standalone
release build. Both identities are chosen in `apps/mobile/app.config.ts`.

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

The app loads its sets, albums, sign-in and generation from the API (plan 106), so the APK needs
one. Set `EXPO_PUBLIC_API_URL` (HTTPS, ending in `/v1`, no credentials, query or fragment) to a
server the phone can reach. Without it the APK looks for `http://localhost:3000/v1`, which a release
build can't use (Android refuses cleartext HTTP outside debug builds), so the app opens on its
"can't reach Loro" screen; for a local API, use the development build
(`pnpm --filter @loro/mobile android`) instead. `EXPO_PUBLIC_WEB_URL` (HTTPS) is where the web app
is served: with it, shared sets and albums are sent as `https://…/shared/CODE`, which opens in any
browser; without it a phone shares `loro://shared/CODE`, which opens only where Loro is installed.
The runner clears every other inherited `EXPO_PUBLIC_*` value; ignored local environment files are
excluded and Expo dotenv loading is disabled. No API keys or backend secrets belong in this build.

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
needed. The runner verifies the APK signature, application ID, bundled JavaScript and the Rust
shared library for each requested ABI before upload.

The local-build config uses `app.loro.android.preview` and the name “Loro Preview”, separate from
the production app. Store signing and version-code policy remain release work. A verified build is
not a device-test result: physical-device audio acceptance, iOS builds and background playback
remain separate gates. The build evidence below predates the 2026-09-30 app swap. See
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
separately. A screenshot does not establish that the app is foregrounded or a scenario passed. Clean
iOS compilation, minimum OS floors, physical-device permissions/speech, persistence, lifecycle and
interruption scenarios remain plan 58 acceptance gates.
