# loro-core (`@loro/core-rs`)

The Rust crate for every number that must be identical wherever it is computed: on iOS, Android, the
web and the server. Rationale: [ADR-0002](../../docs/architecture/adr/0002-shared-rust-core.md).

## Who calls it

Everything crosses one JSON boundary, `core_call(method, inputJson) -> outputJson`
(`src/bridge.rs`), which decodes the input and calls the owning module.

| Caller               | Methods                          | How it is reached                                                                                                                                   |
| -------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| The app (FSRS)       | `fsrs_initialize`, `fsrs_review` | `apps/mobile/src/shared/core/fsrs.ts`: the committed `browser/` build on the web and in unit tests, the `LoroCore` native module on iOS and Android |
| The API (`/v1/sync`) | `merge_row`, `hlc_clamp`         | `apps/api/src/sync/merge.ts` loads `@loro/core-rs/wasm` (`pkg/`); `/v1/health/ready` answers 503 without it                                         |

The FSRS policy (FSRS-6, 50% desired retention, the learning step, difficulty priors) is in
[the FSRS model](../../docs/architecture/fsrs-model.md). The app's own progress merge is TypeScript
(`apps/mobile/src/shared/state/merge.ts`); the Rust merge serves only the older HLC sync API
([sync protocol](../../docs/architecture/sync-protocol.md)).

## Modules

```
src/
├── lib.rs        # shared FFI types, UniFFI scaffolding, the wasm-bindgen surface
├── bridge.rs     # core_call: the one JSON dispatch for WASM and the native module
├── fsrs/         # FSRS-6 scheduler, grade mapping, interval formatting
├── sync/         # hlc.rs (hybrid logical clock), merge.rs (merge_row, five merge classes)
├── calendar.rs   # local day, streak grace, timezone travel
├── rank.rs  select.rs  ladder.rs  graph.rs  asr.rs  notify.rs  dsp/
├── rng.rs        # internal: the seeded LCG, the crate's only randomness
├── units.rs      # internal: time constants
└── bin/uniffi-bindgen.rs
```

`rank`, `select`, `ladder`, `graph`, `asr`, `notify` and `calendar` were written for the first app
and stay tested, but nothing in the current app or API calls them. `dsp/` is a skeleton:
`score_take` is a placeholder and no score from it reaches a learner.

## Build outputs

| Directory   | What                                                                       | Committed | Checked by                                         |
| ----------- | -------------------------------------------------------------------------- | --------- | -------------------------------------------------- |
| `pkg/`      | wasm-pack's Node.js build, loaded by the API                               | no        | the API's readiness check                          |
| `browser/`  | a self-contained module with the WASM bytes inlined, for the app and tests | yes       | `pnpm check` (`check:browser`, a source digest)    |
| `bindings/` | Swift and Kotlin UniFFI bindings for the `LoroCore` module                 | yes       | `pnpm check` (`check:uniffi`, regenerate-and-diff) |

`browser/manifest.json` records a digest of `Cargo.toml`, `Cargo.lock` and every `src/**/*.rs`, so
any Rust change fails `pnpm check` until `pnpm core-rs:build` has rebuilt `browser/`. Commit the
regenerated `browser/` and `bindings/`; never hand-edit them. The native libraries themselves are
built by the app's module
([`apps/mobile/modules/loro-core`](../../apps/mobile/modules/loro-core/README.md)).

## Build and test

Needs Rust 1.88 or later, `wasm-pack` and the `wasm32-unknown-unknown` target. `cargo` lives in
`~/.cargo/bin`; put it on the `PATH` before running `pnpm`. The `pnpm` lines run from the repository
root, the rest from `packages/core-rs`.

```bash
pnpm core-rs:build                      # host library, pkg/, browser/ and bindings/
./build.sh --mobile                     # also the iOS and Android targets
pnpm core-rs:test                       # cargo test --all-features
cargo test --test fsrs_parity           # FSRS reference vectors (tests/fixtures/)
cargo test --test parity                # fixtures shared with packages/core/src/domain/
cargo test --test sim                   # a deterministic year of reviews
pnpm --filter @loro/core-rs lint        # clippy -D warnings and cargo fmt --check
cargo bench                             # Criterion: rank, asr, ladder, notify
```

`LORO_SKIP_WASM=1` lets `build.sh` skip `pkg/` on purpose; an API built from that tree has no merge.
`pnpm ci:local` runs short benchmarks but does not gate on them, and `pnpm ci:local:native` builds
the iOS, Android and WASM targets.

## Rules

1. No I/O, no networking, no persistence: pure functions over passed-in state.
2. No ambient nondeterminism: the clock and the RNG seed are parameters, so a bug reproduces from a
   state and a seed.
3. No `unsafe` (`#![forbid(unsafe_code)]`).
4. Every public function is unit-, reference-, parity- or property-tested; a placeholder is
   documented as one and never bound into a production path.
5. A moved reference value is explained in the PR, never re-baselined silently.
6. Learner audio never enters a fixture or any other repository path
   ([ADR-0011](../../docs/architecture/adr/0011-analytics-and-privacy.md)).

To add a calculation: define its input, output and units, add reference or parity vectors, implement
it in its module, dispatch it from `bridge.rs`, rebuild, and call it from the app without a
fallback.
