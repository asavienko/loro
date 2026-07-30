# Widgets and notifications

Loro's presence outside the app. Both surfaces are governed by one product rule: **urgency, not
guilt** (`Loro.dc.html:2009`).

---

## Implementation boundary (current repository)

The native surfaces in this document do not exist yet. There is no WidgetKit, ActivityKit, Glance,
Android widget, notification scheduler, snapshot publisher, or `expo-notifications` dependency in
`apps/mobile`. The app configuration reserves the iOS App Group, Android notification/foreground
service permissions, URL scheme, and background-audio capability; those declarations do not render,
schedule, or deliver anything.

The reusable part that does exist is smaller: `packages/core-rs/src/notify.rs` defines the seven
categories and unit-tests quiet hours, the daily cap, opt-outs, conditional waves, trip gating, the
language-pack threshold, and category deep-link strings. It does **not** yet implement the
`planNotifications` function shown below, choose delivery times, schedule OS notifications, publish
a widget snapshot, or select a phrase of the moment. `apps/mobile/src/lib/clock.ts` and Rust
calendar rules provide day semantics, but neither is connected to a native rollover callback.

### Prerequisites for adding the surfaces

Before scheduling, complete a pure planner whose output includes stable notification identifiers,
delivery timestamps, category, copy key, and destination; test replacement/cancellation, foreground
suppression, timezone travel, DST, permission denial, and the absolute daily cap. Then add the
platform adapter and reschedule hooks for foreground, settings, practice completion, trip changes,
and local-day rollover. A scheduled notification must never depend on JavaScript waking at delivery
time.

Before widgets, define and version the snapshot at the shared boundary, add atomic platform storage,
publish after the local transaction commits, and make stale/missing/audio-missing states explicit.
Only after those contracts exist should the native targets and Live Activity lifecycle be added.
Every destination in the policy must resolve to an implemented route (or remain unscheduled); most
trip/settings destinations in the target table do not exist today.

## The lock screen widget

