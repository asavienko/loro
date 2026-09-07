# Native canonical core and SQLite runtime

The local Expo module in `apps/mobile/modules/loro-core` transports JSON to the same Rust
`core_call` used by Node and browser WASM. Generated Swift/Kotlin bindings live in
`packages/core-rs/bindings`; never edit them by hand. The native database driver uses op-sqlite
synchronously, with explicit SQLite transactions and nested savepoints. It does not use op-sqlite's
asynchronous transaction wrapper. Expo Go cannot load these custom native modules.

Current dependencies: Expo **54.0.36**, expo-modules-core **3.0.30**, @op-engineering/op-sqlite
**18.2.0**, UniFFI **0.32.0**. The lockfile is authoritative.

## Android

Use Node 22 and install the Android SDK, NDK, cargo-ndk and Rust Android targets. On the verified
workstation, SDK/build tools 35/36 and NDK 27.1.12297006 exist; Java comes from Android Studio's
bundled JBR.

```sh
source ~/.nvm/nvm.sh
nvm use 22
export PATH="$HOME/.cargo/bin:$PATH"
export JAVA_HOME='/Applications/Android Studio.app/Contents/jbr/Contents/Home'
export ANDROID_HOME="$HOME/Library/Android/sdk"
export ANDROID_NDK_HOME="$ANDROID_HOME/ndk/27.1.12297006"
./packages/core-rs/build.sh
./packages/core-rs/build-native-module.sh android
pnpm --filter @loro/mobile exec expo prebuild --platform android --no-install
cd apps/mobile/android
./gradlew --no-daemon :loro-core:compileDebugKotlin
./gradlew --no-daemon :app:assembleDebug
```

The native script creates arm64-v8a, armeabi-v7a and x86_64 libraries under the module's ignored
`artifacts/jniLibs` directory. Prebuild derives the Android project from app config; it is not the
authored module source. Start Metro with `pnpm --filter @loro/mobile exec expo start --dev-client`
for a development build. Use an existing emulator/device without wiping its data.

## iOS

Full Xcode, command-line selection, CocoaPods and the Rust iOS device/simulator targets are
required. After the host/bindings build above:

```sh
./packages/core-rs/build-native-module.sh ios
pnpm --filter @loro/mobile exec expo prebuild --platform ios
pnpm --filter @loro/mobile exec expo run:ios
```

The script creates the ignored `LoroCoreFFI.xcframework` with the generated FFI header/module map.
Rebuilding an existing XCFramework requires removing only that previous generated output first. This
workstation currently has Command Line Tools but no full Xcode, so this path has not been compiled
here.

## Verified boundaries

On 2026-09-07, host + both WASM builds, transport parity, generated bindings, Android prebuild, all
three Android Rust ABI builds, Kotlin bridge compilation and an arm64-v8a debug APK build passed.
The APK was installed into the existing `Pixel_8_API_36` AVD, where no Loro package was previously
installed.

Native acceptance exercised onboarding, one manual Refrain rep and force-stop/relaunch:

| State          | Total reps | Outbox rows | Committed attempts | Review events | Cursor |
| -------------- | ---------: | ----------: | -----------------: | ------------: | -----: |
| Before rep     |          0 |           6 |                  0 |             0 |      0 |
| After rep      |          1 |           9 |                  1 |             1 |      1 |
| After relaunch |          1 |           9 |                  1 |             1 |      1 |

The session identity remained unchanged. Reopening Refrain displayed REP 1/6, Chorus and 17%
automaticity. The Android-persisted complete FSRS group exactly matched Node WASM computed from the
prior phrase state and identical grade/time. Switching to Bulgarian and relaunching preserved the
selected course, four Bulgarian phrases with zero reps and the Spanish course's four phrases/one
rep, with separate checkpoint cursors zero and one. SQLite schema migrations 1–3 and the
installation identity survived restart. This is one Android emulator acceptance path; it does not
prove iOS, hardware storage failures, microphone/audio behavior or multi-device sync.

The full APK build required pinning `react-native-worklets` to Expo SDK-compatible **0.5.1**; the
previously resolved 0.11.3 rejected React Native 0.81.5. App config also removes a stale splash-logo
override when no artwork exists, allowing Android's default icon. Browser WASM bytes are bundled
locally without a runtime fetch.

Native smoke identified an additional formatting limitation: Hermes lacks `Intl.PluralRules` and
`Intl.Locale`, confirmed through its inspector. ICU plurals rendered as raw template text before a
native polyfill is installed. This does not invalidate the storage measurements above but remains a
native UI acceptance issue.

Implementation references:
[Expo synchronous module functions](https://docs.expo.dev/modules/module-api/) and
[op-sqlite API](https://op-engineering.github.io/op-sqlite/docs/api/).
