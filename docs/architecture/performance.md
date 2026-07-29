# Performance budgets

Every budget here is measured, on the device floor, in CI or in a scripted manual pass. A budget
with no measurement is a wish.

**Device floor** — all p95 targets are on these, not on flagships:

|         | Device                            | Rationale                           |
| ------- | --------------------------------- | ----------------------------------- |
| iOS     | iPhone SE (3rd gen), iOS 16       | Oldest supported, slowest supported |
| Android | Pixel 6a / Galaxy A54, Android 10 | Mid-range volume devices            |

Full matrix: [`process/qa-device-matrix.md`](../process/qa-device-matrix.md).

---

## Startup

| Metric                                         | Budget          | Measured by                                    |
| ---------------------------------------------- | --------------- | ---------------------------------------------- |
| Cold start → first paint                       | p95 ≤ 1.2 s     | Native trace, automated in CI on a device farm |
| Cold start → interactive (home usable)         | p95 ≤ 1.8 s     | Same                                           |
| **Cold start → survival mode usable, offline** | **p95 ≤ 2.0 s** | Scripted manual pass, every release            |
| Warm start → interactive                       | p95 ≤ 0.5 s     |                                                |
| Time to first audio playable                   | p95 ≤ 2.5 s     |                                                |

**What's on the critical path:** fonts, design tokens, DB open, migration check, and the resolved
home route. **What isn't:** content sync, audio prefetch, analytics flush, sync, entitlement
refresh, widget publish. Splash is held only for the first list.

