# Developer onboarding

Day one: from an empty machine to a running app on a real device, and a merged PR.

**Target: under a day.** If it takes longer, that's a bug in this document — fix it in your first
PR.

---

## 0 · Before anything: play with the blueprint

```bash
open "Language Learning by Phrases/Loro.dc.html"
```

Spend twenty minutes. Every phone is interactive. Add a phrase, tag it Difficult and Pronunciation,
then open the stream and watch the repeat count change. Do six reps in the Refrain and watch the
card heat up.

**This is the fastest way to understand Loro.** Twenty minutes here beats a day of reading `docs/`.

---

## 1 · Tools

| Tool           | Version | Install                                                                                      |
| -------------- | ------- | -------------------------------------------------------------------------------------------- |
| Node           | 22 LTS  | `nvm install 22` / `fnm install 22` — pinned in `.nvmrc`                                     |
| pnpm           | 9.12    | `npm i -g pnpm@9.12.0` (or `corepack enable`) — pinned via `packageManager`                  |
| Rust           | stable  | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh -s -- -y --profile minimal` |
| wasm-pack      | latest  | `cargo install wasm-pack --locked` — the API runs the same merge as the client               |
| Xcode          | 15+     | App Store. Then `sudo xcode-select --install`                                                |
| Android Studio | latest  | + SDK 34, NDK, an API 34 emulator image                                                      |
| Watchman       | latest  | `brew install watchman`                                                                      |
| Docker         | latest  | For the local API stack                                                                      |
| EAS CLI        | latest  | `pnpm add -g eas-cli`                                                                        |

**Only Node, pnpm, and Rust are needed for `pnpm check` to pass.** Xcode, Android Studio, Docker,
and EAS are for running the app and the API, which no code needs yet.

Rust targets:

```bash
rustup target add aarch64-apple-ios aarch64-apple-ios-sim \
                  aarch64-linux-android armv7-linux-androideabi \
                  x86_64-linux-android wasm32-unknown-unknown
cargo install cargo-ndk wasm-pack
```

> **Version pins here were chosen at authoring time.** Re-verify against the current releases at
> kickoff and update this table in the same PR — a stale onboarding doc is the most annoying kind.

**UI-only contributors can skip Rust.** `pnpm bootstrap --no-rust` fetches prebuilt `loro-core`
artifacts.

---

## 2 · Clone and bootstrap

```bash
git clone <repo> loro && cd loro
pnpm bootstrap
```

`scripts/bootstrap.sh` does, in order:

1. Verifies tool versions and fails loudly with the fix if one is wrong.
2. `pnpm install`
3. `pnpm tokens:build` — generates design tokens
   ([ADR-0013](../architecture/adr/0013-design-tokens-pipeline.md))
4. `pnpm core-rs:build` — builds the Rust core for your host + WASM
5. `pnpm content:validate`
6. Copies `.env.example` → `.env` in both apps
7. Prints what to do next

Then confirm everything is green:

```bash
pnpm check      # lint + typecheck + test + content validation
```

**`pnpm check` is the only command you need to remember.** It's exactly what CI runs.

---

## 3 · Run the API

```bash
pnpm --filter api dev:up        # docker: postgres, redis, minio
pnpm --filter api db:migrate
pnpm --filter api db:seed
pnpm --filter api dev           # http://localhost:3000
curl localhost:3000/v1/health   # {"status":"ok"}
```

The seed reproduces the blueprint's own `LORO_SEED` (`Loro.dc.html:2873–2884`) — 10 phrases with
real difficulties, tags, and rep counts — so every screen has plausible data without tapping through
onboarding.

AI and TTS are stubbed locally (`AI_PROVIDER=stub`), returning the bundled fallback fixtures.
**Local development needs no API keys and works offline.**

---

## 4 · Run the app

### iOS

```bash
pnpm --filter mobile ios          # first run builds the native project — 10–15 min
```

### Android

```bash
pnpm --filter mobile android
```

### On a physical device

Do this on day one. **The simulator lies about audio sessions, microphone behaviour, and
interruptions**, and those are half of what this app does.

```bash
pnpm --filter mobile ios --device
# Android: enable USB debugging, then
pnpm --filter mobile android --device
```

---

## 5 · Verify the things that actually matter

A green build doesn't mean a working app. Check these five by hand:

- [ ] **Audio plays.** Open the stream. Do you hear Spanish?
- [ ] **The mic works.** Open Speak to progress, tap the mic, say the phrase. Do words un-blur?
- [ ] **The warming card animates.** Do six reps in the Refrain. Does the card go blue → cream →
      peach → coral, smoothly?
- [ ] **Offline works.** Airplane mode, force-quit, relaunch. Can you still practise?
- [ ] **Sync works.** Rate a phrase, check the API log for a push.

If any of these fails, stop and ask. Don't start feature work on a broken audio setup — you'll waste
a day debugging your own environment while thinking it's the code.

---

## 6 · Your first PR

Pick something small from the issue tracker labelled `good-first-issue`, or fix something you
tripped over in this document.

```bash
git switch -c feat/P2-04-association-suggestions
# work
pnpm check
git commit -m "feat(add): re-rank suggestions by theme after adding (P2-04)"
git push -u origin HEAD
gh pr create
```

Conventions: [git-workflow.md](git-workflow.md) · Review expectations:
[code-review.md](code-review.md) · Done gates: [definition-of-done.md](definition-of-done.md)

---

## Where things are

```
docs/                  everything written down — start at docs/README.md
apps/mobile/           the app
  app/                 routes (Expo Router)
  src/features/        screens
  src/engines/         practice logic (headless, testable)
  src/domain/          phrases, trips, progress, content
  src/data/            SQLite, repositories, sync
  src/platform/        native bridges
  src/ui/              design system
  modules/             native Expo Modules (audio, speech, core)
  targets/             widget targets
