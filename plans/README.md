# Plans

One markdown file per plan, numbered then named for the topic — `01-fix-local-day-boundary.md`. The
numbers run consecutively in the recommended order below, and a new plan takes the next free number.
**Numbers are never reused**, so a gap in the sequence is expected and a link written against a
number stays unambiguous.

The current-state claims below were re-verified against the worktree on **2026-07-29**, including
uncommitted implementation. Code citations can move, so each plan names the symbol or invariant as
well as the line where practical.

Each focused plan has a bounded outcome, acceptance criteria, tests, and an explicit out-of-scope
section. A plan with dependencies is runnable only after those dependencies' relevant acceptance
criteria pass. Plan 45 is the deliberate exception: it is a provider-integration programme and
reference map; the focused plans own implementation.

## Status

A shipped plan is **marked, not deleted**: its verified "current state" notes and code citations are
the record of why the code looks the way it does. The plan's own header carries the authoritative
`**Status:**` line — what landed, what was skipped, and anything the plan turned out to have got
wrong. The tables below mirror it:

| Mark | Meaning                                                                          |
| ---- | -------------------------------------------------------------------------------- |
| ✅   | Implemented. Read the plan's `Status` line for anything deliberately left out.   |
| 🟡   | Partly implemented. Its `Status` line names what is left **and what blocks it**. |
| —    | Not started.                                                                     |

**Completed plans are skipped by the active queue:** [01](01-fix-local-day-boundary.md),
[02](02-fix-fabricated-streak.md), [04](04-fix-user-phrase-identity.md), and
[07](07-fix-store-invariants.md). They remain on disk as implementation records.

**Partly implemented:** [10](10-sqlite-persistence-and-outbox.md) — storage primitives are done;
native wiring waits on [09](09-native-toolchain-and-dev-client.md) — [20](20-screen-today-ritual.md)
— the Today route/layout and basic store integration landed, while wave/completion/resume behaviour
follows persistence and audio — [23](23-add-import-and-capture.md) — the own-phrase domain/store
seam landed, while Import and Capture surfaces remain — and [37](37-testing-gaps.md) — calendar
parity, mobile domain/data tests, and whole-current-app Playwright coverage are done; component,
blueprint-fidelity, simulation, property, and native device suites remain.

## Active execution order

1. Finish the remaining correctness defects: **03, 05, 06**.
2. Run **08** before porting more screens; its findings update the relevant screen plan rather than
   creating an unowned backlog. Land **46**'s route table and laws alongside it — thirteen unbuilt
   screens each need a route, a class, and an exit, and deciding that per screen is how the eleven
   defects 46 records were introduced.
3. Establish **09**, then finish **10** and start the native/audio path (**11**, **12**).
4. Build server foundations in dependency order: **13 → 14 → 15**, with **06** supplying the safe
   temporary identity boundary before auth lands.
5. Treat the later screen and cross-cutting tables as milestone scope, not as permission to bypass
   their named foundation, decision, or research gates.

---

## Start here: the three remaining bugs

These are defects in code that already exists, and they get more expensive once persistence lands.
The four completed bug plans are retained as implementation records but omitted from this table.

| Plan                                                                          | What is wrong                                                                                                                                                       | Size |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| [03-fix-latency-measurement](03-fix-latency-measurement.md)                   | Wall-clock used where the comment claims monotonic; `applyDeltaToPhrase` drops the measured sample; the display floor turns 120 ms into `0.3s`. **Violates rule 2** | M    |
| [05-fix-shared-maths-duplication](05-fix-shared-maths-duplication.md)         | Numbers ADR-0002 says must exist once have two or three implementations; two are outright fabrications (`fsrsReview`, `clozeMask: () => [1]`)                       | M–L  |
| [06-fix-sync-pull-cursor-and-scoping](06-fix-sync-pull-cursor-and-scoping.md) | `/sync/pull` ignores its cursor, hardcodes `has_more: false`, and shares one global `Map` across all learners — a cross-tenant read                                 | M    |

