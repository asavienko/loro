# Local Android APK

`pnpm apk:local` builds a standalone testing APK (`app.loro.android.preview`, "Loro Preview") from a
clean committed snapshot, with Expo prebuild and Gradle on your machine. No EAS, no Play Store, no
GitHub Actions. `pnpm --filter @loro/mobile android` is the separate Metro-dependent debug build
(`app.loro.android.dev`, "Loro Development"). Both identities are set in
`apps/mobile/app.config.ts`.

## Prerequisites

- Node 22 and pnpm 9 (`nvm use 22`).
- JDK 17 (`JAVA_HOME`, or Homebrew's / Android Studio's on macOS).
- Android SDK platform 36, build-tools 36.0.0, platform-tools, accepted licenses and the NDK/CMake
  the generated project asks for (`ANDROID_HOME`, default `~/Library/Android/sdk`).
- Rust with `cargo-ndk` and the `aarch64-linux-android` and `x86_64-linux-android` targets.
- A clean committed checkout; for uploads, `gh auth login` and the commit pushed to GitHub.

```bash
pnpm ci:local
pnpm apk:local
```

The APK (arm64-v8a and x86_64) lands in `.local-builds/apk/<commit>/` (gitignored). The snapshot is
built in a temporary directory; `apps/mobile/android` is generated, never a checkout.

## API URL

The app loads its content, sign-in and generation from the API, so set `EXPO_PUBLIC_API_URL` (HTTPS,
ending in `/v1`) to a server the phone can reach; a release build refuses cleartext
`http://localhost`. `EXPO_PUBLIC_WEB_URL` (HTTPS) makes shared links open in a browser
(`https://…/shared/CODE`) instead of only in the app (`loro://shared/CODE`).
`EXPO_PUBLIC_POSTHOG_KEY` (and optionally `EXPO_PUBLIC_POSTHOG_HOST`) turns on analytics and session
replay ([ADR-0011](../architecture/adr/0011-analytics-and-privacy.md)). The runner clears every
other `EXPO_PUBLIC_*` value and ignores dotenv files; no secrets belong in the build. Note that the
EC2 gateway doesn't expose `/v1/library/*` yet ([ec2-deployment.md](ec2-deployment.md)).

## Upload to GitHub

```bash
pnpm apk:github              # build, upload and verify a draft prerelease
pnpm apk:github --publish    # publish it after verification
```

Each upload is a new `apk-<commit>-<timestamp>` draft prerelease with the APK, its SHA-256 and build
metadata; the runner downloads it back and checks the hash.

## Signing

The release variant is signed with Expo's **development key**, not a store identity. The runner
checks the signature, application ID, bundled JavaScript and the Rust library for each ABI. A
verified build is not a device test.

## Device evidence

`pnpm native:evidence --artifact-revision REV --artifact .local-builds/…` captures Android device
metadata, logs and the current screen into `.local-builds/native-evidence/`; add
`--platform ios --package app.loro.ios --serial SIMULATOR-UDID` for a booted iOS simulator. It
records what was on screen, not that a scenario passed.
