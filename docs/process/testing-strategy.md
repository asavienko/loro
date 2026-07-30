# Testing strategy

What we test, where, and why. Loro's test pyramid is unusual: the interesting logic is pure and
deterministic, so most of the value is in unit tests — but the risky parts are audio and DSP, which
need real devices and human ears.

---

## The shape

```
                   ▲  Manual on real devices
                  ╱ ╲    audio · interruptions · battery · screen readers
                 ╱   ╲   the airplane-mode test · native-speaker score validation
                ╱─────╲
               ╱  E2E  ╲   ~15 Maestro flows, both platforms
              ╱─────────╲
             ╱ Component ╲   ~120 tests, RNTL with faked platform modules
            ╱─────────────╲
           ╱  Integration  ╲   ~80 tests, real SQLite, real engines, real merge
          ╱─────────────────╲
         ╱       Unit        ╲   ~600 tests, mostly loro-core + engines
        ╱─────────────────────╲
```

**Why unit-heavy is right here.** The scheduler, the merge, the ranking, the mode rotation, the
draw, the notification policy, and the DSP are all pure functions of injected state. They are the
highest-consequence code in the product and they need no simulator. Meanwhile a component test of
the Refrain screen tells you almost nothing about whether the warming card feels right — that needs
a device and an eye.

---

## Unit tests

### `packages/core-rs` — Rust · the highest-value tests in the repo

```
core-rs/tests/
├── fsrs_parity.rs      # against the reference implementation
├── rank.rs             # stream rank ordering, incl. the due extension
├── refrain_set.rs      # selection priority, stability across a day
├── ladder.rs           # monotonicity under every engine's writes
├── draw.rs             # determinism from a seed; eligibility invariants
├── drops.rs            # schedules for trip lengths 1..90
├── calendar.rs         # DST, timezone travel, the streak grace window
├── hlc.rs              # monotonicity under clock jumps
├── merge.rs            # commutativity, idempotency, tombstone precedence
├── asr_match.rs        # order, insertions, monotonic progress, accents
├── format.rs           # interval formatting
├── notify.rs           # caps, quiet hours, conditional waves, skip-if-practised
├── sim.rs              # 365-day / 500-phrase simulation
└── golden/             # ~50 recorded utterances + expected DSP output
```

Three of these deserve attention:

**`sim.rs`** — a 365-day simulation over 500 phrases, asserting review load stays under the daily
cap and no phrase starves. This catches _design_ errors rather than code errors: it's how you find
out that a scheduling tweak quietly creates a review wall in month four.

**`merge.rs`** — commutativity (`merge(a,b) == merge(b,a)` for LWW and max classes) and idempotency.
If these hold, client and server cannot diverge, which is the whole point of
[ADR-0002](../architecture/adr/0002-shared-rust-core.md).