apps/api/              NestJS backend
packages/core/         shared TS domain + contracts  ← app AND api
packages/core-rs/      Rust: scheduler, DSP, sync merge
packages/design-tokens/ tokens + generators
packages/content/      the Spanish catalog
Language Learning by Phrases/  THE BLUEPRINT
```

The layering is enforced by a lint rule, not convention
([`../architecture/mobile-app.md`](../architecture/mobile-app.md#layers)). If an import fails lint,
you're crossing a boundary.

---

## Common problems

| Symptom                             | Fix                                                                                            |
| ----------------------------------- | ---------------------------------------------------------------------------------------------- |
| `loro_core` symbols not found (iOS) | `pnpm core-rs:build && cd apps/mobile/ios && pod install`                                      |
| `libloro_core.so` missing (Android) | `pnpm core-rs:build` — check `cargo-ndk` is installed                                          |
| Metro cache weirdness               | `pnpm --filter mobile start --clear`                                                           |
| Tokens out of date                  | `pnpm tokens:build`. CI fails if `out/` drifts from source                                     |
| Pod install fails                   | `cd apps/mobile/ios && pod repo update && pod install`                                         |
| No audio in the simulator           | Check macOS output device; then test on a real device — the simulator is unreliable here       |
| Mic denied and won't re-prompt      | Reset permissions in device settings, or `xcrun simctl privacy booted reset all`               |
| ASR does nothing on Android         | The offline Spanish language pack isn't installed. Settings → System → Languages → Voice input |
| API can't reach Postgres            | `pnpm --filter api dev:up`; check port 5432 is free                                            |
| Device can't reach `localhost`      | Use your LAN IP in `apps/mobile/.env`, not `localhost`                                         |
| `pnpm check` fails on a clean clone | That's a real bug. Report it — this must always pass                                           |

---

## Reading order

Day 2, in this order (~45 min):

1. [`../product/vision.md`](../product/vision.md) — the bet
2. [`../product/learning-model.md`](../product/learning-model.md) — the pedagogy everything serves
3. [`../architecture/overview.md`](../architecture/overview.md) — the system and **the ten rules**
4. [`../product/practice-loops.md`](../product/practice-loops.md) — why there are three loops
5. [ways-of-working.md](ways-of-working.md) — how we operate

Then, before touching a screen: [`../design/screen-catalog.md`](../design/screen-catalog.md) and
[`../product/functional-spec.md`](../product/functional-spec.md) for that screen.

**The three rules you must internalise before writing code**
([overview](../architecture/overview.md#the-ten-rules)):

1. Recorded audio never leaves the device.
2. Every number shown to a learner is real — no simulated latency, no fake scores, not even behind a
   flag.
3. No screen shames a missed day.

---

## Start dogfooding

Week 2, with a real goal ([ways-of-working.md](ways-of-working.md#dogfooding)). Set a trip if you
have one coming up; otherwise pick a real reason.

You cannot build this product well without doing six reps of the same phrase, every day, for a
month. That's the experience the whole app is designed around, and it either feels alive or it feels
tedious — and you can only tell from the inside.
