# Canonical core native transport

This local Expo module calls generated UniFFI `coreCall`; it contains no algorithms. Run
`packages/core-rs/build-native-module.sh` before `expo prebuild` and a native build. The generated
Swift/Kotlin sources are committed under `packages/core-rs/bindings`. Platform binaries are local
build artifacts. Expo Go cannot load this module.

Native acceptance still requires a real app build and device restart test. Host Rust and browser
WASM tests are not evidence that the native bridge loads.

For Android on this workstation, use Android Studio's bundled JBR as `JAVA_HOME` and
`~/Library/Android/sdk` as `ANDROID_HOME`; a system Java runtime is not installed. After prebuild,
`./gradlew --no-daemon :loro-core:compileDebugKotlin` checks the Expo/UniFFI source bridge.
`build-native-module.sh android` builds arm64-v8a, armeabi-v7a and x86_64 Rust libraries. Neither
command proves a device cold start.
