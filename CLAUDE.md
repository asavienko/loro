# CLAUDE.md

Guidance for Claude Code working in this repository.

## What this is

**Loro** — a mobile app (iOS + Android) that teaches Spanish by the phrase.

Early implementation. **What exists:** the docs, 8 of the blueprint's 21 screens in
`apps/mobile/app/`, an API with 10 endpoints over an in-memory store, the Rust core, the design
tokens, and a 31-phrase catalog. 249 tests pass. **What doesn't:** the native modules (audio,
speech, ASR, widgets), persistence, and the other 13 screens — so nothing runnable today exercises
audio or the microphone, which is half of what this app is.

## Keep this file current

This file is loaded into context on every session, so a stale line here misleads every session that
follows. When you find it wrong — or make it wrong — fix it in the same change, the same way a doc
that disagrees with the blueprint gets fixed.

Update it when the state above changes (screens land, native modules appear, persistence is wired),
when a command in **Running and testing** stops being true, when a path in **Where things live**
moves, when a convention or non-negotiable changes, or when an open question is resolved.

Keep it short. Long-form belongs in `docs/`; this file points at it.

## Read these first

- [`README.md`](README.md) — orientation and the reading order
- [`docs/README.md`](docs/README.md) — the full documentation index
- [`docs/architecture/overview.md`](docs/architecture/overview.md) — **the ten rules**

## The design blueprint is the source of truth

```
Language Learning by Phrases/Loro.dc.html    # 3,629 lines: 21 interactive screens + all logic
Language Learning by Phrases/screenshots/    # rendered stills
```

It is an executable spec, not a mockup. Every phone in it is interactive; each screen has a
`DCLogic` class whose `renderVals()` is a complete view model.

- **When a doc and the blueprint disagree, the blueprint wins.** Fix the doc.
- **Don't edit the blueprint.** It's the authored artefact. Intended-design changes go in `docs/`.
- [`docs/design/screen-catalog.md`](docs/design/screen-catalog.md) maps all 21 screens to their line
  ranges, logic classes, screenshots, and specs. Start there when working on a screen.

## The three non-negotiables

A change that violates one of these is reverted, not discussed.

1. **Recorded audio never leaves the device.** The prosody screen prints this promise to the learner
   (`Loro.dc.html:1281`), so it is a technical requirement. PCM stays in native memory and is passed
   to `loro-core` by handle; no JS API returns audio bytes.
   ([ADR-0011](docs/architecture/adr/0011-analytics-and-privacy.md))
