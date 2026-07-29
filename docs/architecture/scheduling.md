# Scheduling

Every "when does this come back?" and "what's next?" decision in the product. All of it lives in
`loro-core` (Rust) so iOS, Android, and the server compute identical answers
([ADR-0002](adr/0002-shared-rust-core.md)).

Five independent mechanisms, one per progress signal:

| Mechanism                               | Answers                                  | Owner                         |
| --------------------------------------- | ---------------------------------------- | ----------------------------- |
| [Stream rank](#1-stream-rank)           | What plays next in hands-free listening? | StreamEngine                  |
| [FSRS](#2-fsrs--spaced-repetition)      | When should this come back?              | SrsEngine (maintained by all) |
| [Automaticity](#3-automaticity--loop-b) | Is this phrase effortless yet?           | RefrainEngine                 |
| [The ladder](#4-the-ladder--loop-c)     | How deeply is this owned?                | RunEngine (maintained by all) |
| [Drops](#5-trip-drops)                  | What unlocks today?                      | TripService                   |

---

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

## 2 · FSRS — spaced repetition

[ADR-0004](adr/0004-fsrs-scheduler.md). FSRS (Free Spaced Repetition Scheduler) rather than SM-2 or
a hand-rolled scheme.

**Why FSRS.** The blueprint's Memory-model screen is _already_ FSRS made visible — it plots
`R(t) = 0.5^(t/S)`, marks the 50% review threshold, and shows stability in days
(`Loro.dc.html:3010–3019`). That is FSRS's model of memory, drawn. Using anything else would mean
the screen lies about the algorithm behind it. FSRS is also open, well-validated on large datasets,
and has a reference implementation we can port.

### State per phrase

```rust
pub struct FsrsState {
    pub stability: f32,        // days until retrievability falls to 0.9
    pub difficulty: f32,       // 1..10, intrinsic to the phrase for this learner
    pub due: Timestamp,
    pub last_review: Option<Timestamp>,
    pub reps: u32,
    pub lapses: u32,
    pub state: CardState,      // New | Learning | Review | Relearning
}
```

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
|                              | Strong       | `Good`, with a +10% stability bonus                                                      |
|                              | Instant      | `Easy`                                                                                   |
| Refrain rep (implicit)       | —            | `Good` if produced within 2× median latency, else `Hard`; `Again` if not produced at all |
| Speak-to-progress            | —            | `Good` on a hint-free completion; `Hard` with hints                                      |
| Prosody / pronunciation take | —            | `Good` at score ≥ 85; otherwise no FSRS write                                            |

The bottom four rows are how **rule 5** ([overview.md](overview.md#the-ten-rules)) is honoured:
every engine feeds FSRS even when it never shows an interval.

### Learner-declared difficulty as a prior

FSRS normally needs several reviews to estimate a card's difficulty. Loro knows on day zero, because
the learner said so. That's a real advantage and we use it:

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

**Re-rating adjusts, never resets.** When a learner changes a phrase from Learning to Difficult
after 20 reviews, the declared value nudges FSRS difficulty toward the new prior (a bounded ±1.0)
rather than overwriting hard-won state.

### Displayed intervals must be real

The blueprint shows fixed labels (`<5 min`, `~10 min`, `1 day`, `5 days`). Those are a display
model. **The shipped UI shows FSRS's computed intervals, formatted with the blueprint's own
formatter** (`Loro.dc.html:3009`):

```rust
pub fn format_interval(days: f32) -> String {
    if days < 0.9  { "~10 min".into() }
    else if days < 1.6 { "tomorrow".into() }
    else if days < 30.0 { format!("{} days", days.round()) }
    else { format!("{} wks", (days / 7.0).round()) }
}
```

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

Three waves (`Loro.dc.html:3306–3310`), spaced for real spacing effects. Defaults 08:00 / 13:00 /
19:00, learner-adjustable. A wave becomes `ready` at its time and `locked` before it; the day's last
wave stays available until midnight local. Missing a wave is not a failure — the reps simply move to
the next one.

### Latency

```rust
pub struct LatencySample { pub phrase_id: PhraseId, pub rep_index: u32, pub ms: Option<u32> }
```

`ms` is `Option` at the type level, which forces every caller to handle "not measured". The UI hides
the read-out on `None` rather than substituting an estimate
([audio-speech.md](audio-speech.md#recording-and-latency)). The displayed effort chart is the last 4
measured samples; unmeasured reps leave gaps rather than interpolated bars.

---

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

## 5 · Trip drops

Schedules are **data**, in `packages/content/es-ES/drops.json`, keyed by trip length
([content-model.md](../product/content-model.md#trip-drops)):

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

All computed from the device's local date, so the entire countdown works offline
([offline.md](offline.md)).

---

## Day boundaries

Everything above needs to agree on "today".

- **`local_day` = the device's local calendar date.** Not UTC. A learner practising at 23:50 and
  00:10 has practised on two days, which is what they'd expect.
- **Day rollover** is detected on foreground and by a scheduled local notification hook, never by a
  polling timer.
- **Streaks** use `local_day` and a 4-hour grace window after midnight (practising at 01:30 counts
  for the previous day) — because the alternative punishes night owls, and we don't punish.
- **Timezone travel** never breaks a streak. If the local date moves backward (flying west), the day
  is not re-counted; if it jumps forward, no day is marked missed.
- **HLC timestamps** order sync operations; `local_day` drives learner-facing day logic. They are
  separate concerns and must not be conflated ([sync-protocol.md](sync-protocol.md#time)).

---

## Testing

Scheduling is pure and deterministic, so it's the best-tested part of the system.

| Test                                                                             | Location                       |
| -------------------------------------------------------------------------------- | ------------------------------ |
| FSRS parity against the reference implementation                                 | `core-rs/tests/fsrs_parity.rs` |
| Stream rank ordering, including the due extension                                | `core-rs/tests/rank.rs`        |
| Refrain set selection — stability across a day, correct priority order           | `core-rs/tests/refrain_set.rs` |
| Ladder monotonicity under every engine's writes                                  | `core-rs/tests/ladder.rs`      |
| Draw determinism from a seed; eligibility invariants                             | `core-rs/tests/draw.rs`        |
| Drop schedules for lengths 1…90                                                  | `core-rs/tests/drops.rs`       |
| Day boundaries — DST, timezone travel, the grace window                          | `core-rs/tests/calendar.rs`    |
| Interval formatting                                                              | `core-rs/tests/format.rs`      |
| Long-horizon simulation — 365 days, 500 phrases, review load stays under the cap | `core-rs/tests/sim.rs`         |

The simulation test is the one that catches design errors rather than code errors: it's how we find
out that a scheduling change quietly creates a review wall in month four.
