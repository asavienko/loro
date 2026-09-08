# Authoritative Rust maths and parity-backed bindings

- **Requirement IDs:** `F-04`, `LB-03`, `LB-21`, `LB-24`, `P3-02`, `P3-04`, `P3-30`…`P3-40`,
  `P3B-01`…`P3B-08`
- **Milestone:** M1/M2
- **Status:** 🟡 Canonical Rust FSRS, ranking, Unicode matching, cloze/selection and mobile bindings
  are implemented with reference/parity checks. Broader device-floor and policy acceptance remains;
  DSP and production speech measurements are separate gates.
- **Depends on:** 53 completed; 58 only for native integration; 87 supplies existing language/course
  identities.
- **Reviewed:** 2026-09-08 during plan-94 integration; release gates below remain explicit.

## Implemented scope

`packages/core-rs` now owns scheduling, ranking, cloze/set selection, Unicode token matching, HLC
and sync merge. The mobile facade calls the same generated Rust dispatcher through native UniFFI or
embedded browser WASM; no approximate JavaScript fallback computes learner scheduling.

Reference scheduling vectors and multilingual fixtures exercise the native and shipped-WASM
boundaries. The selected FSRS policy and exact reference version live in
[scheduling](../docs/architecture/scheduling.md). Bindings are generated, committed and
drift-checked; `jsCoreFacade` is only a compatibility name for the canonical boundary.

## Outcome

Rust is the single implementation of learner-visible ranking, FSRS scheduling, cloze selection,
priority set selection, token matching, and shared deterministic units. TypeScript contains typed
ports and parity fixtures, never a second algorithm or fabricated fallback.

## Remaining work

1. [ ] Extend deterministic histories/simulations and measured device-floor budgets as new engines
       and selection policies land. Preserve official reference and native/WASM parity fixtures.
2. [ ] Complete multilingual cloze/selection acceptance with bilingual reviewers; canonical
       deterministic behavior does not itself approve linguistic content.
3. [ ] Verify full iOS/device bridge execution with plan 58. Keep missing runtime artifacts fatal
       and recoverable rather than substituting a second algorithm.
4. [ ] Feed future Review/Memory and experiment surfaces with the same canonical outputs and
       explicitly reviewed policy changes. DSP scoring remains in plan 77.

## Acceptance criteria

- No learner-visible number owned by ADR-0002 is computed in two production languages.
- Official/reference vectors and native/WASM/TS boundary parity pass in CI.
- All bindings are generated, committed, and drift-checked.
- Current screen behavior changes only to the verified canonical result and E2E expectations explain
  any intended product difference.

## Out of scope

DSP scoring, UI curves, live sync merge changes, and experiment analysis.
