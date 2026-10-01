# Local Android APK

`pnpm apk:local` builds a standalone testing APK, "Loro Preview" (`app.loro.android.preview`), from
the committed `HEAD`, with Expo prebuild and Gradle on your machine. There is no EAS, Play Store or
GitHub Actions step. It installs beside the Metro-dependent debug build that
`pnpm --filter @loro/mobile android` makes (`app.loro.android.dev`, scheme `loro-dev`). Both
identities are set in `apps/mobile/app.config.ts`.

## Prerequisites

- Node 22 and pnpm 9 (`nvm use 22`).
- JDK 17: `JAVA_HOME`, or Homebrew's `openjdk@17` or Android Studio's runtime on macOS.
- Android SDK platform 36, build-tools 36.0.0, platform-tools, accepted licences and the NDK/CMake
  the generated project asks for (`ANDROID_HOME`, else `ANDROID_SDK_ROOT`, else
  `~/Library/Android/sdk`).
- Rust with `cargo-ndk` and the `aarch64-linux-android` and `x86_64-linux-android` targets.
- A clean working tree, untracked files included: the runner builds `HEAD` and refuses otherwise.
- For uploads: `gh auth login`, GitHub Actions disabled on the repository, and the commit pushed.

```bash
pnpm ci:local
pnpm apk:local
```

The runner extracts `HEAD` into a temporary directory and builds there, so `apps/mobile/android` is
always generated, never a checkout. The release APK (arm64-v8a and x86_64) lands in
`.local-builds/apk/<commit>/` (gitignored) as `loro-preview-<commit>.apk`, with its SHA-256 and a
`build.json`.

## API URL

The app loads its courses, sign-in and generation from the API, so set `EXPO_PUBLIC_API_URL` to a
server the phone can reach: HTTPS, ending in `/v1`, without credentials, query or fragment. Without
it the APK looks for `http://localhost:3000/v1`, which a release build can't reach; uploads refuse
to run without it. `EXPO_PUBLIC_WEB_URL` (HTTPS) makes shared links open in a browser
(`https://…/shared/CODE`) instead of only in the app (`loro://shared/CODE`).
`EXPO_PUBLIC_POSTHOG_KEY` and `EXPO_PUBLIC_POSTHOG_HOST` pass through
([environments.md](environments.md#the-app-build-time)). The runner clears every other
`EXPO_PUBLIC_*` value and ignores dotenv files, so no secret reaches the build.

The EC2 gateway's `ApiUrl` output serves the library only with the gateway's `AccountAccess=enabled`
and nginx in `accounts` mode ([ec2-deployment.md](ec2-deployment.md#public-https-gateway)).

```bash
EXPO_PUBLIC_API_URL=https://GATEWAY_HOST/v1 pnpm apk:local
```

## Upload to GitHub

```bash
pnpm apk:github              # build, upload and verify a draft prerelease
pnpm apk:github --publish    # also publish it after verification
```

Each upload is a new `apk-<commit>-<timestamp>` draft prerelease holding the APK, its SHA-256 and
`build.json`. The runner downloads the APK back and compares the hash before it publishes.

## Signing

The release variant is signed with Expo's **development key**, not a store identity. The runner
verifies the signature, the preview application ID, a non-debuggable manifest, the bundled
JavaScript and the Rust library for each ABI. A verified build is not a device test.

## Device evidence

```bash
pnpm native:evidence --artifact-revision REV --artifact .local-builds/apk/<commit>/loro-preview-<commit>.apk
```

It captures device metadata, logs and the current screen of one connected Android device (`--serial`
to choose) into `.local-builds/native-evidence/`. For a booted iOS simulator add
`--platform ios --package app.loro.ios --serial SIMULATOR-UDID`. It records what was on screen, not
that a scenario passed.
