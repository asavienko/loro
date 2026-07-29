# 0014 · One repo, pnpm workspaces + Turborepo

- **Status:** Accepted
- **Date:** 2026-07-28
- **Deciders:** Tech lead

## Context

Loro is five buildable things plus documentation:

| Artifact                 | Language                     | Consumes                                      |
| ------------------------ | ---------------------------- | --------------------------------------------- |
| `apps/mobile`            | TypeScript + Swift + Kotlin  | `core`, `design-tokens`, `content`, `core-rs` |
| `apps/api`               | TypeScript                   | `core`, `core-rs` (WASM), `content`           |
| `packages/core`          | TypeScript                   | `core-rs` types                               |
| `packages/core-rs`       | Rust                         | —                                             |
| `packages/design-tokens` | TypeScript → TS/Swift/Kotlin | —                                             |
| `packages/content`       | JSON + validation            | —                                             |

The dependency edges that matter:

- **`packages/core` is shared by the app and the API.** Domain types, engine contracts, Zod schemas
  for every endpoint, and the sync merge-class policy. This is the whole reason we chose React
  Native ([ADR-0001](0001-cross-platform-react-native-expo.md)) — a wire protocol defined once.
- **`packages/core-rs` is consumed by three targets**: iOS static lib, Android `.so`, and WASM for
  Node ([ADR-0002](0002-shared-rust-core.md)).
- **`packages/design-tokens` generates for four targets**: the app, both widget targets, and the
  docs ([ADR-0013](0013-design-tokens-pipeline.md)).

A change to the sync contract must break the app's build and the API's build in the same PR. That's
the property we're optimising for.

## Options considered

### A · Separate repos with published packages

**Pros** Independent versioning; clear ownership; smaller checkouts. **Cons**

- A sync-contract change becomes: publish `core`, bump in the app, bump in the API, three PRs, and a
  window in which they disagree. **The window is where data-loss bugs live.**
- Cross-repo atomic changes are impossible, so the client and server can be out of step in CI while
  being in step in the developer's head.
- Version-skew debugging becomes a routine cost.

### B · One repo, npm/yarn workspaces, no task orchestrator

**Pros** Atomic changes; no extra tooling. **Cons** Every CI run builds and tests everything. With a
Rust crate compiling for four targets, that is several minutes of waste per PR, and slow CI erodes
the discipline that makes the gates useful.

### C · One repo, pnpm workspaces + Turborepo

**Pros**

- **Atomic cross-package changes.** One PR changes the schema, the client, and the server, and CI
  proves all three agree.
- pnpm's content-addressed store and strict `node_modules` catch phantom dependencies — a package
  that imports something it doesn't declare fails, rather than working by accident until it doesn't.
  (This one did not survive contact with Metro — see the amendment at the end.)
- Turborepo's task graph plus caching means a docs-only PR runs no builds, and a `core-rs` change
  runs everything downstream.
- Remote caching makes CI fast for the common case.

**Cons** Two tools to learn; cache invalidation needs correct `inputs` declarations; Rust sits
outside the JS graph and needs wiring in.

## Decision

**One repo, pnpm workspaces + Turborepo.** Node 22 LTS, pnpm 9, pinned via `packageManager` and
`.nvmrc`.

```
pnpm-workspace.yaml     apps/*, packages/*
turbo.json              the task graph
tsconfig.base.json      strict, path aliases per package
eslint.config.mjs       flat config, incl. the layer-boundary rule
```

### The task graph

```jsonc
{
  "tasks": {
    "core-rs:build": {
      "inputs": ["packages/core-rs/**"],
      "outputs": ["packages/core-rs/target/**", "packages/core-rs/bindings/**"],
      "cache": true,
    },
    "tokens:build": {
      "inputs": ["packages/design-tokens/tokens/**", "packages/design-tokens/src/**"],
      "outputs": ["packages/design-tokens/out/**"],
    },
    "content:validate": { "inputs": ["packages/content/**"] },
    "build": { "dependsOn": ["^build", "core-rs:build", "tokens:build"] },
    "bundle": { "dependsOn": ["tokens:build"], "outputs": [".expo-export/**"] },
    "typecheck": { "dependsOn": ["^build"] },
    "test": { "dependsOn": ["^build"] },
    "lint": {},
    "check:a11y": {},
    "check:contrast": { "dependsOn": ["tokens:build"] },
  },
}
```

`check` is a root npm script rather than a Turborepo task, because it fans out across packages
rather than running per-package:

```jsonc
"check": "turbo run lint typecheck test content:validate check:a11y check:contrast"
```

The accessibility and contrast gates are in that list deliberately. They started as CI-only jobs,
and a regression sat in `main` unnoticed for exactly as long as that was true.

`pnpm check` is the one command a contributor runs, locally and in CI
([`process/onboarding.md`](../../process/onboarding.md)).

