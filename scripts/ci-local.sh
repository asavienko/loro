#!/usr/bin/env bash
# Local validation only: never dispatch GitHub Actions or publish artifacts.
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="$HOME/.cargo/bin:$PATH"
export CI=1 TURBO_TELEMETRY_DISABLED=1 TURBO_FORCE=true
if [[ -n "${GITHUB_ACTIONS:-}" ]]; then
  echo 'GitHub CI is disabled. Run this script on a local machine.' >&2
  exit 1
fi
if [[ -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]]; then
  source "${NVM_DIR:-$HOME/.nvm}/nvm.sh"
  nvm use 22
fi
[[ "$(node -p 'process.versions.node.split(".")[0]')" == 22 ]] || { echo 'Node 22 is required.' >&2; exit 1; }
mode=${1:-full}
case "$mode" in
  full|native|audit) ;;
  *) echo 'Usage: bash scripts/ci-local.sh [full|native|audit]' >&2; exit 2 ;;
esac
run() { printf '\nLocal CI: %s\n' "$*"; "$@"; }
if [[ "$mode" == audit ]]; then
  run pnpm audit --audit-level=high
  (cd packages/core-rs && run cargo audit)
  exit
fi
if [[ "$mode" == native ]]; then
  [[ "$(uname)" == Darwin ]] || { echo 'The complete native matrix requires macOS and Xcode.' >&2; exit 1; }
  xcrun --sdk iphoneos --show-sdk-path >/dev/null
  command -v cargo-ndk >/dev/null || { echo 'Install cargo-ndk and configure the Android NDK.' >&2; exit 1; }
  cd packages/core-rs
  for target in aarch64-apple-ios aarch64-apple-ios-sim wasm32-unknown-unknown; do
    run cargo build --release --lib --target "$target"
  done
  run cargo ndk -t arm64-v8a -t armeabi-v7a -t x86_64 build --release --lib
  run cargo test --test parity
  exit
fi
command -v wasm-pack >/dev/null || { echo 'Install wasm-pack: cargo install wasm-pack --locked' >&2; exit 1; }
docker info >/dev/null
# The auth suite drops tables; only the isolated PostgreSQL helper may set this URL.
unset AUTH_TEST_DATABASE_URL
run pnpm install --frozen-lockfile
run pnpm core-rs:build
test -f packages/core-rs/pkg/loro_core_bg.wasm
run pnpm tokens:build
run node scripts/ci-expo-routes.mjs
run pnpm check --concurrency="${LORO_CI_CONCURRENCY:-2}"
run bash scripts/ci-auth-postgres.sh
if [[ -f packages/core-rs/tests/golden.rs || -f packages/core-rs/tests/golden/main.rs ]]; then
  (cd packages/core-rs && run cargo test --test golden -- --nocapture)
fi
run pnpm format:check
if [[ -n "${CI_BASE_REF:-}" ]]; then
  run pnpm exec commitlint --from "$CI_BASE_REF" --to HEAD
else
  echo 'Commit range not provided; set CI_BASE_REF to validate branch commits.'
fi
if [[ -n "$(git status --porcelain -- packages/design-tokens/out packages/core-rs/bindings)" ]]; then
  echo 'Generated output differs from Git. Review and commit regenerated output.' >&2
  git status --short -- packages/design-tokens/out packages/core-rs/bindings
  exit 1
fi
run pnpm test:e2e:install
browser() {
  local port
  port=$(node --input-type=module -e 'import { createServer } from "node:net"; const s = createServer(); s.listen(0, "127.0.0.1", () => { console.log(s.address().port); s.close(); });')
  run env LORO_E2E_PORT="$port" pnpm "$1"
}
browser test:e2e
browser test:e2e:workbench
browser test:e2e:bundle
run pnpm --filter @loro/mobile bundle
run pnpm --filter @loro/api build
run node scripts/ci-api-smoke.mjs
(cd packages/core-rs && run cargo bench --bench core_benches -- --warm-up-time 1 --measurement-time 2)
echo 'Local CI passed. Native builds and dependency audits are separate explicit gates.'
