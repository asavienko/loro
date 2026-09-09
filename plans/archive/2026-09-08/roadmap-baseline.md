> Historical roadmap snapshot archived on 2026-09-08 (F-04). Implementation claims and plan
> numbering below describe the earlier review. Use the
> [current roadmap](../../../docs/product/roadmap.md) and [active plans](../../README.md) for
> remaining work.

# Roadmap

The milestone sections retain product intent and historical effort estimates for the assumed team in
[ways-of-working.md](../../../docs/process/ways-of-working.md). They are not delivery dates or the
execution queue. The [active plans](../../README.md) record the dependency order and exact remaining
work.

## Current baseline — 2026-09-07

Reviewed against merged `2d9e8c3`. Seven of 23 authored learner screens plus Languages, the shared
shell and the dev workbench are implemented. The web app demonstrates onboarding, collecting and
tagging phrases, manual practice and progress. It does not yet demonstrate a durable, audible native
learning loop. Stream browsing records no playback; manual Refrain confirmation records null speech
latency. Rust FSRS/cloze fallbacks are still implementation debt in plan 60.

The current UI/native languages are English, Bulgarian and Russian. Targets are Spanish, Bulgarian
and Russian, excluding matching pairs: seven supported pairs and 31-phrase starters per target.
Course progress/resume is separate; the streak is global. New linguistic content awaits bilingual
review. Text support does not enable audio, ASR or scoring for any target.

| Milestone   | Current state                                                                                                                                                        |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M0 · Setup  | Partial: portable foundations and native CI scaffolds exist; device app/bridge, device database, deployment and crash proof remain.                                  |
| M1 · Spine  | Partial: built routes, responsive UI, shared menu, localization, persistence primitives and contract package exist; native audio and durable app integration remain. |
| M2 · v1     | Remaining: production Today/Refrain, Speak, Import, trip/Survival, settings, auth/sync, release and approved monetization.                                           |
| M3 · v1.1   | Review/Memory, Roleplay and chat follow their foundation slices; chat launch/live service and speech labs have explicit gates.                                       |
| M4 · Scale  | Operational hardening and measured SLOs follow a functioning service; tests/budgets also belong to each feature.                                                     |
| M5 · v2     | Run and ladder Phrasebook depend on Q-05 and comparative evidence.                                                                                                   |
| M6 · Beyond | Candidates only; starter Bulgarian/Russian and UI localization are already implemented foundations.                                                                  |

The app remains in memory despite SQLite-tested schema-2 repositories, outbox and course settings.
The 13-route API remains in memory with stub AI. Shared current/target/draft schemas and OpenAPI are
implemented; Nest validation, auth, Postgres and mobile networking are not. Anthropic transport is
tested and merged but unregistered. Rust target compilation/EAS setup gates are not native app
proof.

`pnpm check` passed its contract drift check and 23 Turbo tasks using the cached implementation
baseline; 118 learner E2E tests passed freshly during the review. Historical milestone estimates
below remain sizing assumptions. On-device ASR/reveal behavior is on the v1 path through plan 63;
DSP lab scoring is the separate evidence-gated v1.1 risk.

## Execution after the review

Completed [54, 55, 79, 84 and 85](../2026-09-07/README.md) are archived. Protected plan 53 stays
unchanged. [The review](../2026-09-07/REVIEW.md) records every remaining plan's disposition and
source evidence; 30 plans remain active, with no renumbering.

1. Correct the remaining Rust/Unicode maths and course-upsert debt (60/59), extend the existing
   route declaration (56), establish the native workspace/bridge (58), and wire backend foundations
   (66).
2. Complete production UI state APIs and workbench coverage (57/80); add More and full navigation
   laws (81). Begin bilingual sign-off (87), content/asset contracts (61), the DSP evidence spike
   (77) and offline chat schemas/topics/evals (82) without activating gated production features.
3. Wire durable device state (59), approved assets/playback (61/62), real on-device speech (63),
   identity (67) and client sync (68). Provider plan 86 supplies adapters to feature owners; its old
   contract-task/worktree handoff block is closed.
