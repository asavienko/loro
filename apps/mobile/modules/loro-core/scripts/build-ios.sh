#!/usr/bin/env bash
# Called by the pod build, once for the architectures/platform Xcode requested.
set -euo pipefail

LORO_MODULE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LORO_RUST_DIR="$(cd "$LORO_MODULE_DIR/../../../../packages/core-rs" && pwd)"
export PATH="$HOME/.cargo/bin:$PATH"
export CARGO_TARGET_DIR="$LORO_MODULE_DIR/build/rust-ios"

: "${PLATFORM_NAME:?Run this script from the LoroCore Xcode build phase.}"
: "${ARCHS:?Xcode must supply the requested architectures.}"
: "${BUILT_PRODUCTS_DIR:?Xcode must supply the build output directory.}"

LORO_LIBRARIES=()
for LORO_ARCH in $ARCHS; do
  case "$PLATFORM_NAME/$LORO_ARCH" in
    iphoneos/arm64) LORO_TARGET=aarch64-apple-ios ;;
    iphonesimulator/arm64) LORO_TARGET=aarch64-apple-ios-sim ;;
    iphonesimulator/x86_64) LORO_TARGET=x86_64-apple-ios ;;
    *) echo "Unsupported LoroCore platform/architecture: $PLATFORM_NAME/$LORO_ARCH" >&2; exit 1 ;;
  esac
  cargo build --manifest-path "$LORO_RUST_DIR/Cargo.toml" --lib --release --locked --target "$LORO_TARGET"
  LORO_LIBRARIES+=("$CARGO_TARGET_DIR/$LORO_TARGET/release/libloro_core.a")
done

mkdir -p "$BUILT_PRODUCTS_DIR"
if [[ ${#LORO_LIBRARIES[@]} -eq 1 ]]; then
  cp "${LORO_LIBRARIES[0]}" "$BUILT_PRODUCTS_DIR/libloro_core.a"
else
  xcrun lipo -create "${LORO_LIBRARIES[@]}" -output "$BUILT_PRODUCTS_DIR/libloro_core.a"
fi