`Loro.dc.html:1988–2007` · [functional-spec.md](../product/functional-spec.md#19-lock-screen-widget)

The blueprint shows two glass cards on the lock screen:

1. **Readiness** — a conic ring at ownership %, days-to-go in the centre, `LORO · 3 DAYS TO MADRID`,
   `You own 84 of 100 phrases`, `16 left — finish the essentials today`.
2. **Phrase of the moment** — Spanish, English, a ▶ button, a playback progress bar.

### Platform mapping

| Blueprint element           | iOS                                                                 | Android                                                     |
| --------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------- |
| Readiness card, trip active | **Live Activity** (ActivityKit) on the Lock Screen + Dynamic Island | Ongoing **notification** with a custom layout, low priority |
| Readiness, no trip          | Lock Screen **widget** (`accessoryRect`)                            | **Glance** app widget                                       |
| Phrase of the moment        | Home Screen widget (`systemSmall`, `systemMedium`)                  | Glance app widget                                           |
| ▶ tap plays audio           | Deep link `loro://phrase/<id>?play=1`                               | Same, via `PendingIntent`                                   |
| Countdown tap               | `loro://trip`                                                       | Same                                                        |

**Why a Live Activity for the trip.** It's exactly the intended use — a bounded, time-relevant event
with a live-updating value. It gets Lock Screen and Dynamic Island placement without the learner
having to add a widget, which most people never do. It ends automatically when the trip ends.

### Data flow

Widgets cannot read the app's SQLite database directly (separate process, separate sandbox rules),
so the app **pushes** a small snapshot whenever the underlying facts change.

```
App writes → domain change (drop added, phrase mastered, day rollover, trip state change)
           → WidgetService.publish(snapshot)
               iOS:     write to the App Group container, then WidgetCenter.reloadTimelines()
                        (+ Activity.update() when a Live Activity is running)
               Android: write to the shared DataStore, then AppWidgetManager.updateAppWidget()
```

```ts
interface WidgetSnapshot {
  trip: { city: string; flag: string; daysToGo: number; owned: number; target: number } | null
  phraseOfMoment: { id: string; es: string; en: string; audioPath: string } | null
  streak: number
  updatedAt: number
}
```

**Rules**

- **The snapshot is tiny and complete.** Widgets never compute; they render what they're given.
  There is no widget-side scheduling logic that could disagree with the app.
- **`audioPath` is a real local file.** A ▶ tap plays without launching the app and without a
  network. If the file is missing, the ▶ is hidden rather than shown-and-broken.
- **Published on change, not on a timer.** Timeline reloads have OS budgets; wasting them means a
  stale widget when it matters.
- **Days-to-go is computed at publish time from the local date**, and republished on day rollover,
  so a widget never shows a stale count.
- **Offline-complete.** Everything in the snapshot is local. Widgets work in airplane mode, which is
  the state they're most likely to be in on the trip.

### Phrase-of-the-moment selection

Chosen at publish time by `loro-core`, so the choice is testable:

```
1. Trip active & abroad → highest-need survival phrase for the current hour
2. Trip active & countdown → a phrase from today's drop not yet practised
3. Refrain active → the lowest-automaticity phrase in today's set
4. Otherwise → the most overdue phrase
5. Fallback → a `useful`-tagged phrase at random from the owned set
```

### Copy constraints

The widget is the most likely place to accidentally shame someone, because it's always visible.

| ✅ Allowed                              | ❌ Forbidden                |
| --------------------------------------- | --------------------------- |
| `16 left — finish the essentials today` | `You've missed 2 days`      |
| `You own 84 of 100 phrases`             | `Your streak is at risk`    |
| `3 DAYS TO MADRID`                      | `Don't lose your progress!` |
| `Ready for: café, taxi, hotel`          | `You're behind schedule`    |

Reviewed as part of the design-fidelity gate
([`process/definition-of-done.md`](../process/definition-of-done.md)).

---

## Notifications

### Policy

| Rule                                                                                     |                                                |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------- |
| **Maximum 3 per day**, ever, across all categories                                       |                                                |
| **Every category is individually opt-out** in Settings                                   |                                                |
| Permission requested **after** the first completed session, framed as the daily reminder | Never at launch                                |
| **No re-engagement bait.** No "we miss you", no streak-loss warnings, no fake urgency    | 🔒 Product rule `N-04`                         |
| Local notifications wherever possible                                                    | Works offline; no server, no push token needed |
| Server push only for things the device cannot know                                       | Currently: nothing in v1                       |
| Quiet hours 22:00–07:00 local, enforced                                                  |                                                |
| Nothing fires while the app is foregrounded                                              |                                                |

That "server push only for things the device cannot know" line has a consequence worth stating: **in
v1, every notification Loro sends is local.** Reminders, wave nudges, and drop unlocks are all
computable on-device, so they work in airplane mode and require no push infrastructure.

### Categories

| Category                 | Default          | Trigger                                                      | Copy example                                                                  |
| ------------------------ | ---------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| **Daily reminder**       | On               | Learner-chosen time; skipped if they already practised today | _"Five phrases are ready. ~4 minutes."_                                       |
| **Wave nudges** (Loop B) | Off              | At each wave time, only if the previous wave was completed   | _"Midday wave — from memory this time."_                                      |
| **Trip drop**            | On during a trip | 06:00 local on a drop day                                    | _"Day 9: Café & ordering just unlocked. 8 phrases."_                          |
| **Trip milestone**       | On during a trip | Crossing 50% / 80% / 100% ownership                          | _"You own 80 of 100. Madrid in 3 days."_                                      |
| **Arrival**              | On               | Morning of the arrival date                                  | _"¡Bienvenido a Madrid! Your survival deck is ready — and it works offline."_ |
| **Return**               | On               | Return date, or arrival + 14 days                            | _"How was Madrid? Your recap is ready."_                                      |
| **Language pack needed** | On               | ASR unavailable and the learner has hit reveal mode 3×       | _"Download Spanish speech to practise out loud."_                             |

**Never used:** streak reminders, "you haven't practised in N days", "your phrases need review!",
weekly summaries with a guilt frame, anything with a countdown timer on a non-trip event.

### Wave nudges are opt-out by default _and_ conditional

Three notifications a day is a lot, even when each is useful. So wave nudges are:

- **off by default** — a learner has to want them;
- **conditional** — the midday nudge only fires if the morning wave was completed, so the app never
  nags someone who has clearly decided not to practise today;
- **silent-capable** — deliverable without sound or badge if the learner prefers.

### Scheduling

```ts
// Local notifications are rescheduled on: app foreground, settings change, day rollover, trip change.
async function rescheduleAll(state: NotificationState): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync()
  const plan = planNotifications(state) // pure, in loro-core — testable
  for (const n of plan) await Notifications.scheduleNotificationAsync(n)
}
```

`planNotifications` will be pure and live in `loro-core`, so the entire notification policy can be
unit-tested rather than emerging from scattered scheduling calls. Today the core exposes and tests
the individual `may_fire` policy and `deep_link_for` rules; constructing a complete, ordered plan is
still required. This boundary is the mechanism that makes rule `N-04` enforceable.

### Deep links

Every notification opens directly onto the right surface, never the home screen:

| Notification   | Deep link                                                  |
| -------------- | ---------------------------------------------------------- |
| Daily reminder | `loro://practice/refrain` (or the active engine's surface) |
| Wave nudge     | `loro://practice/refrain?wave=midday`                      |
| Trip drop      | `loro://trip/drop/<day>`                                   |
| Trip milestone | `loro://trip`                                              |
| Arrival        | `loro://trip/survival`                                     |
| Return         | `loro://trip/souvenir`                                     |
| Language pack  | `loro://settings/speech`                                   |

A notification that opens the home screen and makes the learner navigate has wasted their attention.

---

## Live Activity lifecycle (iOS)

```
Trip created with arrival ≤ 14 days away
  → Activity.request(attributes: TripAttributes, content: initial state)

On each relevant change (drop added, phrase mastered, day rollover)
  → Activity.update(content: new state)

Arrival date reached
  → Activity.update(final: "¡Bienvenido!") then Activity.end(dismissalPolicy: .after(2h))
```

- Trips longer than 14 days start the Activity at T-14, not at creation — an Activity running for
  two months would be dismissed by the learner and never seen again.
- The Activity is updated by the app process on change, and by `ActivityKit`'s own staleness date as
  a safety net so it never shows a wrong number.
- If the learner dismisses it, we do not re-request it. Dismissal is an answer.

---

## Testing

| Test                        | Method                                                                                               |
| --------------------------- | ---------------------------------------------------------------------------------------------------- |
| Notification policy         | Present: Rust unit tests for caps, quiet hours, opt-outs and gates. Required: complete planner tests |
| Widget snapshot correctness | Unit test the selection ladder; golden-file the snapshot for known states                            |
| Widget rendering            | Xcode previews / Glance previews for every state, including empty and no-trip                        |
| Offline widget play         | Manual: airplane mode, tap ▶ on the lock screen, audio plays without launching the app               |
| Live Activity lifecycle     | Manual on a device — the simulator's Activity behaviour is not trustworthy                           |
| Deep links                  | Maestro flows asserting each notification lands on the right screen                                  |
| Day rollover                | Advance the device clock past midnight; assert widget and notifications both update                  |
| Copy audit                  | Every string in both surfaces reviewed against the forbidden list, every release                     |
