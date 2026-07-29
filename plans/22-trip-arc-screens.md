# Screens 16–21 — the trip arc

- **Requirement IDs:** `P5-01`…`P5-13`
- **Milestone:** M2 (v1) — the roadmap's "primary persona's entire reason for installing"
- **Blueprint:** `1897–1923`, `1930–1954`, `1961–1980`, `1988–2007`, `2016–2029`, `2037–2057`
- **Spec:** `docs/product/functional-spec.md#16-set-the-arrival` … `#21-souvenir`, and
  `docs/product/trip-arc.md`
- **Size:** XL (six screens)
- **Depends on:** [sqlite-persistence-and-outbox.md](10-sqlite-persistence-and-outbox.md),
  [fix-local-day-boundary.md](01-fix-local-day-boundary.md)

## Why v1 and not later

`docs/product/roadmap.md`, sequencing rationale:

> **Why the trip arc in v1.** It's the strongest thing in the blueprint and the primary persona's
> entire reason for installing. Shipping without it means shipping without a reason to install.

Nothing of it exists today. `TripContext` is declared in the engine contract
(`packages/core/src/engines/types.ts:167` —
`state: 'planning' | 'countdown' | 'abroad' | 'completed'`, `arrivalDate`, `phraseIds`) and
`engineContext()` hardcodes `trip: null` (`store/index.ts:359`). So the seam exists and is unused.

## The six screens, and what each one actually needs

Unlike screens 1–15, the trip rail is a **storyboard rather than interactive prototypes**
(`docs/design/screen-catalog.md`). So there is no `DCLogic` view model to port — the behaviour comes
from `functional-spec.md` and `trip-arc.md`, and the visual from the blueprint markup. Expect more
design decisions per screen here than anywhere else, and expect to need the designer.

### 16 · Set the arrival (`1897–1923`)

A date, a destination, and a purpose. The purpose matters more than it looks: Ana's persona picks
"moving abroad", which is **a date but not a trip** — that is Q-07, currently open. Survival mode
never ends for her and drops should continue weekly rather than stopping. The cheapest resolution
(option (a) in Q-07) is an "indefinite" trip type with no return date. **Decide Q-07 before building
this screen**, because it changes the data model, not just the copy.

### 17 · Countdown home (`1930–1954`)

Days to go (`daysUntil` already exists — `apps/mobile/src/lib/format.ts:38`), readiness against a
target (`ownershipPct`, line 46), and today's work. Readiness must be a **real** measure — phrases
owned at some depth, not phrases added — or it is a progress bar that fills by shopping.

Interval compression against the arrival date (`docs/architecture/scheduling.md:152`) belongs here:
FSRS due dates compress so the trip set peaks on arrival. Compress the due date, never the
underlying stability, or the schedule stays wrong for months after the trip
([fsrs-implementation-and-parity.md](17-fsrs-implementation-and-parity.md)).

### 18 · Daily drop (`1961–1980`)

A small, dated set of trip-relevant phrases. Scheduling is in `scheduling.md:295`. Two properties
worth being careful about: a missed drop is not lost (it accumulates gently, never as a debt list —
non-negotiable #3), and drops must be **prefetched** so they work with no network abroad, which is
the entire point.

### 19 · Lock screen widget (`1988–2007`)

Covered by [widgets-and-notifications.md](30-widgets-and-notifications.md). The trip is its most
compelling use, so the two plans should land together.

### 20 · Survival mode (`2016–2029`)

The M2 exit criterion is precise: _airplane mode, fresh launch, survival mode fully usable in <2 s_,
and it is on the never-cut list. Covered by [offline-survival-mode.md](31-offline-survival-mode.md);
this screen is its surface — the phrases you need right now, offline, findable in one tap while
standing at a counter.

### 21 · Souvenir (`2037–2057`)

The end of the arc: what the learner did, what they used, what they kept. Plus `P5-13` — share recap
and plan the next trip. Everything on it must be real: phrases actually produced, days actually
practised, not a generated highlight reel. This is the screen most likely to acquire fabricated
stats, so audit it against non-negotiable #2 specifically.

## Cross-cutting work

1. **The trip state machine.** `planning → countdown → abroad → completed`, plus the indefinite
   variant from Q-07. Transitions are date-driven and must be computed from the **local** day
   ([fix-local-day-boundary.md](01-fix-local-day-boundary.md)) — a trip that starts a day late for
   anyone east of UTC is a bad first impression.
2. **Trip entities in the data model** and in `packages/core/src/sync/fieldPolicy.ts` with declared
   merge classes. CI fails without them.
3. **Trip-aware engines.** `TripContext` flows through `EngineContext` and reweights selection
   ([select-rs-cloze-and-set-selection.md](18-select-rs-cloze-and-set-selection.md)). No engine gets
   a special case; the context is the mechanism.
4. **Timezone travel.** The learner physically changes timezone mid-arc. Streaks must not break
   (`calendar::streak_survives` already handles a negative gap), the countdown must not jump by two
   days, and drops must not fire twice. Test this explicitly — it is the one bug class this product
   will hit more than most.
5. **Prefetch on the way out.** Everything the trip needs — audio, drops, scenes — downloaded before
   departure, with a visible, honest readiness state ("ready for offline" means it is).

## Acceptance criteria

- All six screens implemented and reachable; the arc runs end to end.
- Q-07 is resolved and recorded before the arrival screen ships.
- Readiness measures depth, not library size.
- Interval compression peaks the trip set on arrival without corrupting stability.
- Drops work with no network; a missed drop accumulates without a debt framing.
- Flying to a different timezone mid-trip does not break the streak, the countdown, or drop
  scheduling.
- Survival mode meets the <2 s airplane-mode bar.
- Every number on the souvenir is real.
- Trip entities have declared merge classes; two devices agree on trip state.
- **The trip test** from the M2 exit criteria: ≥5 real people set a 12-day trip, use the app daily,
  travel, and report they were ready.

## Tests

- State-machine table test over dates, including the indefinite variant.
- Timezone-travel tests: east, west, and across the date line, for streak/countdown/drops.
- Offline test: airplane mode from before departure through the whole arc.
- Souvenir view-model test asserting every figure traces to stored data.

## Out of scope

Booking integrations, maps, city guides. Loro teaches phrases.