Then [08-built-screens-fidelity-audit](08-built-screens-fidelity-audit.md) — read the seven ported
screens and app shell against the blueprint. Every bug above came from that kind of reading.

---

## The unblocker

[09-native-toolchain-and-dev-client](09-native-toolchain-and-dev-client.md) — there is no
`apps/mobile/ios` or `android/`, and Expo Go works today only because no custom native module is
installed. **Audio, speech, SQLite, the UniFFI bridge, and widgets all end Expo Go compatibility**,
so this decides whether half the product can be built at all. Run it before any of them.

---

## Foundations — the things half of v1 depends on

| Plan                                                                       | Why                                                                                                                              | Size |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---- |
| [10-sqlite-persistence-and-outbox](10-sqlite-persistence-and-outbox.md) 🟡 | Schema, repositories and outbox are tested; the app still needs the native driver, HLC bridge and hydration/write-through wiring | L    |
| [11-audio-playback-module](11-audio-playback-module.md)                    | No audio anywhere. The Refrain currently tells the learner the rate at which nothing plays                                       | L    |
| [12-asr-speech-module](12-asr-speech-module.md)                            | Nothing records. The matcher is already built and tested in Rust; everything upstream is missing                                 | L    |
| [13-api-postgres-persistence](13-api-postgres-persistence.md)              | The API stores nothing; readiness honestly omits absent dependencies but needs real Postgres/Redis checks when they land         | L    |
| [14-auth-anonymous-first](14-auth-anonymous-first.md)                      | No auth at all, no user scoping, nothing to rate-limit the AI endpoints against                                                  | L    |
| [15-sync-client-loop](15-sync-client-loop.md)                              | The merge is real and shared; there is no client                                                                                 | L    |
| [16-ci-cd-and-release](16-ci-cd-and-release.md)                            | The API is deployed nowhere — an unmet M0 exit criterion. CI never compiles native                                               | M–L  |

---

## Reproducible maths (`packages/core-rs`)

Seven `todo!`s, each standing under a screen.

| Plan                                                                            | The gap                                                                                         | Size      |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | --------- |
| [17-fsrs-implementation-and-parity](17-fsrs-implementation-and-parity.md)       | The FSRS update is `todo!`; the app ships a four-interval lookup table in its place             | M         |
| [18-select-rs-cloze-and-set-selection](18-select-rs-cloze-and-set-selection.md) | Cloze mask and set selection are `todo!`; the stand-in always blanks token 1                    | M         |
| [19-prosody-dsp-spike-and-pipeline](19-prosody-dsp-spike-and-pipeline.md)       | Four `todo!`s in `dsp/`. **Run the M1 spike first** — it decides whether the labs are buildable | M then XL |

---

## Screen work

| Plan                                                                      | Screens                                                  | Rel       | Size  |
| ------------------------------------------------------------------------- | -------------------------------------------------------- | --------- | ----- |
| [20-screen-today-ritual](20-screen-today-ritual.md) 🟡                    | 11 — Today (route/layout landed; behaviour incomplete)   | v1        | M     |
| [21-screen-speak-to-progress](21-screen-speak-to-progress.md)             | 5 — the production gate                                  | v1        | M     |
| [22-trip-arc-screens](22-trip-arc-screens.md)                             | 16–21 — the whole arc                                    | **v1**    | XL    |
| [23-add-import-and-capture](23-add-import-and-capture.md) 🟡              | 2 — own-phrase seam landed; Import and Capture UI remain | v1 / v1.1 | M / L |
| [24-screen-review-session](24-screen-review-session.md)                   | 6 — tag-aware SRS                                        | v1.1      | M     |
| [25-screen-memory-model](25-screen-memory-model.md)                       | 8 — the forgetting curve                                 | v1.1      | M     |
| [26-screen-roleplay-and-ai](26-screen-roleplay-and-ai.md)                 | 7 — roleplay, and the live provider                      | v1.1      | L     |
| [27-labs-pronunciation-and-prosody](27-labs-pronunciation-and-prosody.md) | 9 & 10 — highest technical risk in the project           | v1.1      | XL    |
| [28-screens-run-and-phrasebook](28-screens-run-and-phrasebook.md)         | 13 & 14 — **conditional on M3 data and Q-05**            | v2        | XL    |
| [29-settings-and-engine-switching](29-settings-and-engine-switching.md)   | Settings, which does not exist at all                    | v1        | M     |