4. Finish production Today/Refrain (64), Import then OCR (65), approved trips and Survival (69/70),
   general Settings/consent/flags (71), shared release gates (72), delivery (73) and approved
   billing (74). Shared harnesses develop with features; whole-release completion is not a circular
   prerequisite.
5. Add Review/Memory (75), guarded Roleplay (76), private chat and inspector (82/83), then
   evidence-approved labs (77) and conditional Run/ladder Phrasebook (78).

Plan [88](../../88-low-cost-backend-infrastructure.md), added on main during this review, owns the
approved AWS testing environment. Infrastructure preparation can start now; shared access requires
the relevant 66/67 slices, and mobile sync testing adds 59/68. Production operations remain with 73.
The highest assigned plan is 88 and the next number is 89.

## Scoped decision gates

Q-15 blocks production voice/assets, Q-07 trip semantics, Q-05 experiment activation/Run, Q-14 peak
accessibility sign-off, Q-08/Q-12 monetization and Q-17 final rail priority. Q-16 gates chat
release, Q-18 budget, Q-19 local retention and Q-20 provider retention. The DSP production pipeline
waits for its recorded quality decision. Bilingual sign-off remains separate from schema/key
validation. Unrelated foundation, offline content and harness work can proceed. The
[decision register](../../../docs/decisions/open-questions.md) retains its owners; this roadmap
review resolves none of those decisions.

---

## M0 · Foundations · ~2 weeks

**Goal: a hello-world app on a real device, from a clean clone, with CI green.**

| Deliverable                                        | Done when                                                             |
| -------------------------------------------------- | --------------------------------------------------------------------- |
| Monorepo, tooling, CI                              | `pnpm i && pnpm check` passes from clean clone; CI runs on PRs        |
| Expo app boots on an iPhone and a Pixel            | Both, from the documented onboarding steps                            |
| Design tokens package generating from source       | Token change → app change with one command                            |
| `loro-core` Rust crate building for both platforms | UniFFI bindings importable from TS; a trivial function round-trips    |
| SQLite + reviewed SQL migrations                   | Current schema applies on a fresh install and upgrades prior versions |
| NestJS API skeleton with health check              | Deployed to `dev`, reachable from a device                            |
| Crash reporting + analytics wired                  | A deliberate crash appears in the dashboard                           |
| ADRs 0001–0014 accepted                            | Reviewed and merged                                                   |

**Exit criteria:** a new engineer follows
[`process/onboarding.md`](../../../docs/process/onboarding.md) and ships a trivial PR to `dev` in
under a day.

**Explicitly not in M0:** any product screen.

---

## M1 · The spine · ~5 weeks

**Goal: add a phrase, hear it, rate it — the connective thread, end to end.**

The one-sentence test: _a learner can complete onboarding, add a phrase from Discover, tag it as
Difficult/Pronunciation, hear that change the stream's repeat count, and see it in Progress._

| Scope                                                                | Requirements                                                                   |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Onboarding, all six steps                                            | `P1-01`…`P1-12`                                                                |
| Design system in code — all tokens, ~20 core components              | [`design/component-inventory.md`](../../../docs/design/component-inventory.md) |
| Add phrases: Discover + Browse (Import deferred to M2)               | `P2-01`…`P2-08`, `P2-11`…`P2-14`                                               |
| The tagging sheet                                                    | `P2-20`…`P2-26`                                                                |
| Phrase detail                                                        | `P2-30`…`P2-40`                                                                |
| Audio: TTS cache, rates, exclusive playback                          | `AS-01`, `AS-02`                                                               |
| Adaptive stream, foreground only                                     | `P3-01`…`P3-10`, `P3-12`                                                       |
| Progress screen                                                      | `P4-01`…`P4-08`                                                                |
| Content: 150 phrases, 8 themes, 5 scenarios, 6 packs, all with audio | [content-model.md](../../../docs/product/content-model.md)                     |

**Exit criteria:** the thread demonstrably works — changing a rating visibly changes the stream and
the Progress rollup. Internal dogfooding starts here and never stops.

---

<a id="m2--v1--7-weeks"></a>

## M2 · v1 · ~7 weeks

**Goal: ship. The Refrain as hero, plus the trip arc.**

