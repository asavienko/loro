# Local iOS builds

`pnpm ipa:local` builds Loro for iPhone from the committed `HEAD` on a Mac, with Expo prebuild,
CocoaPods and `xcodebuild`. There is no EAS, App Store listing or GitHub Actions step. It is the iOS
counterpart of [`pnpm apk:local`](local-apk.md); the runner is `scripts/ipa-local.mjs`, its tested
options and settings `scripts/ipa-environment.mjs`.

The runner was written without a Mac. Its options, export settings and the Xcode project that
prebuild generates were checked on Linux, but it hasn't yet been run end to end on a Mac, so the
first build there is its test.

## Installing without the App Store

On Android any APK installs once the phone allows it. An iPhone installs only an app signed for it
through an Apple account, so iOS has no "download the file and open it". Four ways work without a
public App Store listing:

| Way         | Apple account                          | Who can install                                                                                     | How long it opens               | Command                                |
| ----------- | -------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------- | -------------------------------------- |
| Development | A free Apple ID, or a paid team        | Your own iPhones, plugged into the Mac                                                              | 7 days (free Apple ID), 1 year  | `pnpm ipa:local --install --device ID` |
| Ad hoc      | Apple Developer Program (paid, yearly) | Up to 100 iPhones a year, each registered by its UDID before the build                              | The provisioning profile's year | `pnpm ipa:local --export ad-hoc`       |
| TestFlight  | Apple Developer Program                | 100 internal testers, and up to 10,000 external ones by email or public link, in the TestFlight app | 90 days per build               | `pnpm ipa:testflight`                  |
| Simulator   | None                                   | The iOS Simulator on the Mac that built it                                                          | Indefinitely                    | `pnpm ipa:simulator --install`         |

- **A free Apple ID** works for development builds on your own phone only: the app stops opening
  after 7 days (rebuild to renew), at most 3 such apps fit on a phone, and it can't receive pushes.
  On the phone, turn on Settings › Privacy & Security › Developer Mode, and trust the developer
  under Settings › General › VPN & Device Management.
- **TestFlight is closest to `pnpm apk:github`**: no UDIDs, testers install the TestFlight app and
  open the invitation. External testers wait for Apple's Beta App Review the first time. It needs an
  App Store Connect app record for `app.loro.ios`, but the app is never listed in the App Store.
- **Ad hoc**: register each tester's iPhone at developer.apple.com › Devices first, then build: the
  profile only covers devices registered before the build. Install the IPA on a phone plugged into
  the Mac with `--install --device ID`, by dragging it onto the phone in Finder, or with Apple
  Configurator.
- In the EU, apps can also be installed from alternative marketplaces or a website, but that
  requires a paid account, Apple's notarization and (for a website) an established developer
  account. Loro doesn't use it.

## Prerequisites

- macOS with full Xcode (16 or later, for Expo SDK 54) and its iOS platform; `xcode-select -p` must
  point at Xcode, not the Command Line Tools.
- CocoaPods (`brew install cocoapods`), Node 22 and pnpm 9 (`nvm use 22`).
- Rust with `aarch64-apple-ios` for phones, and `aarch64-apple-ios-sim` (Apple silicon) or
  `x86_64-apple-ios` (Intel) for the simulator: `rustup target add …`.
- For signed builds, the Apple account signed in under Xcode › Settings › Accounts, or an App Store
  Connect API key in `APP_STORE_CONNECT_API_KEY_PATH`, `APP_STORE_CONNECT_API_KEY_ID` and
  `APP_STORE_CONNECT_API_ISSUER_ID`. Signing is automatic, so no certificate or profile is kept in
  the repository.
- The team ID: `--team TEAMID` or `APPLE_TEAM_ID` (Xcode › Settings › Accounts, or
  developer.apple.com › Membership). A free Apple ID has a personal team with its own ID.
- A clean working tree, untracked files included: the runner builds `HEAD` and refuses otherwise.