---

## Cross-cutting

| Plan                                                                | Why now                                                                                                                                                                                                           | Size |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| [30-widgets-and-notifications](30-widgets-and-notifications.md)     | The policy is written and tested in Rust; nothing calls it                                                                                                                                                        | L    |
| [31-offline-survival-mode](31-offline-survival-mode.md)             | The first M2 exit criterion: airplane mode, fresh launch, usable in <2 s                                                                                                                                          | L    |
| [32-observability-and-analytics](32-observability-and-analytics.md) | Crash reporting is unwired (unmet M0 item), and three open questions are unanswerable without instrumentation                                                                                                     | M–L  |
| [33-experimentation-and-flags](33-experimentation-and-flags.md)     | Four flags exist in code and cannot be set. **Q-05 blocks M3 start** and its measure cannot be retro-fitted                                                                                                       | M    |
| [34-design-system-completion](34-design-system-completion.md)       | ~15 of ~40 components exist; 11 animations are specified and almost none implemented                                                                                                                              | M–L  |
| [35-accessibility-wcag-pass](35-accessibility-wcag-pass.md)         | Four gates already run in CI. **Q-14 is holding the hero screen's peak state**                                                                                                                                    | M–L  |
| [36-content-scale-to-600](36-content-scale-to-600.md)               | 31 phrases, no audio. Gates the labs and the audio module, not just the catalog                                                                                                                                   | L    |
| [37-testing-gaps](37-testing-gaps.md) 🟡                            | Calendar parity, mobile domain/data tests, and every current web route have coverage; simulation, properties, component/blueprint fixtures, and native E2E remain                                                 | M    |
| [38-performance-budget-harness](38-performance-budget-harness.md)   | One budget of many is enforced. The <2 s bar is unmeasured                                                                                                                                                        | M    |
| [39-security-hardening-api](39-security-hardening-api.md)           | No validation pipeline, no rate limits, no guards                                                                                                                                                                 | M    |
| [40-monetization-paywall](40-monetization-paywall.md)               | **Q-08 blocks v1 launch** and needs research before code                                                                                                                                                          | L    |
| [41-docker-and-compose](41-docker-and-compose.md)                   | **The API image build cannot succeed** — it `COPY`s a gitignored directory the deploy workflow never builds. Plus no `.dockerignore`, floating tags, and compose binding Postgres to `0.0.0.0`                    | M    |
| [42-incident-response-and-slos](42-incident-response-and-slos.md)   | The doc exists; nothing is wired. Offline-first changes what the SLOs should measure                                                                                                                              | M    |
| [43-ui-localization](43-ui-localization.md)                         | Scaffolding is cheap now and expensive across 21 screens later                                                                                                                                                    | M    |
| [44-docs-drift-cleanup](44-docs-drift-cleanup.md)                   | Onboarding, README and testing docs advertise commands, paths or suites that do not exist; volatile counts have already diverged                                                                                  | S    |
| [45-api-integrations](45-api-integrations.md)                       | Provider-side contracts, credentials, and verification for the LLM, TTS, STT, auth, billing, storage, and observability vendors (pre-existing plan; complements the app-side module plans above)                  | L    |
| [46-navigation-system](46-navigation-system.md)                     | Eight routes, each wired by the screen that needed it. Nothing owns the route map for 21 screens — so eleven verified defects, and thirteen screen plans with no header, exit, or entry contract to build against | M–L  |

---

## Blocked on a decision, not on engineering

Seven open decisions block work in the plans below — five filed in
`docs/decisions/open-questions.md`, and two (Q-15, Q-16) proposed by these plans and **not yet
filed**, which is itself an action. Each plan says so in its own text rather than building around
the gap:

