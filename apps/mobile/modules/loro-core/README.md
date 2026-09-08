# Canonical Rust native bridge

This local Expo module exposes `LoroCore.call(method, inputJson): string` synchronously. Both native
implementations call the committed UniFFI `coreCall` binding; scheduling and merge policy stay in
`packages/core-rs`. The bridge accepts JSON domain data, never recordings.

Expo autolinking discovers this directory through its default `./modules` search. A development
build is required: Expo Go does not contain this module. No config plugin or manual changes to
generated iOS/Android projects are needed.

## Build prerequisites

- Rust 1.88 or later, with the platform targets installed using `rustup target add`.
- iOS: full Xcode and CocoaPods; `aarch64-apple-ios`, `aarch64-apple-ios-sim`, and
  `x86_64-apple-ios` when building an Intel simulator.
- Android: the app's configured Android SDK/NDK, `cargo install cargo-ndk --locked`, and the
  corresponding Rust targets (`aarch64-linux-android`, `armv7-linux-androideabi`,
  `i686-linux-android`, `x86_64-linux-android`).

The pod build compiles the requested iOS architecture(s), then links the static Rust library. Gradle
compiles its `reactNativeArchitectures` into its generated `jniLibs` directory before packaging.
Both use `cargo --locked --lib`; outputs and intermediate Cargo artifacts live in ignored `build/`
directories. Android includes the JNA AAR required by UniFFI and preserves its reflected bindings in
release builds.

The iOS `generated/` files are tracked symlinks to the canonical binding files because CocoaPods
does not discover source globs outside a pod root. Preserve those symlinks when copying the
repository or preparing build archives.

Regenerate bindings through the repository's `packages/core-rs/build.sh` workflow whenever Rust
exports change. Native builds compile the committed Swift/Kotlin bindings in place; they never
silently regenerate source files. UniFFI validates the interface checksums when loading a library,
so a stale library or binding fails explicitly.

To exercise the Android build hook independently (with `ANDROID_NDK_HOME` set):

```bash
bash apps/mobile/modules/loro-core/scripts/build-android.sh \
  "$PWD/apps/mobile/modules/loro-core/android/build/rust-jniLibs" arm64-v8a
```

A successful Rust compilation alone does not prove Expo registration or device execution. Before
native release, build both apps and verify a call through `requireNativeModule('LoroCore')` on a
device/emulator, including process restart and a real sync merge.