### Rust in the graph

`core-rs:build` is a Turborepo task wrapping `cargo` and `uniffi-bindgen`, with
`packages/core-rs/**` as its inputs and the generated bindings as its outputs. So:

- A Rust change invalidates the app and API builds automatically.
- A TypeScript-only change reuses the cached Rust artifacts — which is what keeps PR CI at minutes
  rather than tens of minutes.
- Cargo's own incremental build sits inside, cached by CI as well.

### Two CI rules worth stating

1. **Generated output is committed and drift-checked.** `design-tokens/out/` and the UniFFI bindings
   are in the repo (the native widget targets and Xcode/Gradle builds need them without running the
   JS toolchain), and CI regenerates and fails on any difference. A hand-edited generated file
   cannot merge.
2. **The layer-boundary lint rule is a build gate.** The mobile app's layering
   ([mobile-app.md](../mobile-app.md#layers)) is enforced by `no-restricted-imports`, not by
   convention.

## Consequences

### Good

- **A sync-contract change is one atomic PR** whose CI proves the app and API agree. This is the
  property that made a monorepo worth choosing.
- One `pnpm check`; one onboarding path; one CI configuration.
- Turborepo caching keeps PR CI proportional to the change — docs PRs are seconds, Rust PRs are
  minutes.
- ~~pnpm's strictness prevents phantom dependencies, which in a workspace this shaped would
  otherwise appear constantly.~~ Withdrawn — see the amendment.
- The Rust crate participates in the graph rather than being a side quest in a separate CI job.

### Bad — accepted deliberately

- A larger checkout, and mobile developers have the API in their tree. Minor.
- Turborepo cache correctness depends on accurate `inputs`. A wrong declaration produces a stale
  build, which is a confusing failure. Mitigated by keeping the task list short and reviewing
  `turbo.json` changes carefully.
- Rust and native toolchains are required for a full local build, which makes first-time setup
  heavier. Mitigated by `scripts/bootstrap.sh` and by publishing prebuilt `core-rs` artifacts so a
  UI-only contributor can skip the Rust toolchain.
- Committed generated files add diff noise. Accepted for the native-target reason above; the drift
  check is what makes it safe.

### Revisit if…

- The repo grows a genuinely independent product (a web app, a marketing site) with its own release
  cadence and no shared contract. Those can live outside without losing anything.
- CI times grow past ~10 minutes for a typical PR even with caching, which would suggest splitting
  the Rust crate into its own repo with published artifacts — at the cost of the atomic-change
  property, so only if the pain is real.

---

## Amendment — 2026-07-28 · `node-linker=hoisted`

**What changed.** `.npmrc` sets `node-linker=hoisted`. pnpm's default isolated layout is no longer
in use.

**Why.** Metro cannot resolve through it. React Native's resolver walks `node_modules` directories
rather than following pnpm's symlink graph, so transitive dependencies of Expo packages
(`whatwg-fetch` via `@expo/metro-runtime`, among others) are unresolvable at bundle time. This is
not a configuration mistake to be worked around — `expo export` fails outright, so the app cannot
ship. Verified both ways: `isolated` fails, `hoisted` bundles.

**What this costs.** The phantom-dependency guarantee listed as a pro above. A package can now
import something it never declared and it will work — until that dependency is removed elsewhere, or
the package is consumed somewhere the hoist differs. That is a real regression in a workspace this
shaped, and it is the price of shipping a React Native app from a pnpm monorepo.

**What replaces it.**

- `pnpm typecheck` — an undeclared import resolves to no types, so the build fails. This catches the
  common case, but not a JS-only dependency or one that happens to ship types anyway.
- The `bundle` CI job — `expo export` plus an `esbuild` API build, so resolution is exercised on
  every PR rather than discovered at release time.
- Dependency review on PRs, which is a human process and should be treated as the weakest link.

**Revisit if…** Metro gains symlink-graph resolution (it has been discussed upstream for years), or
the mobile app moves to a bundler that already handles it. At that point, flipping back to
`isolated` is a one-line change plus whatever phantom dependencies have accumulated in the interim —
which is exactly the debt this amendment is recording.

Two other decisions follow from consuming workspace packages as TypeScript source rather than built
output (package `exports` point at `src/*.ts`):

- `apps/api` sets no `rootDir`. Its program legitimately spans `packages/**`, so any `rootDir` under
  `apps/api` rejects it. `tsc` is typecheck-only there; `esbuild` produces `dist/main.js`.
- `@loro/core-rs` lists its WASM files individually in `files`. npm's packer does not descend into a
  directory containing its own `package.json`, and `wasm-pack` writes one into `pkg/` — so
  `files: ["pkg"]` ships an empty directory and the API image boots with no merge engine. The
  readiness endpoint now reports the real state, and production refuses to start without it.