**`golden/`** — ~50 real recordings with committed expected outputs. Any DSP change that moves a
score beyond the stability threshold **fails CI**, and re-baselining requires an explanation in the
PR ([code-review.md](code-review.md#special-review-paths)). This is what prevents silent scoring
drift.

Plus Criterion benchmarks, gated at a 10% regression
([`../architecture/performance.md`](../architecture/performance.md#loro-core-rust)).

### `packages/core` — TypeScript

- Zod schema round-trips for every API contract
- **`fieldPolicy.test.ts` — fails if any syncable field lacks a declared merge class.** This turns
  "added a field without thinking about sync" from a subtle data-loss bug into a build failure
- The engine conformance suite (below)
- Pure helpers: normalisation, formatting, bucketing

### `apps/mobile/src/engines` — the conformance suite

Every engine runs the same suite against a seeded in-memory store
([`../architecture/practice-engines.md`](../architecture/practice-engines.md#conformance)):

| Test                      | Asserts                                                               |
| ------------------------- | --------------------------------------------------------------------- |
| `plan()` is read-only     | No mutation during planning                                           |
| Determinism               | Same store + clock + seed → identical plan                            |
| No ambient nondeterminism | `Date.now`/`Math.random` stubbed to **throw**; the engine still works |
| Universal signals         | Any success yields `reps`, `lastPracticedAt`, and an FSRS update      |
| Ladder monotonicity       | `rung` never decreases                                                |
| **Latency honesty**       | `latencyMs` is measured or `null` — never a computed estimate         |
| Idempotent replay         | Same attempt id twice → same final state                              |
| Interruption safety       | Kill after any `record()` → consistent state                          |
| Empty store               | Empty plan, usable empty state, no error                              |
| Closed sessions terminate | `next()` eventually returns `null`                                    |

An engine isn't done until it passes ([definition-of-done.md](definition-of-done.md)).

---

## Integration tests

Real SQLite (in-memory), real repositories, real engines, real `loro-core`. Faked: audio, speech,
network.

| Area                      | Tests                                                                                                                                                                                          |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **The connective thread** | Rate a phrase Difficult → assert the stream queue reorders, the review card type changes, and the Progress rollup updates. _This is the product's central mechanic; it gets a dedicated test._ |
| Repositories              | Write + outbox in one transaction; rollback on failure                                                                                                                                         |
| Live queries              | A write propagates to a subscriber                                                                                                                                                             |
| Migrations                | From every released schema version, with a 2 000-phrase fixture                                                                                                                                |
| Outbox                    | Ordering, compaction, dead-lettering                                                                                                                                                           |
| Trip lifecycle            | State transitions from device dates, including a date in the past                                                                                                                              |
| Content sync              | Diff application, deprecations, `full_resync_required`                                                                                                                                         |
| Day rollover              | `reps_today` reset, refrain set stability, streak grace window                                                                                                                                 |

### API

| Area                      | Tests                                                                                   |
| ------------------------- | --------------------------------------------------------------------------------------- |
| Sync push/pull            | Idempotency, batching, rejections                                                       |
| **Two-device simulation** | Concurrent edits, partition, reconvergence                                              |
| **Sign-in merge**         | Both cases, with overlapping libraries — assert nothing lost                            |
| 30-day offline replay     | Convergence, no data loss                                                               |
| AI endpoints              | Cache hit/miss, validation failure → repair → fallback, budget breach → silent fallback |
| Auth                      | Token rotation, refresh reuse detection, magic-link non-enumeration                     |
| Tenant isolation          | Cross-user reads 404                                                                    |
| Content endpoints         | Manifest ETag, diff correctness                                                         |

The sign-in merge test is non-negotiable. Losing a learner's library on sign-in is the worst bug
this product can have.

---

## Component tests

React Native Testing Library, with `src/platform/*` faked.

**Test behaviour, not implementation.**

```ts
// ✅
it('locks Next until the whole phrase is produced', async () => {
  render(<SpeakScreen phrase={phrase} />)
  fakeSpeech.emitFinal('dónde está')          // 2 of 4 words
  expect(screen.getByText('Say it to unlock')).toBeDisabled()
  fakeSpeech.emitFinal('dónde está el baño')
  expect(screen.getByText('Next phrase')).toBeEnabled()
})

// ❌ — asserts internals; passes when the feature is broken
it('sets revealed state to 4', () => { expect(store.revealed).toBe(4) })
```

Priorities:

- Every `sc-if` state from the blueprint renders
- Gates behave (locked until produced)
- Empty states
- Long content doesn't break the blueprint's tight rows
- Reduced-motion snapshots
- Dynamic Type at 5 scale steps

---

## E2E — Playwright web + Maestro devices

The implemented app surface has a Playwright behavior gate in `apps/mobile/e2e/` — **61 tests, about
80 seconds**. It starts Expo Web itself, uses a phone-sized viewport, and creates all state through
learner-visible interactions. Run it with `pnpm test:e2e` after the one-time
`pnpm test:e2e:install`. CI runs it as the required `mobile web E2E` job.

Playwright answers the refactoring question — do the screens, gates, mutations, navigation and
cross-screen rollups still behave the same? — and, since
[plan 51](../../plans/51-extended-e2e-strategy.md), four questions a route-by-route suite could not
ask at all. It still does not answer native questions. Maestro remains the device-level layer for
audio, speech, persistence/resume, widgets, and real offline operation once those modules exist.

### The axes the gate varies

| Axis                       | Covers                                                                                                |
| -------------------------- | ----------------------------------------------------------------------------------------------------- |
| Behavior, per screen       | Every implemented route, its states, and the mutations between them                                   |
| **The clock**              | Both day keys, the streak grace window either side, DST, rollover at every reachable call site        |
| **Multi-day time**         | Streaks past two days, a missed day, graduation over four lock-in days — consecutive and not          |
| **The rendered a11y tree** | axe over every state, `aria-checked`, named progress bars, live regions, 44 px targets, keyboard-only |
| **Text size**              | 200% and 310%, text only: no clipping, no horizontal scroll, nothing pushed out of reach              |
| **The production bundle**  | The `@smoke` subset against `expo export --platform web`, not the dev server                          |
| The contract itself        | Every route has a state, every state cites a spec section                                             |

**States, not routes.** `apps/mobile/e2e/states.ts` lists each learner-visible state and how to
reach it; the accessibility, text-scale and manifest suites all read it. A route is a file, not a
unit of behaviour — `/add` counted as covered while its tagging sheet had never been rendered, and a
critical `aria-checked` defect sat inside a screen the old contract called green.

**Recorded exceptions, never silent ones.** Exactly one axe rule is waived, with its reason, because
it asks for a `tabindex` that a native `ScrollView` does not need. One contrast violation is
recorded per state and per rule — **Q-14** — so a different violation there still fails, and so does
that one disappearing.

**What web cannot verify.** react-native-web forwards neither `accessibilityLanguage` nor
`accessibilityHint`, so `lang="es-ES"` is absent from the DOM however correct the source is. That is
why `check:lang` scans source, and why no green E2E run is evidence about it.

### Future Maestro device flows

~15 flows, on both platforms, in CI on a device farm.

| Flow                                           | Covers                             |
| ---------------------------------------------- | ---------------------------------- |
| Onboard → first practice                       | The whole first-run path           |
| Add a phrase → tag it → see it in the stream   | The connective thread, end to end  |
| Import a pasted list                           | Parsing, per-row selection, commit |
| A full Refrain wave, 5 phrases                 | The v1 hero loop                   |
| Speak to progress with faked ASR               | The production gate                |
| A review session to completion                 |                                    |
| **Airplane mode: onboard → add → practise**    | The offline guarantee              |
| Trip: create → drop → survival → souvenir      | The full arc                       |
| Sign in with existing data                     | The merge path                     |
| Deep links from each notification type         | Landing on the right screen        |
| Rate in the stream → check Progress            | Cross-screen propagation           |
| Widget tap → phrase plays                      |                                    |
| Force-quit mid-wave → resume                   | Session persistence                |
| 2 000-phrase library: scroll, search, practise | Scale                              |
| Paywall at the 61st phrase                     |                                    |

E2E is the least valuable test per minute spent, so the list stays short and covers **paths**, not
permutations.

---

## Manual, on real devices

The tests that cannot be automated, and they cover the riskiest parts of the product.

| Test                                           | Frequency                 | Why manual                                |
| ---------------------------------------------- | ------------------------- | ----------------------------------------- |
| **The airplane-mode test**                     | Every release             | Timing on a cold launch with a cold cache |
| **Audio interruption matrix**                  | Every release             | The simulator lies about audio sessions   |
| 40-minute background stream soak               | Every release             | Leaks and route changes over time         |
| **The warming card at 60 fps**                 | Every release             | A stutter is only visible to an eye       |
| Battery and thermals                           | Every release             |                                           |
| Screen readers (VoiceOver, TalkBack)           | Every release             | Judgement about whether it makes sense    |
| Live Activity lifecycle                        | Every release             | Simulator behaviour is untrustworthy      |
| Offline widget playback from the lock screen   | Every release             |                                           |
| **Native-speaker score validation**            | Before M3, then quarterly | Requires a human ear                      |
| **The trip test** — 5 real people, a real trip | Before v1                 | Requires a real trip                      |
| Copy audit against the forbidden list          | Every release             | Judgement                                 |

Two of these are release gates rather than checks: the airplane-mode test and, for M3,
native-speaker agreement ≥80%
([`../architecture/prosody-dsp.md`](../architecture/prosody-dsp.md#validation)).

---

## What we don't test

| Not tested                                     | Why                                                                        |
| ---------------------------------------------- | -------------------------------------------------------------------------- |
| Third-party library internals                  | Not ours                                                                   |
| Every permutation of difficulty × tag × engine | Combinatorial; the interesting combinations are covered by the thread test |
| Exact pixel positions                          | Brittle; design fidelity is a human review against the blueprint           |
| Generated code                                 | Its generator is tested; drift is CI-checked                               |
| Getters and pass-throughs                      | No behaviour to assert                                                     |
| ASR accuracy                                   | Not ours to control. We test our **matching** exhaustively instead         |
| TTS quality                                    | Same; we test caching and fallback                                         |

---

## Coverage

**No global coverage target.** Coverage percentages drive tests toward trivial code and away from
hard code. Instead, per-area expectations:

| Area                                 | Expectation                                       |
| ------------------------------------ | ------------------------------------------------- |
| `core-rs` scheduler, merge, matching | Every branch, plus golden and property tests      |
| `core-rs` DSP                        | Golden tests + validation against human judgement |
| Engines                              | Full conformance + selection/sequencing rules     |
| `core/sync`                          | Every field's merge class; commutativity          |
| Repositories, migrations             | Every path, incl. failure                         |
| Features / UI                        | Every `sc-if` state, gates, empty states          |
| Native modules                       | Contract tests + a manual matrix                  |
| Utilities                            | Where behaviour is non-obvious                    |

CI reports coverage as information. It does not gate on a number.

---

## Test data

`packages/core/src/testing/` provides:

- **`seedFixture`** — the blueprint's own `LORO_SEED`: 10 phrases with real difficulties, tags, and
  rep counts (`Loro.dc.html:2873–2884`). The default for most tests, because it exercises every
  difficulty and tag combination that matters.
- **`largeFixture`** — 2 000 phrases, for performance and scale tests.
- **`emptyFixture`** — nothing, for empty-state tests.
- **`tripFixture`** — a 12-day countdown mid-flight.
- **`fakeClock`** — injectable, advanceable, timezone-settable.
- **`fakeAudio` / `fakeSpeech` / `fakeOcr`** — the platform module fakes.
- **`recordings/`** — real audio for DSP golden tests, with a licence note and speaker consent
  recorded.

**No test uses the real clock, real randomness, or the network.** The engines' conformance suite
stubs `Date.now` and `Math.random` to _throw_, which is how we know they're genuinely deterministic
rather than accidentally passing.
