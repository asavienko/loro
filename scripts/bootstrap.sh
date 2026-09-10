#!/usr/bin/env bash
# Get a clean clone to the point where `pnpm check` passes.
#
#   pnpm bootstrap              full setup
#   pnpm bootstrap --no-rust    skip the Rust toolchain (UI-only contributors)
#
# See docs/process/onboarding.md

set -euo pipefail
cd "$(dirname "$0")/.."

BOLD=$'\033[1m'; DIM=$'\033[2m'; RED=$'\033[31m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; OFF=$'\033[0m'
step() { printf '\n%s── %s ──%s\n' "$BOLD" "$1" "$OFF"; }
ok()   { printf '  %s✓%s %s\n' "$GREEN" "$OFF" "$1"; }
warn() { printf '  %s!%s %s\n' "$YELLOW" "$OFF" "$1"; }
die()  { printf '\n  %s✗ %s%s\n\n' "$RED" "$1" "$OFF" >&2; exit 1; }

WITH_RUST=true
[[ "${1:-}" == "--no-rust" ]] && WITH_RUST=false

# ─────────────────────────────────────────────────────────────
step "Checking tools"
# ─────────────────────────────────────────────────────────────

command -v node >/dev/null || die "Node not found. Install Node 22: fnm install 22"
NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
[[ "$NODE_MAJOR" == "22" ]] || die "Node 22 required, found $(node -v). Try: fnm use 22"
ok "node $(node -v)"

command -v pnpm >/dev/null || die "pnpm not found. Run: corepack enable && corepack prepare pnpm@9 --activate"
ok "pnpm $(pnpm -v)"

if [[ "$WITH_RUST" == true ]]; then
  command -v cargo >/dev/null || die "Rust not found. Install from https://rustup.rs — or run with --no-rust"
  ok "cargo $(cargo --version | cut -d' ' -f2)"
  rustup target list --installed | grep -q wasm32-unknown-unknown \
    || warn "wasm32 target missing. The API's merge path needs it: rustup target add wasm32-unknown-unknown"
  command -v wasm-pack >/dev/null || warn "wasm-pack missing: cargo install wasm-pack"
else
  warn "Skipping Rust. Using prebuilt loro-core artifacts."
fi

if [[ "$(uname)" == "Darwin" ]]; then
  command -v xcodebuild >/dev/null && ok "xcode $(xcodebuild -version | head -1 | cut -d' ' -f2)" \
    || warn "Xcode not found — you won't be able to build for iOS."
fi
command -v adb >/dev/null && ok "android sdk" || warn "Android SDK not found — you won't be able to build for Android."
command -v docker >/dev/null && ok "docker" || warn "Docker not found — needed for the local API stack."
command -v watchman >/dev/null || warn "watchman missing (recommended): brew install watchman"
command -v gitleaks >/dev/null || warn "gitleaks missing (required to commit): brew install gitleaks"

# ─────────────────────────────────────────────────────────────
step "Installing dependencies"
# ─────────────────────────────────────────────────────────────
pnpm install
ok "installed"

# ─────────────────────────────────────────────────────────────
step "Generating design tokens"
# ─────────────────────────────────────────────────────────────
# out/ is committed and drift-checked in CI, because the native widget targets build
# without the JS toolchain. See ADR-0013.
pnpm tokens:build
ok "packages/design-tokens/out"

# ─────────────────────────────────────────────────────────────
step "Building loro-core"
# ─────────────────────────────────────────────────────────────
if [[ "$WITH_RUST" == true ]]; then
  pnpm core-rs:build
  ok "host + wasm + bindings"
else
  warn "skipped"
fi

# ─────────────────────────────────────────────────────────────
step "Validating content"
# ─────────────────────────────────────────────────────────────
# Expected to report under-populated packs — their promisedCount is the target, and
# validation is what stops us shipping a pack that lies to the learner.
pnpm content:validate || warn "content validation reported issues (expected while packs are being filled)"

# ─────────────────────────────────────────────────────────────
step "Creating env files"
# ─────────────────────────────────────────────────────────────
for app in apps/mobile apps/api; do
  if [[ -f "$app/.env" ]]; then
    ok "$app/.env exists"
  else
    cp "$app/.env.example" "$app/.env"
    ok "$app/.env created from .env.example"
  fi
done

# ─────────────────────────────────────────────────────────────
printf '\n%s─────────────────────────────────────────────%s\n' "$BOLD" "$OFF"
printf '%sReady.%s\n\n' "$BOLD" "$OFF"
cat <<'NEXT'
  Verify everything:            pnpm check

  Start the API:                pnpm --filter api dev:up
                                pnpm --filter api db:migrate
                                pnpm --filter api db:seed
                                pnpm --filter api dev

  Run the app on a device:      pnpm --filter mobile ios --device
                                pnpm --filter mobile android --device

  Then check these FIVE BY HAND — a green build does not mean a working app:
    • audio plays in the stream
    • the mic un-blurs words in Speak to progress
    • the warming card animates smoothly through six reps
    • airplane mode + force-quit + relaunch still lets you practise
    • rating a phrase shows up as a push in the API log

NEXT
printf '  %sAnd spend twenty minutes here first:%s\n' "$DIM" "$OFF"
printf '  %sopen "design/Language Learning by Phrases - V1.1/Loro.dc.html"%s\n\n' "$DIM" "$OFF"