```bash
pnpm ipa:simulator --install                                     # no Apple account
APPLE_TEAM_ID=ABCDE12345 pnpm ipa:local --install --device UDID  # your phone (xcrun devicectl list devices)
EXPO_PUBLIC_API_URL=https://GATEWAY_HOST/v1 pnpm ipa:local --export ad-hoc --team ABCDE12345
EXPO_PUBLIC_API_URL=https://GATEWAY_HOST/v1 pnpm ipa:testflight --team ABCDE12345
```

The runner extracts `HEAD` into a temporary directory and builds there, so `apps/mobile/ios` is
always generated, never a checkout. The Rust core is compiled for the build's target by the
`LoroCore` pod's build phase (`modules/loro-core/scripts/build-ios.sh`). Output lands in
`.local-builds/ipa/<commit>/` (gitignored): the IPA (or, for the simulator, a zipped `.app`), its
SHA-256 and `build-<kind>.json`.

## Identities and build numbers

Development, ad hoc and simulator builds are "Loro Preview" (`app.loro.ios.preview`), so they
install beside the store app. A bundle identifier belongs to the first team that registers it; if
yours can't have that one (a personal team, for instance), set `LORO_IOS_BUNDLE_ID` to one of your
own. TestFlight builds are the store app, "Loro" (`app.loro.ios`), because TestFlight is that app's
beta channel. Both identities are set in `apps/mobile/app.config.ts`.

The build number (`CFBundleVersion`) is the commit count of `HEAD`, which grows along `main`, since
App Store Connect refuses a number it has already seen. `LORO_IOS_BUILD_NUMBER` overrides it.

## API URL and analytics

As for the APK ([local-apk.md](local-apk.md#api-url)): `EXPO_PUBLIC_API_URL` must be HTTPS and end
in `/v1`, `EXPO_PUBLIC_WEB_URL` is optional, and the PostHog key and host come from the shell or
`apps/mobile/.env`. Every other `EXPO_PUBLIC_*` value is cleared. Ad hoc and TestFlight builds are
for other people's phones, so they refuse to build without an API URL or a PostHog key. A
development or simulator build without an API URL looks for `http://localhost:3000/v1`, which only
the simulator on the same Mac can reach.

## Push notifications

expo-notifications always adds the push entitlement, which a free Apple ID can't sign. Without
`EAS_PROJECT_ID` the app never asks for a push token (`src/platform/push.ts`), so `app.config.ts`
removes the entitlement in that case. Such builds tell the learner a song is ready only from the app
itself, while it runs in the background. A build with `EAS_PROJECT_ID` keeps the entitlement, and
needs a paid team.

## What the runner checks

Before keeping or uploading a build, it checks the bundle identifier, the build number, the bundled
JavaScript (`main.jsbundle`), and that the app asks for no microphone (ADR-0011). Signed builds also
get `codesign --verify --deep --strict` and an embedded provisioning profile. A TestFlight build is
exported and checked locally first, then uploaded. A checked build is not a device test: use
`pnpm native:evidence --platform ios --package app.loro.ios.preview --serial SIMULATOR-UDID` for a
simulator ([local-apk.md](local-apk.md#device-evidence)).

## Why it is built this way

- **Locally, with `xcodebuild`, like the APK.** CI runs on the developer's machine
  ([ci-cd.md](ci-cd.md)). EAS Build would build without a Mac, but it sends the source to Expo's
  servers and adds an account and its limits. It is the fallback if no Mac is available.
- **Automatic signing.** The repository is public
  ([ADR-0018](../architecture/adr/0018-public-source-available-repository.md)), so certificates and
  profiles stay in the developer's Xcode or Apple account, never in the tree.
- **No download page for ad hoc builds yet.** Installing over the air takes a `manifest.plist` and
  the IPA served over HTTPS for each build, and the phone still has to be registered. TestFlight
  covers testers who aren't near the Mac, so that page wasn't built.
