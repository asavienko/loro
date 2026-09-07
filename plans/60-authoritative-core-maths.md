# Authoritative Rust maths and parity-backed bindings

- **Requirement IDs:** `F-04`, `LB-03`, `LB-21`, `LB-24`, `P3-02`, `P3-04`, `P3-30`…`P3-40`,
  `P3B-01`…`P3B-08`
- **Milestone:** M1/M2
- **Status:** 🟡 Canonical FSRS-6, Unicode matching, selection, HLC, full-state engine recording,
  generated native bindings and browser adapters implemented. Android bridge and scheduler
  persistence are verified; iOS and broader parity/latency proof remain with plan 58; reviewed
  lexical cloze metadata and goal/level ranking policy remain explicit content/product gates. No
  fabricated algorithm fallback remains.
- **Depends on:** 53 completed; existing 87 language identities; 58 native bridge only; 59 only for
  durable integration, not pure functions or reference tests.
- **Implementation review:** 2026-09-07, based on `3a24e99`; evidence and remaining gates below.

## Outcome and ownership

Rust owns the canonical scheduler, rank, token matching and selection results. TypeScript supplies
typed inputs and renders results; it must not fabricate a replacement when a binding is unavailable.
Plan 59 persists complete results and checkpoints, 64 owns production wave transitions, 63 owns
recognition/latency measurement, and 75 owns Review/Memory screens. This plan does not enable speech
or claim its accuracy from token-matching fixtures.

## Starting point before this implementation

| Evidence                                                                                                                                             | Required correction                                                                                     |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `core-rs/src/fsrs/mod.rs::review`, `select.rs::cloze_mask` and `select_refrain_set` are `todo!()`                                                    | Implement and verify before exporting into production; a panic is not a fallback                        |
| `mobile/src/store/coreFacade.ts` fabricates intervals, blanks token `[1]`, duplicates rank and strips Cyrillic                                       | Replace each call path with a tested canonical adapter                                                  |
| `core/src/engines/refrain/index.ts::fsrsWriteFor` fabricates the same intervals independently                                                        | Changing the app facade alone will not fix the live Refrain path                                        |
| `PracticeEngine.record(session, attempt)` has no core/context or current phrase state; `clozeMask` takes only a phrase ID                            | Define explicit collaborators and data inputs before implementing adapters                              |
| Domain `FsrsState` and SQLite carry six fields; `ProgressDelta.srs` carries only stability/difficulty/due; mobile `nextSrs` retains old lapses/state | Return and apply complete canonical state; Rust `FsrsState` also needs an explicit card-state mapping   |
| Rust ASR preserves Cyrillic but uses a small accent map and byte-length fuzzy threshold; app/test matchers disagree on empty targets                 | Verify normalization, index bounds and multilingual parity rather than treating Rust as already correct |
| WASM exports only `merge_row`, built with `--target nodejs`; no native consumer exists                                                               | Add a browser-compatible build/init path and native bridge without breaking API merge packaging         |

`core/` and `core-rs/` paths above are under `packages/`; `mobile/` is under `apps/`. Existing
automaticity/set-size helpers and Refrain selection also run in TypeScript. The calendar TS mirror
has shared parity fixtures today; retain that documented boundary until its canonical adapter is
proven. Inventory these call sites before claiming the whole app uses one implementation.

## Decisions and handoffs before scheduler activation

- **FSRS reference and model policy — tech lead + product:** pin the algorithm version, source
  revision/license, parameter vector, retention target, elapsed-day/rounding rules and learning
  steps. The repository selects FSRS but does not pin these. Separate reference parity from Loro's
  declared-difficulty priors, confidence bonus and implicit-grade policy; test adaptations
  explicitly.
