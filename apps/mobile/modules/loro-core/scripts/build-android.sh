#!/usr/bin/env bash
# Gradle supplies its NDK and ABIs, so Rust and the app target the same devices.
set -euo pipefail

LORO_MODULE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LORO_RUST_DIR="$(cd "$LORO_MODULE_DIR/../../../../packages/core-rs" && pwd)"
LORO_OUTPUT="${1:?Pass an absolute jniLibs output directory.}"
LORO_ARCHITECTURES="${2:-arm64-v8a,armeabi-v7a,x86,x86_64}"
export PATH="$HOME/.cargo/bin:$PATH"
export CARGO_TARGET_DIR="$LORO_MODULE_DIR/build/rust-android"

if ! command -v cargo-ndk >/dev/null 2>&1; then
  echo 'LoroCore requires cargo-ndk. Install it with: cargo install cargo-ndk --locked' >&2
  exit 1
fi

IFS=',' read -r -a LORO_ABIS <<< "$LORO_ARCHITECTURES"
LORO_TARGET_ARGS=()
for LORO_ABI in "${LORO_ABIS[@]}"; do
  case "$LORO_ABI" in
    arm64-v8a|armeabi-v7a|x86|x86_64) LORO_TARGET_ARGS+=(-t "$LORO_ABI") ;;
    *) echo "Unsupported LoroCore Android ABI: $LORO_ABI" >&2; exit 1 ;;
  esac
done

# NDK r27 needs this explicit alignment to run on 16 KiB-page Android devices.
export RUSTFLAGS="${RUSTFLAGS:-} -C link-arg=-Wl,-z,max-page-size=16384"
mkdir -p "$LORO_OUTPUT"
cd "$LORO_RUST_DIR"
cargo ndk "${LORO_TARGET_ARGS[@]}" --platform "${LORO_ANDROID_MIN_SDK:-24}" \
  -o "$LORO_OUTPUT" build --lib --release --locked
