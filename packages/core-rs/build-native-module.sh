#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
ARTIFACTS=../../apps/mobile/modules/loro-core/artifacts
mkdir -p "$ARTIFACTS"
# Explicit platform selection lets Android development proceed without Xcode.
PLATFORM="${1:-all}"
if [[ "$PLATFORM" != all && "$PLATFORM" != ios && "$PLATFORM" != android ]]; then
  echo 'usage: build-native-module.sh [all|ios|android]' >&2; exit 1
fi
if [[ "$PLATFORM" == all || "$PLATFORM" == ios ]]; then
  for target in aarch64-apple-ios aarch64-apple-ios-sim; do
    cargo build --release --lib --target "$target"
  done
  mkdir -p "$ARTIFACTS/headers"
  cp bindings/loro_coreFFI.h "$ARTIFACTS/headers/"
  cp bindings/loro_coreFFI.modulemap "$ARTIFACTS/headers/module.modulemap"
  xcodebuild -create-xcframework \
    -library target/aarch64-apple-ios/release/libloro_core.a -headers "$ARTIFACTS/headers" \
    -library target/aarch64-apple-ios-sim/release/libloro_core.a -headers "$ARTIFACTS/headers" \
    -output "$ARTIFACTS/LoroCoreFFI.xcframework"
fi
if [[ "$PLATFORM" == all || "$PLATFORM" == android ]]; then
  cargo ndk -t arm64-v8a -t armeabi-v7a -t x86_64 -o "$ARTIFACTS/jniLibs" build --release --lib
fi