2. **Every number shown to a learner is real.** Latency is measured or `null` — never estimated.
   Scores come from real signal processing. No simulated values, not even behind a flag.
   ([learning-model.md](docs/product/learning-model.md#where-the-blueprints-numbers-came-from--and-what-is-real))
3. **No screen shames a missed day.** This constrains the notification scheduler and the widget, not
   just copy. ([copy-and-tone.md](docs/design/copy-and-tone.md))

The blueprint prototypes several numbers with fake data (a seeded PRNG for pronunciation scores at
`3068`/`3079`, a formula for latency at `3377`, a linear contour blend at `3158`). Those are
prototype-only and **must not** be carried into the app — see the divergence table at the end of
[`docs/design/screen-catalog.md`](docs/design/screen-catalog.md).

## Conventions

- **Requirement IDs** (`P2-04`, `LB-25`) from [`docs/product/prd.md`](docs/product/prd.md) go in
  branches, commits, and PRs.
- **Blueprint citations** look like `Loro.dc.html:1404–1538`.
- **Commits**: Conventional Commits with the scope list in `commitlint.config.cjs`. See
  [`docs/process/git-workflow.md`](docs/process/git-workflow.md).
- **Plans live in `plans/`.** One markdown file per plan, at the repo root, kebab-case and named for
  the topic — `plans/association-suggestions.md`. Not in `docs/`: that holds the durable spec, and a
  plan is scaffolding you delete once the work ships. Not in a temp directory either — a plan you
  can't find again is a plan you rewrite. Name the requirement ID inside the plan so it ties back to
  the branch and the PR.
- **`pnpm check`** is the single command that must pass — lint, typecheck, test, content validation.
- **Layer boundaries in the app are lint-enforced**, not conventional
  ([mobile-app.md](docs/architecture/mobile-app.md#layers)). If an import fails lint, you're
  crossing a boundary.
- **No colour literals.** Use design tokens; they encode the accessibility rules (`accentInk` for
  text, never `accent`).
- **Generated files are committed and drift-checked** — `packages/design-tokens/out/` and the UniFFI
  bindings. Never hand-edit them; fix the generator.

## Running and testing

**Use Node 22.** The repo pins it (`.nvmrc`, `engines`), and `pnpm` is installed only under that
version — a shell on any other Node has no `pnpm` at all, which reads as "the repo is broken" rather
than "wrong Node". Run `nvm use 22` first, every time. `cargo` lives in `~/.cargo/bin` and may also
be off PATH.

```bash
pnpm check                          # the gate: 23 turbo tasks, all green today
pnpm --filter @loro/api dev         # :3000 — no Docker, no keys, no database
pnpm --filter @loro/mobile bundle   # proves the app compiles; needs no simulator
npx expo start --web                # from apps/mobile — fastest way to see the screens
```

- **The API needs no Docker.** Persistence isn't wired — the sync store is an in-memory `Map` and AI
  is stubbed (`AI_PROVIDER=stub`), so skip `dev:up` unless you're building the repository layer.
  `/v1/health/ready` returns 503 if the WASM merge is missing, which is the check worth watching.
- **`expo run:ios` / `run:android` need a toolchain that isn't set up here** — full Xcode or the
  Android SDK, plus a first `expo prebuild` (there is no `apps/mobile/ios` or `android/`). Until
  then: web, or Expo Go on a device, which still works only because no custom native module is
  installed yet.
- **A green build proves less than usual.** The five hand-checks in
  [`onboarding.md`](docs/process/onboarding.md) — audio, mic, the warming card, offline, sync — have
  no implementation behind them to check.
- **`packages/core-rs` tests are all inline `#[cfg(test)]`; there is no `tests/` directory yet.**
  The integration files named in [`testing-strategy.md`](docs/process/testing-strategy.md)
  (`sim.rs`, `merge.rs`, `golden/`) don't exist, so don't assume a scheduling or DSP change is
  covered.
- **Two docs run ahead of the code.** `onboarding.md` §3 says to run `db:migrate` / `db:seed`, which
  aren't defined — [`apps/api/README.md`](apps/api/README.md) is the accurate one.
  `apps/mobile/README.md` lists `src/features/`, `src/engines/`, `src/domain/`, `src/data/`,
  `src/platform/`, `modules/`, and `targets/`; only `src/lib/`, `src/store/`, and `src/ui/` exist.

## Where things live

| Path                      | What                                                                      |
| ------------------------- | ------------------------------------------------------------------------- |
| `docs/`                   | All documentation — start at `docs/README.md`                             |
| `apps/mobile/`            | Expo / React Native app; routes in `app/`, design system in `src/ui/`     |
| `apps/api/`               | NestJS backend                                                            |
| `packages/core/`          | Shared TS domain, engine contracts, API schemas — **used by app AND api** |
| `packages/core-rs/`       | Rust: FSRS, sync merge, ranking, DSP. All reproducible maths              |
| `packages/design-tokens/` | Tokens extracted from the blueprint + generators                          |
| `packages/content/`       | The Spanish catalog, schema-validated                                     |

## Things worth knowing before making changes

- **`packages/core-rs` owns every number that must be identical across platforms** — FSRS intervals,
  the sync merge, ranking, DSP scores. Two implementations of the sync merge would diverge and lose
  learner data ([ADR-0002](docs/architecture/adr/0002-shared-rust-core.md)).
- **Every syncable field needs a declared merge class** in `packages/core/src/sync/fieldPolicy.ts`.
  CI fails without one, because a missing class is a silent data-loss bug
  ([sync-protocol.md](docs/architecture/sync-protocol.md)).
- **The practice loop is a plug-in.** Five to seven engines implement one interface, and **every
  engine maintains every progress signal, including ones it doesn't display** (rule 5). Enforced by
  a conformance suite ([practice-engines.md](docs/architecture/practice-engines.md)).
- **Offline-first is not a feature.** The device is the source of truth; every write succeeds
  locally and appends to an outbox. No code path awaits the network
  ([offline.md](docs/architecture/offline.md)).
- **Content ships independently of the app.** A phrase fix needs no release
  ([ADR-0009](docs/architecture/adr/0009-content-pipeline-and-packs.md)).

## Open questions

Unresolved decisions with owners and dates:
[`docs/decisions/open-questions.md`](docs/decisions/open-questions.md). Two are currently blocking:
**Q-05** (who owns the practice-loop decision) and **Q-08** (pricing).

## Python

Per the global instruction: use `uv run python3 ...` and `uv add <pkg>`. Bare `python`/`pip` are
intentionally blocked. There is no Python in this project today; content tooling is TypeScript.
