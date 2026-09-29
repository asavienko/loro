# Scheduling

> **App swap, 2026-09-30.** The first app in `apps/mobile` was replaced by the v2.0 listening-first
> player, and `packages/core` lost the client engines and SQLite persistence it used; both remain in
> Git history at `52a0e3b`. Stream rank, waves and the Refrain below describe that app. The current
> app schedules with the same Rust FSRS through `core_call` (`apps/mobile/src/shared/core/fsrs.ts`),
> and `apps/mobile/src/shared/state/clock.ts` is its only clock.

Every "when does this come back?" and "what's next?" decision in the product. The architectural
owner is `loro-core` (Rust), so iOS, Android, and the server must compute identical answers
([ADR-0002](adr/0002-shared-rust-core.md)). The implemented engines now call its generated
native/browser boundary.

## Current implementation status

| Mechanism      | Implemented now                                                               | Remaining scope/evidence                                         |
| -------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Stream rank    | Canonical Rust rank/repeat functions used by mobile WASM/UniFFI               | Physical-device performance acceptance                           |
| FSRS           | FSRS-6, authored 50% policy, reference/preview parity, complete durable state | Future Review/Memory screens and full iOS acceptance             |
| Automaticity   | Declared progress deltas; Rust cloze and frozen-set selection                 | Plan 64 timed/audible wave behavior                              |
| Ladder         | Rust climb/need/draw and durable current-engine progress                      | Run/Roleplay engines and their acceptance                        |
| Trip drops     | Content data exists                                                           | Trip scheduling/service/persistence/routes                       |
| Day boundaries | Calendar parity, durable day keys, frozen sets and resume                     | Physical timezone/process-death matrix and OS lifecycle coverage |

[Plan 94](../../plans/archive/2026-09-09/94-persistent-practice-and-account-integration.md)
integrates the canonical slice of
[plan 60](../../plans/archive/2026-09-09/60-authoritative-core-maths.md). Future mechanisms below
remain product contracts until their routes/engines are built; existing runtime results use real
inputs.

Five independent mechanisms, one per progress signal:

