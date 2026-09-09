# 93 — Mobile shell gestures

**Status:** 🟡 Browser gesture implementation and regression are verified; the dated aggregate
checks below are historical. Physical-device and assistive-technology acceptance remains a release
gate. Post-main review at `de81744` confirms the focused browser gesture test passes. **Requirement
IDs:** NAV-04, NAV-06, NAV-08 (session gestures, sheet dismissal and switcher).

Implement the pull-down switcher and sheet dismissal specified by `Navigation.dc.html:474` and
`Navigation.dc.html:681–685`. Keep practice-session back gestures disabled. Preserve buttons,
backdrop dismissal, Escape and Android Back.

Use dedicated handles, one-finger vertical intent and a 48-point release threshold. Short,
horizontal and cancelled drags do nothing. Sheet content retains its own scrolling. No new learner
state: the existing switcher and difficulty sheet manifest entries apply. No audio, scoring,
persistence or practice-outcome changes.

Validation: browser gesture regression, full `pnpm check` and `pnpm test:e2e`. Real iOS/Android
touch and assistive-technology verification must precede native release.

Verified: `pnpm check` passed all 23 tasks; `pnpm test:e2e` passed all 119 tests in 4.4 minutes,
including mouse/touch gestures, cancelled touch, accessibility and 310% text. The initial cold
concurrent run exceeded the database timing and browser suite budgets; sequential warm validation
passed without relaxing either budget.

Merge validation against `734028a`: `CI_BASE_REF=origin/main LORO_CI_CONCURRENCY=1 pnpm ci:local`
passed, including 134 learner E2E tests, 3 workbench tests, 4 production-bundle tests, native/WASM
core generation, PostgreSQL auth tests, mobile/API builds, API/container smoke checks and Rust
benchmarks. Physical-device gesture validation is still outstanding.

**Archive disposition (2026-09-09):** Archived at user request after implemented slices landed. The
partial status and remaining acceptance criteria are retained; archival does not mark this plan
complete. The roadmap index continues to track its unfinished scope.

## Post-main review and archive disposition — 2026-09-09

The [review at `de81744`](../../../docs/reviews/2026-09-09-post-main-plan-review.md) records this
plan's current contribution, remaining work and gates. [Delivered slices](IMPLEMENTED-SLICES.md) are
retained in the archive; this plan remains incomplete. Earlier verification is dated evidence, not
acceptance of the current combined branch.
