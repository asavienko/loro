# LoroCore — the Rust core as an Expo module

This local Expo module gives iOS and Android the Rust core, which Hermes cannot run as WebAssembly.
It exposes one synchronous function, `LoroCore.call(method, inputJson): string`, which calls the
committed UniFFI `coreCall` binding of [`packages/core-rs`](../../../../packages/core-rs/README.md).
`src/platform/loroCore.ts` wraps it as `core_call`, and `metro.config.js` puts that wrapper in place
of the browser build on native. The app calls it for FSRS; it carries JSON, never recordings.

Expo autolinking finds the module through its default `./modules` search; no config plugin or
hand-edit of the generated native projects is needed. Expo Go doesn't contain it, so the app needs a
development build.

## Prerequisites

- Rust 1.88 or later.
- iOS: full Xcode, CocoaPods and the targets `aarch64-apple-ios`, `aarch64-apple-ios-sim`, and
  `x86_64-apple-ios` for an Intel simulator.
- Android: the app's Android SDK and NDK, `cargo install cargo-ndk --locked`, and the targets
  `aarch64-linux-android`, `armv7-linux-androideabi`, `i686-linux-android` and
  `x86_64-linux-android`.

## How it builds

- **iOS.** A pod script phase runs `scripts/build-ios.sh` for the architectures Xcode requests and
  links the static Rust library. `ios/generated/` holds tracked symlinks to
  `packages/core-rs/bindings/`, because CocoaPods doesn't find sources outside the pod root; keep
  the symlinks when copying the repository or preparing an archive.
- **Android.** Gradle's `preBuild` runs `scripts/build-android.sh` for `reactNativeArchitectures`
  (default `arm64-v8a,armeabi-v7a,x86,x86_64`) into `android/build/rust-jniLibs`, aligned for 16
  KiB-page devices. The module adds the JNA AAR UniFFI needs, and `consumer-rules.pro` keeps its
  reflected classes in release builds.

Both build with `cargo --locked --lib` into ignored `build/` directories and compile the committed
bindings in place; they never regenerate them. When the Rust exports change, regenerate the bindings
with `pnpm core-rs:build` and commit them. UniFFI checks interface checksums when it loads the
library, so a stale library or binding fails loudly.

To run the Android build on its own (with `ANDROID_NDK_HOME` set):

```bash
bash apps/mobile/modules/loro-core/scripts/build-android.sh \
  "$PWD/apps/mobile/modules/loro-core/android/build/rust-jniLibs" arm64-v8a
```

A Rust build that compiles proves neither Expo registration nor device execution. Before a native
release, build both apps and check a call through `LoroCore` on a device or emulator, including
after the process restarts.