| Question                                                                                               | Blocks                                                       | Plan                                                                                                                               |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Q-05** — who owns the loop decision (🔴, blocks M3 start)                                            | The loop experiment; the cold probe cannot be retro-fitted   | [33-experimentation-and-flags](33-experimentation-and-flags.md), [28-screens-run-and-phrasebook](28-screens-run-and-phrasebook.md) |
| **Q-08** — pricing (🔴, blocks v1 launch)                                                              | The paywall's contents                                       | [40-monetization-paywall](40-monetization-paywall.md)                                                                              |
| **Q-07** — how trip mode serves "moving abroad"                                                        | The arrival screen's data model                              | [22-trip-arc-screens](22-trip-arc-screens.md)                                                                                      |
| **Q-14** — the Refrain peak subtitle's contrast                                                        | The v1 hero screen's reward moment                           | [35-accessibility-wcag-pass](35-accessibility-wcag-pass.md)                                                                        |
| **Q-11** — rename the blueprint folder                                                                 | Nothing, but it gets costlier every week                     | [44-docs-drift-cleanup](44-docs-drift-cleanup.md)                                                                                  |
| **Q-15** (proposed) — is there a cloud ASR path at all? ADR-0005 says yes, the printed promise says no | The speech module's network code                             | [12-asr-speech-module](12-asr-speech-module.md), [45-api-integrations](45-api-integrations.md) §6.4                                |
| **Q-16** (proposed) — TTS provider and the pinned voice                                                | Catalog audio, and every `f0_native` contour derived from it | [45-api-integrations](45-api-integrations.md) §5.1, [36-content-scale-to-600](36-content-scale-to-600.md)                          |

---

## The three non-negotiables, and which plans touch them

A change that violates one of these is reverted, not discussed (`CLAUDE.md`).

**1 · Recorded audio never leaves the device** — [12-asr-speech-module](12-asr-speech-module.md)
(owns the by-handle API contract),
[27-labs-pronunciation-and-prosody](27-labs-pronunciation-and-prosody.md),
[23-add-import-and-capture](23-add-import-and-capture.md) (OCR images raise the same question for
photos).

**2 · Every number shown to a learner is real** — **two** violations left:
[03-fix-latency-measurement](03-fix-latency-measurement.md) (a display floor that rewrites the
measurement) and [05-fix-shared-maths-duplication](05-fix-shared-maths-duplication.md) (invented
FSRS intervals, a fixed cloze mask). The third,
[02-fix-fabricated-streak](02-fix-fabricated-streak.md) ✅, is fixed. Also guarded by
[25-screen-memory-model](25-screen-memory-model.md),
[19-prosody-dsp-spike-and-pipeline](19-prosody-dsp-spike-and-pipeline.md), and
[22-trip-arc-screens](22-trip-arc-screens.md) (the souvenir screen is the most likely place to
acquire fake stats).

**3 · No screen shames a missed day** — constrains
[02-fix-fabricated-streak](02-fix-fabricated-streak.md) ✅,
[30-widgets-and-notifications](30-widgets-and-notifications.md) (a notification is a screen, and it
arrives uninvited), [20-screen-today-ritual](20-screen-today-ritual.md) and
[24-screen-review-session](24-screen-review-session.md) (both must present a return after an absence
with no backlog framing), and [28-screens-run-and-phrasebook](28-screens-run-and-phrasebook.md)
(staleness is information, not a penalty).

---

## Conventions in these plans

- **Requirement IDs** (`P2-04`, `LB-25`) come from [`docs/product/prd.md`](../docs/product/prd.md)
  and go in the branch, the commits, and the PR.
- **Blueprint citations** look like `Loro.dc.html:1404–1538`.
- **Code citations** look like `apps/mobile/src/store/index.ts:134` and were verified at the time of
  writing — re-check the line if the file has moved on.
- Each plan carries **acceptance criteria** written so they can be checked, and an explicit **out of
  scope** so a plan does not grow into its neighbours.
