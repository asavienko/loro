#!/usr/bin/env bash
# Build loro-core for every target that consumes it.
#
# Host + WASM by default (that's what CI and TypeScript tests need).
# Pass --mobile to also build the iOS and Android targets.
#
# See docs/architecture/adr/0002-shared-rust-core.md

set -euo pipefail
cd "$(dirname "$0")"

MOBILE=false
[[ "${1:-}" == "--mobile" ]] && MOBILE=true

echo "── host ──"
cargo build --release

echo "── wasm (for apps/api — the server runs the SAME merge as the client) ──"
# Not optional, and not silently skippable. apps/api resolves `@loro/core-rs/wasm` at boot
# and /v1/health/ready answers 503 without it. Skipping quietly is exactly how CI went green
# here with no pkg/, then failed two jobs later on a 503 that pointed at the API rather than
# at the build that never produced the file. Opt out explicitly or not at all.
if command -v wasm-pack >/dev/null 2>&1; then
  wasm-pack build --target nodejs --out-dir pkg
elif [[ "${LORO_SKIP_WASM:-}" == "1" ]]; then
  echo "  wasm-pack not found; LORO_SKIP_WASM=1 set — skipping."
  echo "  apps/api built from this tree will report merge: unavailable."
else
  echo "  wasm-pack not found, and apps/api's merge path is built from it." >&2
  echo "    install:            cargo install wasm-pack --locked" >&2
  echo "    or skip on purpose: LORO_SKIP_WASM=1 pnpm core-rs:build" >&2
  exit 1
fi

echo "── UniFFI bindings (Swift + Kotlin) ──"
LIB_EXT="so"
[[ "$(uname)" == "Darwin" ]] && LIB_EXT="dylib"
if [[ -f "target/release/libloro_core.${LIB_EXT}" ]]; then
  cargo run --release --bin uniffi-bindgen -- generate \
    --library "target/release/libloro_core.${LIB_EXT}" \
    --language swift --language kotlin \
    --out-dir bindings
else
  echo "  Shared library not found; skipping binding generation."
fi

if [[ "$MOBILE" == true ]]; then
  echo "── iOS ──"
  for target in aarch64-apple-ios aarch64-apple-ios-sim; do
    cargo build --release --target "$target"
  done

  echo "── Android ──"
  if command -v cargo-ndk >/dev/null 2>&1; then
    cargo ndk -t arm64-v8a -t armeabi-v7a -t x86_64 \
      -o ../../apps/mobile/android/app/src/main/jniLibs build --release
  else
    echo "  cargo-ndk not found. Install it with: cargo install cargo-ndk"
  fi
fi

echo
echo "Done."
echo "NOTE: bindings/ and out/ are COMMITTED and drift-checked in CI."
echo "      If they changed, commit the result — don't hand-edit them."
