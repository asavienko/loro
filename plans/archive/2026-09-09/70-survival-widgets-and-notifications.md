# Offline survival, widgets, Live Activity, and notifications

- **Requirement IDs:** `F-03`, `P5-06`, `P5-08`…`P5-11`, `N-01`…`N-04`, `LB-09`
- **Milestone:** M2
- **Status:** 🟡 The Rust policy and pure candidate planner are implemented; native Survival,
  widgets and notification integration remain to do and need 58/62/69. Q-07 still prevents trip
  candidates from being supplied.
- **Depends on:** 58 native targets; 61 manifests; 62 playback/cache; 69 approved trip lifecycle; 56
  deep-link laws.
- **Reviewed:** 2026-09-07 against merged baseline `2d9e8c3`.

**Archive disposition (2026-09-09):** Archived at user request after implemented slices landed. The
partial status and remaining acceptance criteria are retained; archival does not mark this plan
complete. The roadmap index continues to track its unfinished scope.

## Verified starting point

`packages/core-rs/src/notify.rs` implements policy plus a pure, ordered candidate planner with
stable identifiers, resolved delivery instants, semantic copy keys, deep links, route-availability
filtering and foreground-suppression intent. It does not calculate timezones, schedule/cancel OS
notifications, translate copy, or make trip decisions. There are no widget/Live Activity targets,
local notification scheduler or airplane-mode Survival proof. Native mirrors must consume one
locally stored trip/course and the same scheduling policy.

## Outcome

Force-quit in airplane mode launches a fully usable Survival experience in under two seconds with
playable trip phrases. Native widgets/Live Activity and notifications reflect the same local trip
state and never shame a missed day.

## Remaining work

1. [ ] Define atomic trip-pack prefetch, verification, pinning, repair, storage budget, stale-pack
       retention, and predeparture readiness using plan-61 manifests and plan-62 cache.
2. [ ] Make cold launch read only local DB/assets; defer all network work and measure the device
       floor.
3. [ ] Keep widget text in the native/UI language, phrase speech in the trip target locale and
       capability states honest. Implement WidgetKit/ActivityKit and Glance timelines from minimal
       shared local state, with privacy redaction and stale/locked/no-trip variants.
4. [ ] Implement platform scheduling/cancellation from the Rust planner using timezone/DST-safe
       candidate instants, permission states, quiet hours, foreground suppression and non-shaming
       translated copy. Server push is optional enhancement.
5. [ ] Wire deep links through plan-56 route laws and audio through native playback. Plan 101
       requires daily reminder / wave nudge to open Stream; `deep_link_for` now emits
       `loro://practice/stream` and `loro://practice/stream?wave=midday`. A bare `/practice` path
       also resolves to Stream. The OS scheduler that first calls `deep_link_for` remains.
6. [ ] Add native test matrices for airplane force-quit, partial/corrupt cache, low storage,
       permission denial/revocation, clock/timezone shifts, stale widget, notification tap, and app
       upgrade.

## Acceptance criteria

- The documented airplane-mode acceptance test passes on the device floor in <2 s.
- Every required trip phrase plays offline; missing assets have an honest usable fallback.
- Widget/notification state is local, privacy-safe, accessible, and cannot contradict the app.
- No scheduler path escalates or guilt-trips after missed practice.

## Out of scope

Remote push campaigns, social widgets, marketing notifications, and billing promotion.

## Post-main review and archive disposition — 2026-09-09

The [review at `de81744`](../../../docs/reviews/2026-09-09-post-main-plan-review.md) records this
plan's current contribution, remaining work and gates. [Delivered slices](IMPLEMENTED-SLICES.md) are
retained in the archive; this plan remains incomplete. Earlier verification is dated evidence, not
acceptance of the current combined branch.
