# Authoritative Rust maths and parity-backed bindings

- **Requirement IDs:** `F-04`, `LB-03`, `LB-21`, `LB-24`, `P3-02`, `P3-04`, `P3-30`…`P3-40`,
  `P3B-01`…`P3B-08`
- **Milestone:** M1/M2
- **Status:** Not started
- **Depends on:** plan 53 ✅ semantic/context seams; 58 for native integration

## Outcome

Rust is the single implementation of learner-visible ranking, FSRS scheduling, cloze selection,
priority set selection, token matching, and shared deterministic units. TypeScript contains typed
ports and parity fixtures, never a second algorithm or fabricated fallback.

## Work

1. Define canonical inputs/outputs, units, error handling, and deterministic seed/clock injection
   for each function before extending bindings.
2. Implement FSRS against the selected reference version and parameter set; add official/reference
   vectors, calendar-boundary cases, lapse histories, and cross-language parity.
3. Implement cloze and priority set selection with function-word/content rules, eligibility,
   graduation, tag drill, frozen-day, and deterministic tie behavior.
4. Make rank and token matching use the existing Rust implementations everywhere; resolve empty
   target behavior explicitly.
5. Generate UniFFI/WASM bindings and wire the mobile/API adapters. Web uses WASM or a proven parity
   boundary, not `jsCoreFacade` approximations.
6. Delete fake intervals, fixed `[1]` masks, duplicate stream rank formulas, and divergent matcher
   copies only after parity and integration tests pass.
7. Add property/simulation tests for monotonicity, bounded results, deterministic replay, no
   impossible schedules, and all engine progress signals.

## Acceptance criteria

- No learner-visible number owned by ADR-0002 is computed in two production languages.
- Official/reference vectors and native/WASM/TS boundary parity pass in CI.
- All bindings are generated, committed, and drift-checked.
- Current screen behavior changes only to the verified canonical result and E2E expectations explain
  any intended product difference.

## Out of scope

DSP scoring, UI curves, live sync merge changes, and experiment analysis.
