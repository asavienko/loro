# Offline survival, widgets, Live Activity, and notifications

- **Requirement IDs:** `F-03`, `P5-06`, `P5-08`…`P5-11`, `N-01`…`N-04`, `LB-09`
- **Milestone:** M2
- **Status:** Not started
- **Depends on:** 58 native targets, 62 playback/cache, 69 trip domain/arc

## Outcome

Force-quit in airplane mode launches a fully usable Survival experience in under two seconds with
playable trip phrases. Native widgets/Live Activity and notifications reflect the same local trip
state and never shame a missed day.

## Work

1. Define atomic trip-pack prefetch, verification, pinning, repair, storage budget, stale-pack
   retention, and predeparture readiness using plan-61 manifests and plan-62 cache.
2. Make cold launch read only local DB/assets; defer all network work and measure the device floor.
3. Implement WidgetKit/ActivityKit and Glance timelines from minimal shared local state, with
   privacy redaction and stale/locked/no-trip variants.
4. Implement local notification scheduling/cancellation using Rust policy, timezone/DST-safe clocks,
   permission states, quiet hours, and non-shaming copy. Server push is optional enhancement.
5. Wire deep links through plan-56 route laws and audio through native playback.
6. Add native test matrices for airplane force-quit, partial/corrupt cache, low storage, permission
   denial/revocation, clock/timezone shifts, stale widget, notification tap, and app upgrade.

## Acceptance criteria

- The documented airplane-mode acceptance test passes on the device floor in <2 s.
- Every required trip phrase plays offline; missing assets have an honest usable fallback.
- Widget/notification state is local, privacy-safe, accessible, and cannot contradict the app.
- No scheduler path escalates or guilt-trips after missed practice.

## Out of scope

Remote push campaigns, social widgets, marketing notifications, and billing promotion.