- **Curve consistency:** the blueprint (`Loro.dc.html:3018–3043`) and existing `retrievability` use
  `0.5^(t/S)`; ADR-0004 also describes an exponential canonical curve. The
  [maintainers' algorithm reference](https://github.com/open-spaced-repetition/awesome-fsrs/wiki/The-Algorithm)
  defines stability at 90% recall and specifies a power curve for FSRS 4–6 (checked 2026-09-07).
  Choosing a 50% retention target does not turn that curve into the prototype's exponential. Record
  the resolution in ADR-0004/scheduling and the intended Memory-screen contract before activation;
  leave authored artifacts unchanged. Matching, rank and transport work need not wait for this.
- **State/history handoff to 59:** define the full scheduler output, card-state mapping, minimal
  scalar review event, stable attempt ID and algorithm/parameter provenance. SQL already has
  `srs_last_review`, `srs_lapses` and `srs_state`; review-log storage is still missing. Plan 60 owns
  semantics and result/delta/merge contracts; 59 owns required forward migrations and atomic writes.
  Preserve the six-field `latest-review` group when extending wire contracts.
- **Existing fabricated state:** define an explicit conversion/invalidation policy that preserves
  learner phrases and observed progress. Do not label old intervals as canonical, infer their
  provenance from matching numeric values, or invent review history. Persist provenance through 59
  when needed; no blanket reset of a learner's course.

## Implementation sequence

### 1. Explicit core and engine contracts — ready now

- [x] Inventory Rust/TS functions and production consumers, including `fsrsWriteFor`, rank, repeat
      targets, automaticity, set size/modes and store-level set selection. Record each migration
      slice and any existing parity-backed boundary. Test fakes stay in test-only modules.
- [x] Make recording receive the injected core and the correct current course/phrase state through
      an explicit port/context. Keep `engine.record(...) → ProgressDelta → applyDelta`; never import
      the store into an engine or serialize service objects into a resumable session. Coordinate
      revision/attempt identity with plan 59 so stale asynchronous results cannot overwrite newer
      state.
- [x] Define data-only function inputs: content/tokens and target locale for cloze, eligible
      candidates and stable IDs for selection, complete prior state and measured/explicit evidence
      for grading. Rust does no catalog lookup or I/O. Pass time/day and deterministic seed
      explicitly.
- [x] Specify safe integer/time conversions, numeric precision, finite-value validation, null
      semantics, error mapping and tie-breaking across TS/WASM/UniFFI. Reference float tolerances
      must be stated; IDs, masks, grades, card states and emitted due timestamps must agree exactly.

### 2. Canonical matching and existing helpers — ready independently of FSRS

- [x] Define Unicode normalization for es-ES/bg-BG/ru-RU, preserving distinct letters and original
      token indices. Test composed/decomposed `ñ`, Cyrillic `й`/`ё`, stress marks, punctuation-only
      tokens, repeated words, insertions and order. Record locale-specific equivalences; do not
      apply Spanish accent stripping indiscriminately to other languages or enable fuzzy matching by
      default.
- [x] Define empty/invalid-target and out-of-range `revealed` behavior. Empty or fully stripped
      targets must not complete; valid progress is monotonic and bounded by target length. If
      retaining fuzzy mode, measure its threshold in the declared character unit, not UTF-8 byte
      length.
- [x] Export matching/rank through the required generated interfaces and wire their actual web
      consumers with parity tests. Preserve `isActive`/`isDue` eligibility and existing due-rank
      behavior; native proof lands after 58. Plan 90 adds English when its locale/content contract
      exists.
- [x] Expose the existing Rust HLC through a typed port with a restart-state contract for plan 59.
      Verify monotonic generation after reload/backward wall-clock movement and safe timestamp
      serialization. Reuse the implemented HLC algorithm; 59 persists its state and 68 owns remote
      clock observation during sync. This slice can ship independently of FSRS and set selection.

### 3. Reference-backed scheduler — after the model policy is recorded

- [x] Implement initialization/review/retrievability and real interval output against the pinned
      reference. Add cited reference vectors for all grades, first/same-day reviews, relearning,
      lapses, long gaps, re-rating and invalid/backward time. Test Loro adaptations separately.
- [x] Return complete state through `ProgressDelta.srs`; remove `nextSrs`'s carried-forward lapse/
      card-state approximation. Put grade mapping in the canonical core. Skips and passive listening
      are not reviews; manual confirmation cannot supply measured latency, ASR success or DSP
      evidence.
- [x] Replace both fabricated scheduling sites only once the real recording path passes integration
      tests. An unavailable/failed core exposes a truthful unavailable/degraded state for dependent
      behavior, without fabricated writes or claiming every progress signal was updated.
- [x] Exercise the agreed old-state policy and hand results/events to 59 for atomic persistence.
      Pure scheduler completion and durable/native integration must have separate status evidence.

### 4. Cloze and priority selection — after input contracts

- [ ] Pass target text/tokens and reviewed function-word/content metadata to cloze; define short,
      unknown/user-authored and no-eligible-token behavior. Every index must refer to the displayed
      token sequence. A phrase ID alone cannot support a pure Rust implementation.
- [x] Port priority selection with active/due/graduated eligibility, existing trip-priority inputs,
      deterministic ties, tag filters, goal/level inputs and course isolation. Document any
      unresolved goal/level policy instead of inventing weights. Do not implement trip semantics or
      Run here.
- [x] Route both Refrain engine planning and the store's frozen-set/backfill calls through the same
      selection contract. Plan 59 saves selected IDs; plan 64 owns when a set/wave changes. Resume
      must not reselect a frozen day. Cover empty pools, exhausted/graduated pools and deleted
      members.
- [x] Replace duplicate deterministic automaticity/set-size/mode calculations in coherent slices;
      keep presentation/copy in TypeScript. Tighten conformance exemptions only when real evidence
      supports the signal; do not turn manual taps into simulated speech or DSP progression.

### 5. Platform completion and simulation

- [ ] Provide browser WASM loading/readiness/failure handling and a production bundle smoke test;
      preserve the API's Node WASM merge export. Through 58, wire generated Swift/Kotlin to typed
      native ports and verify real bridge calls. Batch hot paths where needed and measure existing
      budgets.
- [ ] Regenerate committed bindings through the generator; check drift and serialized round trips.
      Delete remaining replaced production TS algorithms only after each consumer passes parity.
- [x] Add `packages/core-rs/tests/sim.rs` and its reproducible seed/history fixtures; run
      `cargo test --release --test sim -- --nocapture`. The current nightly workflow names this
      missing target. Coordinate its invocation with ongoing local-CI work; scheduler coverage must
      remain runnable without a GitHub schedule. Offline sync simulation stays with 68.
- [x] Simulate 365 days with bounded finite results, deterministic replay, due ordering, day
      boundaries, review-cap/overflow policy and lapses. Assert monotonicity only for signals that
      promise it; a failed review can legitimately shorten an interval. Simulation is not evidence
      of pedagogical effectiveness or real speech accuracy.

## Acceptance and verification

- Reference vectors plus explicit adaptation fixtures pass; the displayed curve and interval use the
  selected model and real state. No production path retains fabricated FSRS or fixed `[1]` masks.
- Recording uses the correct prior state and preserves the complete scheduler group through delta,
  adapter and SQLite round trips. Replayed/stale attempts are covered with plan 59's transaction
  tests.
- Host/browser/native fixtures cover the supported scripts and boundary failures. Unavailable native
  infrastructure leaves that slice partial; host or browser success cannot stand in for device
  proof.
- Run `pnpm check`, focused Rust/reference/parity/simulation tests, generated-output checks, and
  `pnpm test:e2e` plus production bundle checks when wiring the app. Register new learner failure/
  readiness states in the E2E manifest. Explain changed expectations with the canonical result.

## Out of scope

DSP scoring/axes, speech capture, UI curves/screens, live sync transport or merge-algorithm changes,
trip policy, experiment analysis, parameter optimization and activation of gated practice loops.

## Delivered evidence and remaining gates — 2026-09-07

- [FSRS policy](../docs/architecture/fsrs-model.md) and ADR-0004 pin FSRS-6 defaults,
  source/license, 50% desired retention, power curve, lifecycle and explicit legacy conversion.
  Foreign versioned state fails safely. Full state and review provenance survive SQLite; rerating
  preserves history.
- Rust reference fixtures, a deterministic 365-day simulation, Node/browser transport parity, and
  real WASM facade tests exercise canonical results. Production selection/order/mode/automaticity
  duplicates moved into test fixtures. Manual confirmation never supplies DSP scores or speech
  evidence; no fixed-mask fallback exists.
- Cloze accepts reviewed eligible-token indexes. Current catalogs do not supply that metadata, so
  the displayed text stays intact. Supplying reviewed metadata remains with content review; no
  guessed function-word list is substituted. Goal/level weights likewise need a product policy.
- Generated Swift/Kotlin and a local Expo bridge exist. Android bridge/bootstrap and scheduler
  persistence are verified. Broader fixture parity, cold-start/hot-path timing and iOS runtime
  acceptance remain unverified; browser and host tests are not substitutes. The unchecked platform
  items above retain those acceptance obligations.

Final integration verification: all 148 Rust tests passed, including the 365-day simulation, which
also passed independently in release mode (seed 104837470900225, 191 reviews, four overflow days).
Node/browser transport parity, `pnpm check` (23 tasks), 138 browser E2E tests and four production
bundle smoke tests passed. The Android restart proof compared the complete persisted scheduler state
with Node WASM for the same prior state, grade and timestamp.
