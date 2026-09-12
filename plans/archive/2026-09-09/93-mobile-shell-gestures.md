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
touch and assistive-technology verification must precede native release. Plan 101 adds browser
mouse/touch coverage for Stream → phrase Refrain and menu hard-filter;
`native:evidence --execute-scenarios` on Linux emulator `emulator-5554` (APK `b0b4e3b77746`) passed
all twelve catalog rows at `.local-builds/native-evidence/wave-101-emulator-v9/`: edge and
mid-screen swipes stayed on the session, spine pull opened the switcher, and sheet pull, Android
Back, and labelled Dismiss backdrop each closed it on Today, including TalkBack variants.
`closesPhysicalGate` stays false. That v9 APK does not include the later JS session-pop intercept
(`useSessionExitGuard` + Stream `BackHandler`); the runner now also sends `KEYCODE_BACK` on Stream
(stay) and on phrase Refrain (must open the exit sheet). Practice sessions set
`fullScreenGestureEnabled: false` with `gestureEnabled: false`. That remains emulator proof, not
physical-device or iOS. iOS `--execute-scenarios` uses simctl + idb for pointer, spine/sheet, and
backdrop rows and fail-closes without chrome/URL/gesture proof. Android Back stays unavailable on
iOS. That iOS path may boot a Shutdown simulator and install a verified `loro-simulator-*.zip` via
`pnpm ios:evidence`. VoiceOver `-at` evidence remains a device gate even if VoiceOver looks enabled;
ordinary idb taps are not AT proof. Plan 101's Stream-primary / hard-filter Refrain model is not
reverted.

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