| Scope                                                                       | Requirements                                                             |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **The Refrain** — all 6 modes, warming card, automaticity, real latency     | `LB-20`…`LB-32`                                                          |
| **Today** — closed set, three waves, ambient loop, rolling window           | `LB-01`…`LB-10`                                                          |
| **Speak to progress** — on-device ASR, the production gate, reveal fallback | `P3-20`…`P3-28`, `AS-03`                                                 |
| Background audio + lock screen transport                                    | `P3-11`, `AS-04`                                                         |
| Import mode                                                                 | `P2-09`, `P2-10`                                                         |
| **Trip arc, all six screens**                                               | `P5-01`…`P5-12`                                                          |
| Lock screen widget / Live Activity + Glance                                 | `P5-06`, [widgets](../../../docs/architecture/widgets-notifications.md)  |
| Sync + accounts (anonymous-first)                                           | `F-01`…`F-04`, `F-07`                                                    |
| Offline: prefetch, survival-mode acceptance test                            | `F-03`, [offline.md](../../../docs/architecture/offline.md)              |
| Notifications — daily, waves, drops                                         | `N-01`…`N-04`                                                            |
| Monetization: paywall, StoreKit/Play Billing, Trip Pass                     | [monetization.md](../../../docs/product/monetization.md) ⚠️ pending Q-08 |
| Content: **600 phrases**, 30 scenarios, 10 packs, drop schedules            |                                                                          |
| Accessibility pass to WCAG 2.2 AA                                           | [accessibility.md](../../../docs/architecture/accessibility.md)          |
| Store listings, privacy manifests, screenshots                              | [`process/ci-cd.md`](../../../docs/process/ci-cd.md)                     |

**Exit criteria — the v1 bar:**

1. **The airplane-mode test:** airplane mode, fresh launch, survival mode fully usable in <2 s.
2. **The trip test:** a real person sets a 12-day trip, uses the app daily, travels, and reports
   they were ready. Run with ≥5 people before submission.
3. Crash-free sessions ≥99.5% across the [device matrix](../../../docs/process/qa-device-matrix.md).
4. No fabricated numbers anywhere — latency measured, no simulated scores shipped.
5. Every guardrail metric instrumented and reading.

**Cut list if we're late** (in this order): Trip Pass · ambient loop · Import · accent theming.
**Never cut:** offline survival mode, the production gate, or the real latency measurement.

---

<a id="m3--v11--loop-a-and-the-labs--8-weeks"></a>

## M3 · v1.1 — Loop A, guided chat, and the labs · ~8 weeks

**Goal: the retention story, guarded conversation, and the standout screen. Highest technical risk
in the project.**

