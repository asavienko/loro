# Current-surface truth and blueprint fidelity

- **Requirement IDs:** `P1-01`…`P1-12`, `P2-01`…`P2-40`, `P3-01`…`P3-12`, `P4-01`…`P4-08`,
  `LB-01`…`LB-10`, `P2-13`, `P2-26`
- **Milestone:** M1
- **Status:** ✅ Implemented
- **Depends on:** plan 53 ✅ behavior-preserving baseline

## Outcome

The seven implemented learner screens and app shell match the blueprint contract where the product
can support it, and never imply playback, progress, routing, timing, or persistence that does not
exist.

## What already exists

All current routes have browser E2E state coverage, accessibility checks, text-scale coverage, a
central copy catalog, split UI primitives/components, and token-based color enforcement. Those
completed plan-51/52 outcomes are inputs, not work items.

## Work

1. Re-run the blueprint `renderVals()` audit for every current state and record deliberate
   divergences with requirement IDs.
2. ✅ Removed the Stream 35% progress over silence and non-advancing repeat dots in plan 84. Manual
   Previous/Next navigation is labelled as browsing and never records an audio play.
3. Make Browse theme drill, onboarding answers, remove confirmation/undo, Today wave labels, and the
   zero-height mastery histogram truthful. Route dependency-backed fixes to plans 56/60/64 rather
   than fabricate interim behavior.
4. Fix current latency formatting so measured sub-300 ms samples are not raised and long samples are
   not capped; keep speech-onset measurement in plan 63. Plan 84 removed the incorrect manual-tap
   measurement and its display; the formatter is no longer on this learner path.
5. Add blueprint fixtures or focused render assertions for geometry/state that semantic E2E cannot
   see, without screenshot-testing every pixel.
6. Update the state manifest for every new error, confirmation, empty, disabled, and completion
   state added here.

## Acceptance criteria

- No current control or number claims an unavailable action or fabricated state.
- All blueprint differences are either fixed or listed in the divergence table with a product or
  technical reason.
- `pnpm check`, all current browser E2E, bundle smoke, accessibility, and text-scale gates pass.
- Existing learner copy changes only when the intended product contract changes.

## Out of scope

New routes, real audio/speech, persisted waves, navigation architecture, and unbuilt screens.

---

## What landed

Seven commits, one per coherent change. Each left `pnpm check` green on its own.

1. **Stream (§2, `P3-03`)** — integration retains plan 84's later manual browsing controls and
   audio-unavailable note. The playback bar, repeat pips, and play control remain absent; browsing
   does not record playback. Plan 62 restores playback indicators from real native audio.
2. **Progress tag drill (§3, `P4-05`/`P4-06`)** — the row no longer toasts `Drilling N “…” phrases`
   and navigates to today's unfiltered set. It is a rollup: real numbers, no chevron, no hint, no
   tap. **Routed to plan 64 §4** (with plan 60's tag-scoped selection) rather than faked.
   `refrain · tag drill` left the state manifest with the behaviour it described.
3. **Mastery bar (§3, `P4-04`)** — the stacked chart rendered at ZERO height: segments declare no
   height, as the authored ones do not, but the container centred them instead of stretching. A
   chart that draws nothing is fabricated state. Recorded and deliberately left by plans/52; fixed
   here with a geometry test that fails on the old style.
4. **Onboarding (§3, `P1-04`/`P1-08`)** — `level` reached the store, `completeOnboarding` requires
   every answer so a fifth question cannot be dropped silently, and the ready summary shows all four
   rows in the words they were offered in rather than semantic ids. **The bias itself is routed to
   plan 60** — plan 50 §3's order: persist now, bias with the selector.
5. **Remove (§3, `P2-13`/`P2-26`)** — a toast with an undo that restores the ROW verbatim at its own
   index, not a re-add with a fresh id and zeroed history. Found a real 47×33 tap target on the
   toast's `Undo`, which no declared state had ever put on screen during the touch-target sweep.
6. **Browse drill (§3, `P2-08`)** — the drilled list names its theme and how much is left
   (`Loro.dc.html:306`), its dead end says the theme is finished instead of pointing at a search box
   browse mode does not render, and a finished tile stops announcing "0 to add" while displaying
   "all added ✓".
7. **Latency (§4, `LB-27`)** — `formatLatency` no longer raises a sub-300 ms sample to `0.3s` or
   caps a long one at `5.0s`. Under a second it is whole milliseconds, because `.toFixed(1)` renders
   45 ms as `0.0s`; at or above it, the blueprint's `N.Ns`. A negative sample reads as unmeasured.
   Onset measurement stays in plan 63.

**Today's wave labels** needed nothing: NAV-16 had already moved them onto `PRODUCTION_WAVE_TIMES`
through `waveSchedule()`, and no wave claims `done`. Verified against `DayLogic:3308–3312` and
recorded in the divergence table rather than changed.

**§1 (the audit)** is
[`docs/design/screen-catalog.md`](../../../docs/design/screen-catalog.md#current-surface-divergences--the-seven-built-routes)
— every departure from the applicable authored `renderVals()` on all seven routes, each with a
requirement ID and either a product reason or the plan that closes it.

**§5 (render assertions)** is
[`apps/mobile/e2e/render.spec.ts`](../../../apps/mobile/e2e/render.spec.ts): three measurements of
geometry no semantic locator can see — the mastery segments' height and shares, the absence of any
bar on the stream (the fabricated one was `aria-hidden`, which is why it survived), and a Today
row's fill against the percentage in the row's own name. No screenshots.

**§6 (the manifest)** gained `today · remove undo offered` and `add · theme fully added`, and lost
`refrain · tag drill`.

### Known cost

The per-test Playwright timeout moved from 30 s to 90 s. Three tests are whole-manifest sweeps, and
the undo toast is bottom-centred, so each of the ten removals in `today · nothing in rotation` waits
for the previous toast to stop covering the `Remove` button — 2.6 s apiece. Playwright refusing to
click an obscured control is correct, and forcing past it would hide the overlap. The 8-minute suite
budget is unchanged and the suite runs in ~3.6 min.

## Archive review — 2026-09-07

✅ Implemented scope retained as a historical record. Reviewed against merged baseline `2d9e8c3`;
historical test counts and temporary evidence paths above describe the original delivery. The
current disposition and remaining owners are in [REVIEW.md](REVIEW.md).
