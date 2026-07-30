# Audit the seven ported screens and app shell against the blueprint

- **Requirement IDs:** `P1-01`…`P1-12`, `P2-01`…`P2-40`, `P3-01`…`P3-12`, `P4-01`…`P4-08`,
  `LB-20`…`LB-32`
- **Milestone:** M1
- **Size:** M
- **Spec:** `docs/design/screen-catalog.md`, `docs/product/functional-spec.md`,
  `docs/process/definition-of-done.md` (the design-fidelity gate)

## What this is

Seven of the blueprint's 21 screens exist: `onboarding`, `add`, `phrase/[id]`, `practice/stream`,
`practice/refrain`, `progress`, and the Today surface at `index`. `_layout` is the app shell, not an
eighth blueprint screen, but its navigation still belongs in the audit. They were built fast and the
route-level flow works. Nobody has since checked them line by line against the blueprint, which
remains the source of truth (`CLAUDE.md`: "when a doc and the blueprint disagree, the blueprint
wins").

This plan is that pass. It is cheap, it is not glamorous, and it is the kind of work that stops a
prototype-shaped app from shipping. The bugs already found by reading the code
([fix-store-invariants.md](07-fix-store-invariants.md),
[fix-latency-measurement.md](03-fix-latency-measurement.md),
[fix-fabricated-streak.md](02-fix-fabricated-streak.md)) came from exactly this kind of reading and
none of them was caught by the then-existing unit suite.

## Method

For each screen, in this order:

1. **Open the blueprint** at the line range in `docs/design/screen-catalog.md` and read the
   `DCLogic` class's `renderVals()`. It is "a complete, explicit view model — every string, colour,
   boolean, and handler the screen needs", and the `sc-if` flags "enumerate every visual state that
   exists".
2. **List every state** from the paired boolean flags (`active`/`inactive`,
   `repPhase`/`locked`/`done`). Those pairs _are_ the state machine.
3. **Check the app renders each one.** A state that exists in the blueprint and not in the app is a
   gap; a state in the app that is not in the blueprint is a decision that needs recording.
4. **Check every string** against the blueprint and `docs/design/copy-and-tone.md`.
5. **Check the screenshot** for layout, spacing, and hierarchy.
6. **Record intentional divergences** in the divergence table at the end of `screen-catalog.md`,
   which already exists for the blueprint's prototype-only fakes. An undocumented divergence is
   drift; a documented one is a decision.

## Screen-by-screen, with what to look for

| #   | Screen              | Blueprint   | Logic                  | Known or likely issues                                                                                                                                                        |
| --- | ------------------- | ----------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Onboarding          | `128–212`   | `OnbLogic` `2068–2174` | Six steps per the spec; does the goal actually assign the engine? (Q-06 leaning says it should)                                                                               |
| 2   | Add                 | `222–427`   | `AddLogic` `2176–2433` | **Import tab missing entirely** ([add-import-and-capture.md](23-add-import-and-capture.md)); 500-line file with inline layout; unvirtualised browse list                      |
| 3   | Phrase detail       | `436–581`   | `DetLogic` `2435–2514` | The rich fields (`resp`, `words`, `example`, `hint`, `note`) — are all of them rendered, and what shows when they are absent, which is most rows today?                       |
| 4   | Adaptive stream     | `600–677`   | `StrLogic` `2516–2632` | Rank and repeat-target duplicated inline ([fix-shared-maths-duplication.md](05-fix-shared-maths-duplication.md)); **no audio**, so the screen's whole purpose is unexercised  |
| 11  | Today (`index.tsx`) | `1316–1391` | `DayLogic` `3295–3341` | Now the Loop-B home and partly ported. Wave readiness is not time-driven, completion/resume states are incomplete, and fidelity is untested ([20](20-screen-today-ritual.md)) |
| 12  | The Refrain         | `1405–1532` | `RfnLogic` `3343–3424` | Store-driven automaticity is fixed; verify resume/finished states. Wall-clock latency and the no-audio placeholder remain planned defects                                     |
| 15  | Progress            | `1787–1876` | `PrgLogic` `2815–2871` | Real streak/history landed; verify all mastery buckets, axes, empty states, and the full blueprint hierarchy                                                                  |
| —   | `_layout.tsx`       | —           | —                      | App shell only: audit navigation structure against the blueprint's screen relationships                                                                                       |

## What to produce

Not a document — **issues and tests**. For each gap:

1. An issue with the requirement ID and the blueprint citation.
2. A component test asserting the state renders (so the gap cannot silently reopen).
3. A blueprint-fidelity fixture where practical ([testing-gaps.md](37-testing-gaps.md) §4) — extract
   `renderVals()` output for the state and assert the app's view model matches. That converts this
   one-off audit into a standing check, which is the real deliverable.

## Acceptance criteria

- Every state in every ported screen's `renderVals()` is either implemented or has an issue with a
  requirement ID.
- Every string matches the blueprint or has a recorded, reasoned divergence.
- The divergence table in `screen-catalog.md` is complete for the seven ported screens and shell.
- Each screen has component tests covering its states.
- Blueprint-fidelity fixtures exist for the seven ported screens.
- No screen renders a number that is not real (cross-checked against non-negotiable #2 specifically)
  — the latency display floor is the remaining known numeric defect; the no-audio placeholder is a
  separate fidelity defect.
- The design-fidelity gate in `docs/process/definition-of-done.md` becomes a check someone can
  actually perform, because the fixtures exist.

## Tests

- One component/state-matrix suite per ported screen, generated from the audit inventory rather than
  from whichever states happen to be easy to render.
- One extracted `renderVals()` fixture per ported screen, with a deterministic extractor and an
  explicit exceptions file for intentional divergences.
- A navigation test for `_layout` proves every ported route is reachable and every declared route
  has a deliberate back/deep-link behaviour.
- A meta-test compares the screen-catalog list, route inventory, component suites, and fixture names
  so a newly ported screen cannot be omitted from the standing audit.

## Risks

- **Scope creep into a redesign.** This is an audit. Findings become issues; only trivial fixes land
  in the audit PR itself.
- **Overlap with other plans.** Several findings are already planned fixes — link to them rather
  than duplicating the work, and keep the audit's output focused on what is _not_ yet planned.

## Out of scope

The 14 unported screens, and the design-system refactor
([design-system-completion.md](34-design-system-completion.md)) — though the audit will produce its
extraction list as a by-product.