| Scope                                                                | Requirements                                                                            | Risk     |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | -------- |
| Review session, FSRS-backed                                          | `P3-30`…`P3-40`                                                                         | Low      |
| Memory model / forgetting curve                                      | `P3B-01`…`P3B-08`                                                                       | Low      |
| **Pronunciation lab — real forced alignment + GOP scoring**          | `P3C-01`…`P3C-08`, `AS-06`                                                              | **High** |
| **Prosody lab — real F0 extraction, contour comparison, cue ladder** | `P3D-01`…`P3D-11`, `P3D-13`, `P3D-14`, `AS-05`                                          | **High** |
| Roleplay — LLM scenes, coach notes, spoken replies                   | `P3A-01`…`P3A-10`, `AI-01`                                                              | Medium   |
| Guided open chat + message inspector, bundled offline floor          | `P3E-01`…`P3E-18`, `AI-05`                                                              | High     |
| Capture — OCR → review → add                                         | `P2-15`, `AI-03`                                                                        | Medium   |
| Engine switching in Settings                                         | [practice-loops.md](../../../docs/product/practice-loops.md#can-a-learner-switch-loops) | Low      |
| Accent theming, dark theme                                           | `F-05`, `F-06`                                                                          | Low      |
| Share recap, plan next trip                                          | `P5-13`                                                                                 | Low      |
| Content: 1 200 phrases; syllabification + `f0_native` for all        |                                                                                         | Medium   |

**De-risking, starting in M1 as a background track:** a throwaway spike that extracts F0 from real
`es-ES` speech on a mid-range Android device and compares it to a reference. If that spike can't
produce a score a native speaker agrees with, the prosody lab is redesigned _before_ M3 starts, not
during. See [`architecture/prosody-dsp.md`](../../../docs/architecture/prosody-dsp.md#validation).

**Exit criteria:** a native Spanish speaker agrees with the pronunciation and prosody scores on 20
recorded takes ≥80% of the time. If not, the labs don't ship — a wrong score is worse than no score.
Guided chat separately requires its named release/retention decisions, coherent multi-turn bundled
coverage for every topic with the network disabled, provider safety/quality thresholds, and proof
that audio/thread text cannot enter telemetry or ordinary sync.

---

## M4 · Scale and hardening · ~4 weeks

**Goal: work at 100k learners and at 2 000 owned phrases.**

- Sync at scale: batching, backpressure, conflict telemetry, large-library performance
- Library performance: virtualised lists, indexed search, tested at 2 000 phrases
- AI cost controls: cache tuning, rate limits, budget alerts
- Backend: read replicas, connection pooling, load test to 10× projected peak
- Observability: SLOs, alerting, runbooks
  ([`process/incident-response.md`](../../../docs/process/incident-response.md))
- Content-quality dashboard closing the loop to the content lead
- Security review and a penetration test of the API and AI endpoints

**Exit criteria:** load test passes at 10× projected peak; p95 sync under 800 ms with a 2 000-phrase
library.

---

## M5 · v2 — the Run · ~8 weeks

**Gated on M3 data.** Only build this if the loop comparison
([practice-loops.md](../../../docs/product/practice-loops.md#how-well-actually-decide)) says
variety-and-depth is worth pursuing, or if Refrain retention is plateauing.

- The Run: all five phases, the draw, four finishers with real evaluation (`LC-01`…`LC-11`)
- Phrasebook / ladder collection (`LC-12`…`LC-15`)
- The Deploy finisher's open-ended speech evaluation — the hardest thing in the product

**Exit criteria:** the ladder distribution is a metric people check weekly, and rung ≥2 correlates
with 30-day retention.

---

## M6 · Beyond

Not planned, in rough order of expected value:

| Candidate                             | Why it might matter                                                                      | Cost                                                                 |
| ------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| **Full Bulgarian/Russian courses**    | Starter courses exist; reviewed expansion, voices and per-language speech quality remain | Large — see [localization.md](../../../docs/process/localization.md) |
| **`es-419` (Latin American Spanish)** | Probably a larger market than `es-ES`. Mostly content + one voice                        | Medium                                                               |
| Apple Watch — stream + refrain reps   | The Refrain is genuinely wrist-sized                                                     | Medium                                                               |
| CarPlay / Android Auto — the stream   | Commute is prime hands-free time                                                         | Medium                                                               |
| Shared phrasebooks                    | Couples and families learning together                                                   | Medium                                                               |
| Conversation partner matching         | Real speaking practice; entirely new product surface                                     | Very large                                                           |
| Teacher tooling                       | Explicit non-persona today; revisit only with pull                                       | Large                                                                |

---

## Sequencing rationale

**Why the Refrain before SRS.** It's the differentiated bet, it needs no DSP or ASR scoring, and its
"you always see today" model avoids review debt — the failure mode that kills SRS apps in month two.

**Why the trip arc in v1.** It's the strongest thing in the blueprint and the primary persona's
entire reason for installing. Shipping without it means shipping without a reason to install.

**Why the labs are v1.1.** They are the highest technical risk in the project. Putting them on the
v1 critical path would put the whole release at the mercy of a DSP result we haven't validated yet.

**Why the Run is v2 and conditional.** Highest build cost, most speculative payoff, and its best
idea (the ladder) already has a shared data contract, though current engines do not yet maintain it
durably and consistently
([practice-loops.md](../../../docs/product/practice-loops.md#loop-c--the-roguelike-run)) — so
delaying costs us nothing we can't recover.

**Why hardening gets its own milestone.** Sync and offline correctness at a 2 000-phrase library is
real work, and squeezing it into feature milestones is how you end up with a product that's great at
50 phrases and unusable at 500.