| Mechanism                               | Answers                                  | Owner                         |
| --------------------------------------- | ---------------------------------------- | ----------------------------- |
| [Stream rank](#1-stream-rank)           | What plays next in hands-free listening? | StreamEngine                  |
| [FSRS](#2-fsrs--spaced-repetition)      | When should this come back?              | SrsEngine (maintained by all) |
| [Automaticity](#3-automaticity--loop-b) | Is this phrase effortless yet?           | RefrainEngine                 |
| [The ladder](#4-the-ladder--loop-c)     | How deeply is this owned?                | RunEngine (maintained by all) |
| [Drops](#5-trip-drops)                  | What unlocks today?                      | TripService                   |

<a id="association-is-not-a-sixth-scheduler"></a>

Discover association after add (P2-04) is **not** a sixth scheduler. It ranks unowned catalog
neighbors inside authored theme bands. Rust still owns the integer, but the inputs are the
**anchor** phrase's declared difficulty and tags plus catalog fields — not FSRS due, mastery or
automaticity of the candidates (they are not yet owned). Owner:
[plan 101](../../plans/101-phrase-sound-graph.md). Durable model:
[content-model.md](../product/content-model.md#phrase-relation-graph).

---

<a id="1-stream-rank"></a>

## 1 · Stream rank

The blueprint's formula, kept verbatim (`Loro.dc.html:2527`) and extended with one term.

```rust
// loro-core::rank::stream_rank
pub fn stream_rank(p: &PhraseState, now: Timestamp) -> i32 {
    let mut r = p.plays as i32;
    r += match p.difficulty {
        Difficulty::Hard => -6,
        Difficulty::Easy =>  4,
        Difficulty::Med  =>  0,
    };
    if p.loved { r -= 3; }
    // Extension: a phrase that is due deserves to be heard.
    if let Some(due) = p.srs_due {
        if due <= now { r -= 4; }
    }
    r
}
```

Sort ascending. Repeat counts are also the blueprint's: **`hard 4 · med 3 · easy 2`**.

**Why `plays` dominates.** It naturally round-robins: everything gets heard before anything repeats,
and the difficulty offsets bias _which_ things get heard sooner without ever starving a phrase. It's
a simple mechanism that behaves well, and it's visible to the learner (rate something Difficult and
you hear it sooner — the toast says so).

**The extension.** Adding a due-date term makes the stream double as passive review. It's the one
place the loops genuinely help each other, and it's why the term is `−4` rather than something
dominant: the stream should stay a listening experience, not become a covert review queue.

---

<a id="2-fsrs--spaced-repetition"></a>

## 2 · FSRS — spaced repetition

[ADR-0004](adr/0004-fsrs-scheduler.md). FSRS (Free Spaced Repetition Scheduler) rather than SM-2 or
a hand-rolled scheme.

**Implemented model.** Rust uses FSRS-6 with the published default parameters and the pinned
[ts-fsrs reference](https://github.com/open-spaced-repetition/ts-fsrs/tree/c8ca282edc3fe1cdfa1c24912437938b63a25cb3).
The [model and policy](fsrs-model.md) records numerical precision, reference fixtures, authored
adaptations and compatibility. Desired retention remains the authored **50%**. Stability retains its
FSRS definition at **90% recall**; those two quantities are distinct.

The prototype's exponential `R(t) = 0.5^(t/S)` is replaced by FSRS-6's power forgetting curve. The
future Memory screen must draw that canonical curve and mark the actual 50% review interval.
Intervals have no random fuzz and are bounded to 1–36,500 days after graduation. Again schedules an
explicit ten-minute learning/relearning step; Hard in those phases schedules fifteen minutes. These
step durations are scheduling policy, never fabricated stability values.

### State per phrase

The atomic persisted group contains every value below. The app keeps unreviewed scheduling state
null until an actual review, then stores the full canonical result and its scalar review evidence.

```rust
pub struct FsrsState {
    pub stability: f64,        // days until retrievability falls to 0.9
    pub difficulty: f64,       // 1..10
    pub due: i64,              // epoch milliseconds
    pub last_review: Option<i64>,
    pub lapses: u32,
    pub state: CardState,      // New | Learning | Review | Relearning
    pub algorithm: String,    // parameter and policy provenance
}
```

Known 90% preview records retain their stored memory, due date and review history. Loading or
rerating does not reset them; their next real review advances the existing state under the authored
50% policy. Unknown explicit provenance is rejected without modifying learner data.

### Grade mapping

Loro has three different rating UIs. All three map onto FSRS's four grades in one place:

| Source                       | Learner sees | FSRS grade                                                                               |
| ---------------------------- | ------------ | ---------------------------------------------------------------------------------------- |
| Review session               | Again        | `Again` (1)                                                                              |
|                              | Difficult    | `Hard` (2)                                                                               |
|                              | Good         | `Good` (3)                                                                               |
|                              | Easy         | `Easy` (4)                                                                               |
| Memory model (5 levels)      | Forgot       | `Again`                                                                                  |
|                              | Shaky        | `Hard`                                                                                   |
|                              | OK           | `Good`                                                                                   |
|                              | Strong       | `Good`, with the authored +10% stability bonus and recomputed due                        |
|                              | Instant      | `Easy`                                                                                   |
| Refrain rep (implicit)       | —            | `Good` if produced within 2× median latency, else `Hard`; `Again` if not produced at all |
| Speak-to-progress            | —            | `Good` on a hint-free completion; `Hard` with hints                                      |
| Prosody / pronunciation take | —            | `Good` at score ≥ 85; otherwise no FSRS write                                            |

The bottom four rows are how **rule 5** ([overview.md](overview.md#the-ten-rules)) is honoured:
every engine feeds FSRS even when it never shows an interval.

### Learner-declared difficulty as a prior

The first observed review initializes reference stability while retaining the learner-declared
difficulty prior. Adding a phrase creates no synthetic review:

```rust
pub fn initial_difficulty(declared: Difficulty, tags: &Tags) -> f32 {
    let mut d = match declared {
        Difficulty::Easy => 3.5,
        Difficulty::Med  => 5.0,
        Difficulty::Hard => 7.5,
    };
    if tags.contains(Tag::Remember) { d += 0.8; }  // meaning won't stick → intrinsically harder
    if tags.contains(Tag::Words)    { d += 0.4; }
    // `pron` deliberately does not raise difficulty: it changes the drill, not the memory load.
    d.clamp(1.0, 10.0)
}
```

Re-rating uses the canonical bounded ±1.0 difficulty nudge toward this prior. It preserves
stability, due, last review and lapses and creates no review-log event. The complete group is
synchronized with a causal HLC while retaining its original observed review time.

### Displayed intervals must be real

The blueprint's fixed labels (`<5 min`, `~10 min`, `1 day`, `5 days`) are prototype display data
(`Loro.dc.html:3009`). The runtime now persists canonical due dates through generated WASM and
native bindings. Review/Memory interval views remain future screens; they must format the actual due
time. Learning/relearning durations come from the explicit step policy; graduated intervals come
from the canonical memory model.

### Daily load

Uncapped review queues are how SRS apps lose learners
([practice-loops.md](../product/practice-loops.md#loop-a--the-engine)). We cap:

```
max_reviews_per_day = daily_minutes × 4     // ~15 s per card
```

Overflow is deferred by due date, and the learner is told the queue was capped — never surprised by
a wall of cards. `median_overdue` is a guardrail metric
([metrics.md](../product/metrics.md#guardrails)).

### Trip compression

While a trip is in `countdown`, phrases in the trip set get shortened intervals so they're reviewed
before departure:

```
interval = min(fsrs_interval, days_until_arrival / 3)
```

Trip readiness beats long-term optimality — the deadline is real. On trip completion, phrases
inherit FSRS state derived from their actual trip performance rather than being reset
([trip-arc.md](../product/trip-arc.md#regime-3--souvenir)).

---

<a id="3-automaticity--loop-b"></a>

## 3 · Automaticity — Loop B

The blueprint's formula, kept exactly (`Loro.dc.html:3378`):

```rust
pub fn automaticity(reps_today: u32, target: u32) -> u8 {
    ((reps_today as f32 / target as f32) * 100.0).round().min(100.0) as u8
}
// target defaults to 6
```

| Concept          | Rule                                                                                                                                                     |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Locked in**    | `automaticity == 100` for today                                                                                                                          |
| **Graduated**    | Locked in on 4 distinct days → out of rotation, banked (`day n/4` in the UI)                                                                             |
| **Fading tail**  | A graduated phrase is shown for 3 more days with days-left, then disappears from Today                                                                   |
| **Overlearning** | The target does **not** shorten if rep 1 was perfect. Deliberate ([learning-model.md](../product/learning-model.md#overlearning-is-the-point-not-waste)) |

### Choosing today's set

Rust's `select_refrain_set` and `cloze_mask` now own selection through the generated runtime
boundary. The skeleton below describes the priority policy; `packages/core-rs/src/select.rs` is the
exact implementation. SQLite freezes membership by course and local day, restores it after relaunch
and ignores a resume cursor from a different day.

Run once per day, persisted to `refrain_day`. **Never recomputed mid-day** — the learner must be
able to finish the set they were shown.

```rust
pub fn select_refrain_set(candidates: &[PhraseState], size: usize, ctx: &Ctx) -> Vec<PhraseId> {
    let mut out = Vec::new();
    // 1. Yesterday's unfinished business — phrases mid-graduation (day 1..3 of 4).
    out.extend(in_rotation_not_graduated(candidates));
    // 2. Trip drop phrases, when a trip is active.
    if let Some(trip) = &ctx.trip { out.extend(todays_drop_phrases(trip, candidates)); }
    // 3. Weakest: lowest automaticity history, then hard-rated.
    out.extend(weakest(candidates, size - out.len()));
    // 4. New material, to keep the set full.
    out.extend(newest_unpractised(candidates, size.saturating_sub(out.len())));
    out.truncate(size);
    out
}
```

Set size comes from the learner's daily-minutes answer: **5 min → 3 · 10 min → 5 · 20 min → 8.**

### Wave times

Three waves (`Loro.dc.html:3306–3310`), named for morning / midday / evening. Defaults 08:00 / 13:00
/ 19:00, learner-adjustable. The clock still marks which slot is current, but a wave is a record
that the learner showed up — it never locks practice. A wave completes when ten distinct phrases
have been listened to three times each today; finishing a Refrain set also records the current slot.
After a wave is done the learner can keep listening to other phrases. Missing a wave is not a
failure.

`refrain_day.waves` records finished wave keys per course/day; `listen_counts` holds today's
per-phrase listens. A clock-passed hour alone never counts as completed. Today refreshes at each
minute boundary while focused and on foreground return, so its wave labels and frozen day follow the
real clock without requiring navigation. A midnight refresh uses the existing transactional
`ensureRefrainSet` path and preserves prior practice history.

`apps/mobile/src/lib/waves.ts` marks the last wave whose time has arrived as next (the first before
any arrives) and always offers an unfinished slot. Notification scheduling, audible orchestration
and device acceptance remain plan 64 work.

### Latency

```rust
pub struct LatencySample { pub phrase_id: PhraseId, pub rep_index: u32, pub ms: Option<u32> }
```

`ms` is `Option` at the type level, which forces every caller to handle "not measured". The UI hides
the read-out on `None` rather than substituting an estimate
([audio-speech.md](audio-speech.md#recording-and-latency)). The displayed effort chart is the last 4
measured samples; unmeasured reps leave gaps rather than interpolated bars.

---

<a id="4-the-ladder--loop-c"></a>

## 4 · The ladder — Loop C

Five rungs (`Loro.dc.html:3429–3435`). **Maintained from v1** even though Loop C ships in v2, so the
Phrasebook has real data on its first day
([practice-loops.md](../product/practice-loops.md#loop-c--the-roguelike-run)).

```rust
pub enum LadderRung { Accumulated = 0, Bent = 1, Transferred = 2, PressureTested = 3, Deployed = 4 }
```

### How rungs are earned, per engine

| Engine         | Evidence                                   | Climbs to        |
| -------------- | ------------------------------------------ | ---------------- |
| Any            | First successful production                | Accumulated      |
| RefrainEngine  | Cloze or Call mode completed hint-free     | Bent             |
| RoleplayEngine | Phrase used in a scene it wasn't taught in | Transferred      |
| RefrainEngine  | Speed mode at latency < 0.8 s              | Pressure-tested  |
| RoleplayEngine | Produced as free speech, unprompted        | Deployed         |
| RunEngine      | The corresponding finisher completed       | Its `advTo` rung |

**Monotonic.** `rung` never decreases. Enforced in the conformance suite
([practice-engines.md](practice-engines.md#conformance)). _"Nothing lost — you only climb or hold."_

### Staleness and need

```rust
pub fn need(p: &PhraseState, now: Timestamp) -> u32 {
    let stale = if p.last_practiced_at.map_or(true, |t| days_between(t, now) > 14) { 2 } else { 0 };
    stale + p.stumbles
}
```

`stumbles` increments on a failed production and decrements (floor 0) on a success. `need` is what
biases the Run's draw and what drives the Phrasebook's `refresh` flags.

### The draw

Deterministic given a seed, which is persisted on the run row so any run can be replayed exactly.

```rust
pub fn draw(deck: &[PhraseState], unlocked: &[Card], seed: u64, exclude: Option<Card>) -> Draw {
    let eligible: Vec<Card> = unlocked.iter().copied()
        .filter(|c| Some(*c) != exclude)
        .filter(|c| deck.iter().any(|p| p.rung as u8 == c.source_rung()))
        .collect();
    let mut rng = Rng::seeded(seed);
    let card = eligible.iter().copied()
        .max_by_key(|c| {
            let s: u32 = deck.iter().filter(|p| p.rung as u8 == c.source_rung())
                              .map(|p| need(p, now) + 1).sum();
            s * 100 + rng.next_u32() % 200          // small random term
        })
        .expect("at least one card is always eligible");
    let target = deck.iter().filter(|p| p.rung as u8 == card.source_rung())
                     .max_by_key(|p| need(p, now)).unwrap();
    Draw { card, target: target.id }
}
```

This is the mechanism the blueprint describes as _"a real draw, constrained to what each phrase is
ready for and biased to your weak spots. Surprise reads as fun; the targeting does the pedagogy."_
(`Loro.dc.html:1698`) — and it's worth preserving precisely, because it's the most elegant idea in
the document.

---

<a id="5-trip-drops"></a>

## 5 · Trip drops

Schedules are **data**, in `packages/content/es-ES/drops.json`, keyed by trip length
([content-model.md](../product/content-model.md#trip-drops)):

Only the data exists today. The `build_drop_schedule` function and `TripService` shown below are
target interfaces; there is no implemented drop scheduler or trip flow yet.

```jsonc
{
  "12": [ { "day": 12, "pack": "airport" }, { "day": 11, "pack": "survival" }, … ],
  "7":  [ … ],
  "3":  [ … ]
}
```

```rust
pub fn build_drop_schedule(days: u32, trip_type: TripType, schedules: &Schedules) -> Vec<Drop>
```

| Rule                                                                    |                               |
| ----------------------------------------------------------------------- | ----------------------------- |
| A drop unlocks at 06:00 local on its day                                |                               |
| **No new phrases on the final day**                                     | Review only                   |
| A missed drop stays available and merges into the next day              | Never presented as debt       |
| Future drops can be pulled forward on request                           |                               |
| The schedule is picked by nearest length and padded with review days    | Lengths 1–3, 4–7, 8–20, 21–60 |
| Trip type reorders packs but never changes the survival-first principle |                               |

The completed implementation must compute this from the device's local date so the countdown works
offline ([offline.md](offline.md)).

---

## Day boundaries

Everything above needs to agree on "today".

- **`local_day` = the device's local calendar date.** Not UTC. A learner practising at 23:50 and
  00:10 has practised on two days, which is what they'd expect.
- **Day rollover** is detected on foreground today. The completed native implementation also uses a
  scheduled local notification hook, never a polling timer.
- **Streaks** use `local_day` and a 4-hour grace window after midnight (practising at 01:30 counts
  for the previous day) — because the alternative punishes night owls, and we don't punish.

### Two day keys, not one

The grace window means there are **two** day keys in the app, and they disagree between midnight and
04:00 local. Which one a feature reads is a correctness question, not a preference:

| Key                 | Rolls at            | Read by                                                       | Why                                                                                                                                   |
| ------------------- | ------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `clock.localDay()`  | local midnight      | the Refrain's frozen set, `reps_today` / `reps_today_day`     | A learner mid-ritual must not watch today's set change under them. "You always see today" means the set is frozen per calendar day.   |
| `clock.streakDay()` | local midnight + 4h | streak history (`streak_day` rows), the widget's streak count | Practising at 01:30 is one session, not the end of one day and the start of another. Counting it twice would also inflate the streak. |

Both come from `Clock` (`packages/core/src/engines/types.ts`), which is injected — no engine and no
screen constructs a date. In the app, `apps/mobile/src/lib/clock.ts` is the **only** file that calls
`new Date()`, enforced by ESLint. It exists because the bug it replaced was one line —
`new Date().toISOString().slice(0, 10)`, a UTC date behind a contract promising a local one — that
reached every engine at once through `engineContext()`, and was invisible in a CI container running
UTC.

The arithmetic itself is `core-rs/src/calendar.rs` (`streak_day_for`, `streak_survives`, `streak`).
UniFFI already exports those functions. Production JS still uses the TypeScript mirror in
`packages/core/src/domain/calendar.ts` via `streakDayFor` in `apps/mobile/src/lib/clock.ts`; the
JSON WASM `bridge.rs` does not dispatch calendar methods. `calendar.fixtures.json` is asserted by
both languages so a divergence fails the build. Keep the TS module until plan 70 widgets call UniFFI
directly. Wall-clock ms — epoch ms shifted by the device's UTC offset — is the boundary convention:
the crate has no timezone database, so the shift happens in `clock.ts` and never in Rust.

- **Timezone travel** never breaks a streak. If the local date moves backward (flying west), the day
  is not re-counted; if it jumps forward, no day is marked missed.
- **HLC timestamps** order sync operations; `local_day` drives learner-facing day logic. They are
  separate concerns and must not be conflated ([sync-protocol.md](sync-protocol.md#time)).

---

## Testing

The implemented scheduling helpers are pure and deterministic. Test coverage currently consists of
inline Rust module tests, TypeScript engine/domain tests, calendar parity, independently reproduced
FSRS reference vectors, lossless preview compatibility and a deterministic 365-day simulation.
Mobile WASM tests exercise the same memory updates, learning steps and provenance boundary.

| Test                                                    | Location                                                                                           |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| FSRS model, lifecycle and compatibility                 | `core-rs/src/fsrs/{mod,scheduler}.rs`, `core-rs/tests/fsrs_parity.rs`                              |
| Stream rank ordering, including the due extension       | `core-rs/src/rank.rs` inline and TypeScript engine tests                                           |
| Canonical Refrain set selection and mode rules          | `packages/core/src/engines/engines.test.ts`                                                        |
| Ladder monotonicity and draw determinism/eligibility    | `core-rs/src/ladder.rs` inline                                                                     |
| Notification policy helpers                             | `core-rs/src/notify.rs` inline                                                                     |
| Day boundaries — DST, timezone travel, the grace window | `core-rs/src/calendar.rs` (inline), `core-rs/tests/parity.rs`, `apps/mobile/src/lib/clock.test.ts` |
| Interval formatting                                     | `core-rs/src/fsrs/mod.rs` inline                                                                   |

The deterministic year-long simulation is in `core-rs/tests/sim.rs`; it checks capped backlog,
lapses, bounded state and replay. Drop-schedule properties remain pending the trip scheduler.
Algorithm parity and simulations do not establish pedagogical efficacy or physical-device behavior.
