# Widgets, Live Activity, and notifications

- **Requirement IDs:** `P5-06`, `N-01`…`N-04`, `LB-09`
- **Milestone:** M2
- **Blueprint:** screen 19, `Loro.dc.html:1988–2007`
- **Spec:** `docs/architecture/widgets-notifications.md`
- **Size:** L
- **Depends on:** [native-toolchain-and-dev-client.md](09-native-toolchain-and-dev-client.md),
  [sqlite-persistence-and-outbox.md](10-sqlite-persistence-and-outbox.md)
- **Non-negotiables touched:** #3 (no screen shames a missed day — and a notification is a screen)

## Current state

Nothing. No widget targets, no notification scheduling, no `expo-notifications`. The Rust side is
ready: `packages/core-rs/src/notify.rs` implements `is_quiet_hour`, `may_fire(category, ctx)`, and
`deep_link_for(category)` with 9 tests — the **policy** is written and tested, and nothing calls it.

That split is the right one and worth preserving: the widget and the notification extension are
native processes that cannot run JS, so the decision logic has to be in Rust or it will be
duplicated (`docs/architecture/widgets-notifications.md:32`, data flow).

## The work

### 1. Widget targets

`widgets-notifications.md:18` has the platform mapping.

- **iOS**: a WidgetKit extension (lock screen + home screen), plus a **Live Activity** for an active
  session (`:171` has the lifecycle). Data crosses via an App Group container.
- **Android**: a Glance widget, data via a shared file or a content provider.

Both read the same durable store, which is why persistence lands first. Neither can call into JS, so
phrase-of-the-moment selection (`:67`) and the streak both have to come from Rust or from
precomputed rows written by the app.

**Decide the CNG question here**
([native-toolchain-and-dev-client.md](09-native-toolchain-and-dev-client.md) §1): widget targets are
the most likely thing to force committed native projects. Try a config plugin first; if it cannot
express the target, record the switch as an ADR.

### 2. Phrase-of-the-moment selection

`:67`. Deterministic, computed without launching the app, and stable enough that the widget does not
flicker between phrases on every refresh. Put it in `core-rs` next to `notify.rs`.

### 3. Copy constraints

`:79` has them, and they are stricter than app copy because a widget is glanceable and a
notification is interruptive. Two rules worth restating:

- **Spanish first, and correct.** A widget showing a phrase with a mangled accent is the most public
  possible typo.
- **Nothing that implies failure.** No "you haven't practised today", no dropping streak counter, no
  red. Non-negotiable #3 applies with full force here, because a notification reaches the learner
  when they did not ask to be reached.

### 4. Notification scheduling

`:138`. The categories are already enumerated in `notify.rs`. The policy pieces that need care:

- **`may_fire` is the only gate.** Every scheduled notification asks Rust first. No screen or
  service schedules directly.
- **Quiet hours** (`is_quiet_hour`) and **wave nudges opt-out by default _and_ conditional**
  (`:129`) — a wave nudge fires only if the learner has not already done that wave's work. A nudge
  for work already done is the fastest route to notifications being disabled entirely.
- **Local scheduling, not push**, for daily/wave/drop notifications. They must work with no network
  (`F-03`), and a server that decides when a learner's day starts contradicts the offline model.
- **Timezone travel** — reschedule on timezone change, and never fire twice for one day.
- **Permission** requested at a moment where the value is obvious (after the first completed
  Refrain, not at launch), with a graceful denied state.

### 5. Deep links

`deep_link_for(category)` exists (`notify.rs:108`) and `expo-linking` is already a dependency. Every
notification and widget tap lands on the _specific_ thing it promised — a drop notification opens
that drop, not the home screen. Add a test per category asserting the route resolves.

### 6. Live Activity for a session

`:171`. Shows the current phrase and progress during a hands-free stream or Refrain, with
lock-screen transport controls that pair with
[audio-playback-module.md](11-audio-playback-module.md). Ends cleanly — including when the app is
killed mid-session, which is the case that leaves a stale activity pinned to someone's lock screen
for hours.

## Acceptance criteria

- Lock screen and home screen widgets render on iOS; Glance widget on Android.
- Widgets show real data (streak, phrase of the moment, trip countdown) with the app not running.
- No widget or notification copy implies failure or shows a missed-day count.
- Every notification passes through `notify::may_fire`; a test enumerates the schedulers and asserts
  it.
- Quiet hours respected; wave nudges suppressed when the work is done.
- Notifications fire correctly with the network off.
- A timezone change reschedules without duplicate or missed fires.
- Every category's deep link lands on the right screen.
- A Live Activity ends when the session ends, including on app kill.
- Widget refresh stays within platform budgets (no battery-draining refresh loop).

## Tests

- `notify.rs` policy tests exist (9); extend with timezone-change and already-done-wave cases.
- Deep-link routing test per category.
- Widget snapshot tests where the platform supports them; otherwise a documented manual pass in
  `docs/process/qa-device-matrix.md`.
- A copy audit against `docs/design/copy-and-tone.md` for every notification string — cheap, and
  this is the surface where a bad string does the most damage.
- Live Activity lifecycle including force-quit.

## Risks

- **Widget data staleness.** If the widget reads a store the app writes lazily, it shows yesterday.
  Write a small precomputed "widget snapshot" row on every relevant change rather than having the
  widget query the full model.
- **iOS widget refresh budgets** are strict and not negotiable. Design for a few refreshes an hour.

## Out of scope

Apple Watch and CarPlay (M6). Push notifications for anything server-initiated.
