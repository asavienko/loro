# 0002 · Put all reproducible maths in a shared Rust core

- **Status:** Accepted
- **Date:** 2026-07-28
- **Deciders:** Tech lead, mobile lead, backend lead

## Context

Several numbers in Loro must be **identical everywhere they are computed**:

| Number                                                | Computed on                                       | Consequence of divergence                                         |
| ----------------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------- |
| FSRS interval and stability                           | iOS, Android, and the server (for reconciliation) | Two devices disagree about when a card is due                     |
| Sync merge outcome                                    | Client **and** server                             | **Silent data loss** — the two sides converge on different values |
| Pronunciation / prosody scores                        | iOS, Android                                      | The same take scores differently on the learner's two phones      |
| Stream rank, Refrain set selection, the Loop C draw   | iOS, Android                                      | Different practice on different devices                           |
| Notification plan (caps, quiet hours, conditionality) | iOS, Android                                      | Policy violations on one platform only                            |

The sync merge row is the dangerous one. [sync-protocol.md](../sync-protocol.md) resolves conflicts
with per-field HLC comparison and per-field merge classes. If the client's implementation and the
server's implementation of that logic ever disagree by one edge case, a learner loses a rating, a
note, or a rep count — and nobody finds out for months.

The DSP is the expensive one: pitch extraction, MFCC, and DTW over a 2-second buffer, with a 200 ms
budget on the device floor ([prosody-dsp.md](../prosody-dsp.md#performance-budget)).

## Options considered

### A · Implement everything in TypeScript, share via `packages/core`

**Pros**

- One language; no FFI, no build complexity; works in the app and the API for free.
- Fastest to write.

**Cons**

- **Too slow for DSP.** YIN + MFCC + DTW in JS on a mid-range Android device would not fit in 200
  ms, and running it on the JS thread would drop frames during the very animation that shows the
  result.
- Floating-point behaviour is consistent enough in practice, but the DSP would need to be native
  anyway — so we'd end up with two implementations of the scoring maths.

### B · Implement twice — Swift and Kotlin

**Pros**

- Best platform integration; no FFI layer.

**Cons**

- **Two implementations of the sync merge, guaranteed to diverge.** This is precisely the failure
  mode we are trying to make impossible.
- Two implementations of FSRS, of the draw, of the notification policy. Every scheduling change is
  written twice and tested twice.
- Doesn't help the server at all.

### C · Rust core, exposed via UniFFI, compiled to WASM for the server

**Pros**

- **One implementation** of every reproducible number, used by iOS, Android, and the server.
- Fast enough for the DSP with large headroom.
- Deterministic by construction — the crate has no I/O, no clock access, and no RNG except from an
  explicit seed, so it is trivially testable and golden-testable.
- UniFFI generates Swift and Kotlin bindings from an interface definition; no hand-written FFI.
- `wasm-bindgen` gives the Node API the same code path ([backend.md](../backend.md#sync)).

**Cons**

- A third language in the stack.
- Build complexity: two mobile targets plus a WASM target, in CI.
- Debugging across an FFI boundary is harder.
- Rust hiring is narrower.

## Decision

**A Rust crate, `packages/core-rs` (`loro-core`), exposed to Swift and Kotlin via UniFFI and to Node
via `wasm-bindgen`.** It owns:

- FSRS: intervals, stability, difficulty, grade mapping, calibration
- Sync: HLC arithmetic, `merge_row`, merge-class policy application
- Selection: stream rank, Refrain set selection, cloze masking, the Loop C draw
- ASR matching and normalisation
- All DSP: pitch, MFCC, DTW alignment, per-syllable scoring, stress and rhythm
- The notification plan
- Interval and date formatting, day boundaries, streak calculation

It explicitly does **not** own: any I/O, any networking, any persistence, any clock or RNG access
(both are injected).

## Consequences

### Good

- The sync merge cannot diverge between client and server. That single property justifies most of
  the cost of this decision.
- Scores are reproducible across platforms, which makes the golden-test suite in
  [prosody-dsp.md](../prosody-dsp.md#golden-tests-forever) meaningful — a change that moves a score
  is caught in CI, not by a learner.
- The scheduler is unit-testable, including a 365-day simulation, with no simulator or device
  involved ([scheduling.md](../scheduling.md#testing)).
- Criterion benchmarks in CI keep the performance budgets honest.
- Determinism by construction: a bug report can carry a seed and a state, and the exact behaviour
  reproduces.

### Bad — accepted deliberately

- Three languages. Mitigated by keeping the Rust surface narrow and purely functional — most feature
  work never touches it.
- CI must build for `aarch64-apple-ios`, `aarch64-linux-android`, `x86_64-linux-android` (emulator),
  and `wasm32-unknown-unknown`. Set up once, cached, ~4 minutes.
- The UniFFI boundary has a marshalling cost. Measured and budgeted: sub-millisecond functions are
  called synchronously; DSP is async on a native thread
  ([performance.md](../performance.md#loro-core-rust)).
- A Rust panic crosses the boundary as an error and is reported as its own class
  ([observability.md](../observability.md#crash-and-error-reporting)).

### Revisit if…

- The UniFFI marshalling cost turns out to exceed the budget for the hot-path functions
  (`stream_rank` is called per phrase on a 2 000-row library). Fallback: batch the call — pass the
  whole array once rather than per row.
- WASM in Node proves unworkable for the server's merge path. Fallback: run the merge as a native
  Node addon, or move the merge entirely client-side and have the server store opaque rows — a much
  bigger change.
- The DSP turns out to need a trained acoustic model, at which point the crate grows a
  model-inference dependency and the size budget needs revisiting.