The survival-mode row is a release gate, not a target
([offline.md](offline.md#the-acceptance-test)).

---

## Frame rate

| Surface                            | Budget                                            |
| ---------------------------------- | ------------------------------------------------- |
| All scrolling                      | 60 fps, zero dropped frames over a 5 s scroll     |
| **The warming card transition**    | 60 fps for the full 500 ms, always                |
| Pitch contour trace playback       | 60 fps                                            |
| Sheet present / dismiss            | 60 fps                                            |
| Equalisers, beat bars, pulse rings | 60 fps, and **≤ 3% CPU** while running            |
| Any animation while audio plays    | 60 fps — a dropped frame here is a visible defect |

**Why the warming card gets its own row.** It _is_ the Refrain's feedback signal
([functional-spec.md](../product/functional-spec.md#12-the-refrain)). A stutter during it doesn't
look like a slow app; it looks like the app didn't notice the learner's rep. It runs on the UI
thread via Reanimated, and it is checked on the device floor every release.

---

## Interaction latency

| Interaction                              | Budget       | Notes                                                                      |
| ---------------------------------------- | ------------ | -------------------------------------------------------------------------- |
| Tap → visual feedback                    | ≤ 50 ms      | Press scale is a UI-thread animation, so this is essentially free          |
| Tap → audio starts (cached)              | p95 ≤ 120 ms | Perceptual threshold for "instant"                                         |
| Tap → audio starts (needs decode)        | p95 ≤ 250 ms |                                                                            |
| Mic tap → listening                      | p95 ≤ 200 ms | Session already active, so no session setup cost                           |
| Speech end → word un-blurs               | p95 ≤ 400 ms | Dominated by ASR finalisation                                              |
| **Take end → prosody score shown**       | p95 ≤ 600 ms | DSP budget is 200 ms ([prosody-dsp.md](prosody-dsp.md#performance-budget)) |
| Take end → pronunciation score           | p95 ≤ 600 ms |                                                                            |
| Grade tap → next card                    | ≤ 100 ms     | Local FSRS write, no network                                               |
| Rate tap → queue reordered visibly       | ≤ 100 ms     | Live query propagation                                                     |
| Add phrase → appears in the stream strip | ≤ 100 ms     |                                                                            |
| Navigate to phrase detail                | ≤ 150 ms     |                                                                            |

**The 600 ms scoring budget** has 400 ms of headroom over the 200 ms DSP budget. That's deliberate:
on a slow device the score still arrives before the screen feels broken, and the blueprint's
`processing` state gives the wait a home.

---

## Data-layer

Measured against a **2 000-phrase library**, which is the design target (Ana, moving abroad, at 12
months — [data-model.md](data-model.md#data-volume)).

| Operation                                                 | Budget   |
| --------------------------------------------------------- | -------- |
| Load today's Refrain set                                  | ≤ 10 ms  |
| Build the stream queue (rank + sort, 2 000 rows)          | ≤ 25 ms  |
| Build an SRS deck (due query)                             | ≤ 20 ms  |
| Search Discover (accent-insensitive, 600 catalog rows)    | ≤ 15 ms  |
| Write a rating (update + outbox, one tx)                  | ≤ 8 ms   |
| Progress screen rollups (mastery buckets + tag histogram) | ≤ 40 ms  |
| Phrasebook with ladder distribution                       | ≤ 50 ms  |
| Live query propagation, write → rendered                  | ≤ 50 ms  |
| Migration, 2 000 phrases                                  | ≤ 500 ms |

Enabled by: `op-sqlite` over JSI (synchronous, no bridge hop), prepared statements on the hot path,
the partial indexes in [data-model.md](data-model.md), and a `catalog_search` table with
pre-normalised columns so Discover never normalises at query time.

---

## `loro-core` (Rust)

Called synchronously from JS for anything in this table, so these budgets are tight.

| Function                                | Budget   |
| --------------------------------------- | -------- |
| `stream_rank` (per phrase)              | ≤ 1 µs   |
| `fsrs_next_interval`                    | ≤ 10 µs  |
| `select_refrain_set` (2 000 candidates) | ≤ 2 ms   |
| `match_tokens` (ASR matching)           | ≤ 50 µs  |
| `cloze_mask`                            | ≤ 20 µs  |
| `merge_row` (sync)                      | ≤ 20 µs  |
| `draw` (Loop C, 500-phrase deck)        | ≤ 500 µs |
| `plan_notifications`                    | ≤ 1 ms   |
| **`extract_pitch` (2 s audio)**         | ≤ 60 ms  | _async, native thread_ |
| **`align_dtw` (2 s audio)**             | ≤ 80 ms  | _async, native thread_ |
| `score_take` (full pipeline)            | ≤ 200 ms | _async, native thread_ |

Benchmarked with Criterion in CI on every PR touching `core-rs`; a >10% regression fails the build.

---

## Memory

| Budget                                 |                                             |
| -------------------------------------- | ------------------------------------------- |
| Steady-state RSS, practice screen      | ≤ 180 MB                                    |
| Peak during DSP scoring                | ≤ 260 MB                                    |
| Peak during background stream playback | ≤ 90 MB                                     |
| No leak over a 40-minute stream soak   | RSS growth ≤ 5 MB                           |
| PCM buffer lifetime                    | Released within 50 ms of scoring completion |

That last row is both a memory budget and a privacy control — a retained PCM buffer is a promise
waiting to be broken ([security-privacy.md](security-privacy.md)).

---

## Battery and thermals

| Budget                                       |                                  |
| -------------------------------------------- | -------------------------------- |
| Stream playback, screen off                  | ≤ 4% battery / hour              |
| Refrain session, screen on                   | ≤ 12% battery / hour             |
| Ambient loop, screen off, 2 hours            | ≤ 8% total                       |
| No thermal throttling in a 30-minute session | Measured on the device floor     |
| Background CPU when idle                     | ~0% — no polling timers anywhere |

"No polling timers anywhere" is an architectural commitment: playback advances on audio callbacks,
day rollover is detected on foreground and by a scheduled hook, and sync is triggered by events. The
blueprint's 80 ms `setInterval` (`Loro.dc.html:2521`) is prototype-only and must not survive into
the app.

---

## Bundle and install

| Budget                             |                               |
| ---------------------------------- | ----------------------------- |
| iOS download size                  | ≤ 60 MB                       |
| Android download size              | ≤ 45 MB (AAB, per-ABI split)  |
| Install size after bundled content | ≤ 120 MB                      |
| JS bundle (Hermes bytecode)        | ≤ 4 MB                        |
| Bundled audio snapshot             | ≤ 12 MB (~50 starter phrases) |
| `loro-core` binary contribution    | ≤ 3 MB per ABI                |

Levers: Hermes, inline requires, per-ABI splits, and lazy imports for the Skia-heavy lab screens so
a v1 learner who never opens the prosody lab doesn't pay for it.

---

## Network

| Budget                               |                                 |
| ------------------------------------ | ------------------------------- |
| Sync push (typical session)          | ≤ 15 KB                         |
| Sync pull (typical)                  | ≤ 20 KB                         |
| Content manifest                     | ≤ 2 KB, `ETag`-cached           |
| Content diff (typical update)        | ≤ 100 KB                        |
| Full catalog cold download           | ≤ 900 KB metadata + ~7 MB audio |
| Audio per phrase                     | ≤ 15 KB                         |
| Roleplay scene                       | ≤ 6 KB                          |
| **Daily data for an active learner** | **≤ 250 KB**                    | Excluding first-run and audio prefetch |

The daily figure matters for the primary persona: a traveller on an expensive roaming plan should
not notice Loro on their data bill.

---

## Server

SLOs in [backend.md](backend.md#slos). Budgets:

| Endpoint                                | p95    | p99    |
| --------------------------------------- | ------ | ------ |
| `POST /sync/push`                       | 400 ms | 900 ms |
| `POST /sync/push`, 2 000-phrase library | 800 ms | 1.5 s  |
| `POST /sync/pull`                       | 300 ms | 700 ms |
| `GET /content/manifest`                 | 100 ms | 250 ms |
| `GET /content/diff`                     | 250 ms | 600 ms |
| `POST /ai/scene`, cache hit             | 200 ms | 400 ms |
| `POST /ai/scene`, generated             | 3 s    | 8 s    |
| `POST /analytics/batch`                 | 150 ms | 400 ms |

---

## How each is measured

| Budget class                          | Mechanism                                                   | Gate                           |
| ------------------------------------- | ----------------------------------------------------------- | ------------------------------ |
| Startup, frame rate                   | Device-farm run on every PR to `main`                       | Blocks merge on regression     |
| `loro-core`                           | Criterion benches in CI                                     | >10% regression fails          |
| Data layer                            | Benchmark suite against a generated 2 000-phrase fixture DB | Blocks merge                   |
| Interaction latency                   | Instrumented in-app timings, sampled in production          | Alert on p95 regression        |
| Memory, battery, thermals             | Scripted manual pass on the device floor                    | Every release                  |
| Bundle size                           | CI size check with a committed baseline                     | Blocks merge on >5% growth     |
| Network                               | Proxy capture during the E2E suite                          | Reported, reviewed per release |
| Server                                | OTel traces, dashboards, alerting                           | Error-budget policy            |
| **Survival mode cold start, offline** | Scripted manual pass                                        | **Release gate**               |

---

## Regression policy

1. A budget regression is a **bug**, not a trade-off to be negotiated in review.
2. CI-gated budgets (startup, `core-rs`, data layer, bundle size) block merge.
3. Production-measured budgets (interaction latency) alert on a p95 shift; investigation starts the
   same day.
4. Manual-pass budgets (memory, battery, thermals, survival cold start) block the release.
5. Raising a budget requires a documented reason in the PR and sign-off from whoever owns the
   surface.
6. **Baselines are committed** so a slow drift across ten PRs is caught, which is how performance is
   usually actually lost.
