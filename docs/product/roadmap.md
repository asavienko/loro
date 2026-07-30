# Roadmap

Seven milestones from empty repo to a product that survives a trip. Sizing assumes the team in
[`process/ways-of-working.md`](../process/ways-of-working.md#the-team): 2 mobile, 1 backend, 1
designer (shared), 1 content lead (part-time), and it counts calendar weeks with that team, not
ideal engineering weeks.

**Sizing is a planning estimate, not a commitment.** The two long-lead risks — real prosody DSP and
on-device ASR quality for `es-ES` — are both in M3 and both could move it by weeks. They're
deliberately not on the v1 critical path.

| Milestone   | Meaning on 2026-07-30                                                                                                         |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------- |
| M0 · Setup  | **Partial:** portable foundations exist; native workspace, device persistence, dev deployment, and crash reporting do not     |
| M1 · Spine  | **Partial and current:** seven learner routes demonstrate the thread on web; it is not yet durable, audible, or native-tested |
| M2 · v1     | **Planned:** extend the spine into a production Today/Refrain loop, trip arc, offline/sync, release, and monetization         |
| M3 · v1.1   | **Planned/evidence-gated:** Review/Memory and Roleplay follow the v1 foundations; speech labs wait for their quality gate     |
| M4 · Scale  | **Planned:** hardening follows a functioning production service                                                               |
| M5 · v2     | **Conditional:** Run/Phrasebook ship only if the loop experiment supports them                                                |
| M6 · Beyond | **Unscheduled candidates**, not commitments                                                                                   |

The original `2w / 5w / 7w / 8w / 4w / 8w` estimates describe effort with the assumed team. They do
not describe elapsed time from the current repository state, and milestones may overlap where their
plan dependencies allow it.

## Where we actually are — 2026-07-30

**M0's portable code foundations are built, but M0 is not operationally complete.** The API is not
deployed to `dev`, crash reporting is not wired, no native project/dev client exists, and the
on-device SQLite driver is absent. At the last green baseline `pnpm check` ran 23 tasks; 432 JS/TS,
131 Rust, and 61 browser E2E tests passed. Tokens generate for three targets and the Rust crate
builds for host/WASM with committed bindings.

**M1 is partly built.** The spine's one-sentence test passes in the app: onboarding → add from
Discover → tag as Difficult/Pronunciation → the stream's repeat count changes → Progress reflects
it. What is built:

| M1 scope                                    | State                                                                                                        |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Onboarding, six steps                       | Built; seeds a real stream                                                                                   |
| Design system in code                       | Generated tokens + split primitives/components; runtime fonts/motion/themes remain                           |
| Add: Discover + Browse, tagging sheet       | Built                                                                                                        |
| Phrase detail                               | Built                                                                                                        |
| Adaptive stream                             | Built                                                                                                        |
| Progress screen                             | Built                                                                                                        |
| Daily Refrain                               | Route and headless flow built; production loop remains partial (no durable set, audio, ASR, or real latency) |
| Audio: TTS cache, rates, exclusive playback | **Not built.** No audio anywhere in the app yet                                                              |
| SQLite persistence                          | Schema/migrations/repositories/outbox built and SQLite-tested; device driver/app wiring absent               |
| Content: 150 phrases with audio             | 31 phrases, no audio                                                                                         |

So the loop is demonstrable and well covered on web, but not yet durable, audible, or native-tested.
The dependency-ordered execution source is now [`../../plans/README.md`](../../plans/README.md);
sizing below remains milestone intent rather than a commitment.

### How the app extends from here

The milestone sections define product scope. Plans 54–83 define executable order and must not be
replaced by treating a milestone table as a backlog:

1. **Make the existing seven routes truthful and safe to extend:** consume completed protected plan
   [53](../../plans/53-post-refactor-solid-kiss-dry-audit.md), then land persistence correctness and
   current-surface fidelity in
   [54](../../plans/54-local-persistence-correctness.md)–[55](../../plans/55-current-surface-truth-and-fidelity.md).
2. **Establish extension foundations:** shared navigation/runtime UI/native workspace/core maths,
   content, and backend contracts in
   [56](../../plans/56-navigation-failure-and-input-shell.md)–[61](../../plans/61-content-and-audio-assets.md)
   and [66](../../plans/66-backend-contract-data-and-security.md).
3. **Make the demonstrated spine real on devices:** wire device SQLite, audio, speech, identity, and
   sync in [59](../../plans/59-device-persistence-and-resume.md),
   [62](../../plans/62-native-audio-playback.md)–[63](../../plans/63-native-speech-speak-and-latency.md),
   and
   [67](../../plans/67-anonymous-auth-and-account-lifecycle.md)–[68](../../plans/68-sync-and-offline-convergence.md).
4. **Complete and ship v1 behavior:** finish Today/Refrain, Import, trips/Survival, settings,
   quality, delivery, and entitlements in
   [64](../../plans/64-today-and-refrain-production-loop.md)–[65](../../plans/65-import-and-capture.md)

5. **Register and extend the v1.1 design package:** plan
   [79](../../plans/79-v1-1-design-contract.md) defines stable navigation/chat requirements before
   [80](../../plans/80-dev-design-system-workbench.md)–[83](../../plans/83-open-chat-and-message-inspector.md)
   implement the workbench, navigation spine, and two chat surfaces. and
   [69](../../plans/69-trip-domain-and-arc.md)–[74](../../plans/74-monetization-and-entitlements.md).
6. **Add later surfaces without rebuilding foundations:** Review/Memory, Roleplay, and the gated
   labs use the same repositories, engines, native capture, and release harness in
   [75](../../plans/75-review-and-memory.md)–[77](../../plans/77-dsp-and-speech-labs.md).
   Conditional Run/Phrasebook remains [78](../../plans/78-conditional-run-and-phrasebook.md).

Current decision/evidence gates are Q-15 for production audio assets, Q-07 for trip semantics, Q-05
for the loop experiment and conditional Run, Q-14 for the Refrain peak accessibility sign-off,
Q-08/Q-12 for monetization, and the recorded DSP spike gate for the labs. Other work should proceed
when its technical dependencies pass; a blocked plan does not freeze file-disjoint work.

---

## M0 · Foundations · ~2 weeks

**Goal: a hello-world app on a real device, from a clean clone, with CI green.**

| Deliverable                                        | Done when                                                          |
| -------------------------------------------------- | ------------------------------------------------------------------ |
| Monorepo, tooling, CI                              | `pnpm i && pnpm check` passes from clean clone; CI runs on PRs     |
| Expo app boots on an iPhone and a Pixel            | Both, from the documented onboarding steps                         |
| Design tokens package generating from source       | Token change → app change with one command                         |
| `loro-core` Rust crate building for both platforms | UniFFI bindings importable from TS; a trivial function round-trips |
| SQLite + reviewed SQL migrations                   | Schema v1 applies on a fresh install                               |
| NestJS API skeleton with health check              | Deployed to `dev`, reachable from a device                         |
| Crash reporting + analytics wired                  | A deliberate crash appears in the dashboard                        |
| ADRs 0001–0014 accepted                            | Reviewed and merged                                                |

**Exit criteria:** a new engineer follows [`process/onboarding.md`](../process/onboarding.md) and
ships a trivial PR to `dev` in under a day.

**Explicitly not in M0:** any product screen.

---

## M1 · The spine · ~5 weeks

**Goal: add a phrase, hear it, rate it — the connective thread, end to end.**

The one-sentence test: _a learner can complete onboarding, add a phrase from Discover, tag it as
Difficult/Pronunciation, hear that change the stream's repeat count, and see it in Progress._

| Scope                                                                | Requirements                                                        |
| -------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Onboarding, all six steps                                            | `P1-01`…`P1-12`                                                     |
| Design system in code — all tokens, ~20 core components              | [`design/component-inventory.md`](../design/component-inventory.md) |
| Add phrases: Discover + Browse (Import deferred to M2)               | `P2-01`…`P2-08`, `P2-11`…`P2-14`                                    |
| The tagging sheet                                                    | `P2-20`…`P2-26`                                                     |
| Phrase detail                                                        | `P2-30`…`P2-40`                                                     |
| Audio: TTS cache, rates, exclusive playback                          | `AS-01`, `AS-02`                                                    |
| Adaptive stream, foreground only                                     | `P3-01`…`P3-10`, `P3-12`                                            |
| Progress screen                                                      | `P4-01`…`P4-08`                                                     |
| Content: 150 phrases, 8 themes, 5 scenarios, 6 packs, all with audio | [content-model.md](content-model.md)                                |

**Exit criteria:** the thread demonstrably works — changing a rating visibly changes the stream and
the Progress rollup. Internal dogfooding starts here and never stops.

---

<a id="m2--v1--7-weeks"></a>

## M2 · v1 · ~7 weeks

**Goal: ship. The Refrain as hero, plus the trip arc.**

| Scope                                                                       | Requirements                                                 |
| --------------------------------------------------------------------------- | ------------------------------------------------------------ |
| **The Refrain** — all 6 modes, warming card, automaticity, real latency     | `LB-20`…`LB-32`                                              |
| **Today** — closed set, three waves, ambient loop, rolling window           | `LB-01`…`LB-10`                                              |
| **Speak to progress** — on-device ASR, the production gate, reveal fallback | `P3-20`…`P3-28`, `AS-03`                                     |
| Background audio + lock screen transport                                    | `P3-11`, `AS-04`                                             |
| Import mode                                                                 | `P2-09`, `P2-10`                                             |
| **Trip arc, all six screens**                                               | `P5-01`…`P5-12`                                              |
| Lock screen widget / Live Activity + Glance                                 | `P5-06`, [widgets](../architecture/widgets-notifications.md) |
| Sync + accounts (anonymous-first)                                           | `F-01`…`F-04`, `F-07`                                        |
| Offline: prefetch, survival-mode acceptance test                            | `F-03`, [offline.md](../architecture/offline.md)             |
| Notifications — daily, waves, drops                                         | `N-01`…`N-04`                                                |
| Monetization: paywall, StoreKit/Play Billing, Trip Pass                     | [monetization.md](monetization.md) ⚠️ pending Q-08           |
| Content: **600 phrases**, 30 scenarios, 10 packs, drop schedules            |                                                              |
| Accessibility pass to WCAG 2.2 AA                                           | [accessibility.md](../architecture/accessibility.md)         |
| Store listings, privacy manifests, screenshots                              | [`process/ci-cd.md`](../process/ci-cd.md)                    |

**Exit criteria — the v1 bar:**

1. **The airplane-mode test:** airplane mode, fresh launch, survival mode fully usable in <2 s.
2. **The trip test:** a real person sets a 12-day trip, uses the app daily, travels, and reports
   they were ready. Run with ≥5 people before submission.
3. Crash-free sessions ≥99.5% across the [device matrix](../process/qa-device-matrix.md).
4. No fabricated numbers anywhere — latency measured, no simulated scores shipped.
5. Every guardrail metric instrumented and reading.

**Cut list if we're late** (in this order): Trip Pass · ambient loop · Import · accent theming.
**Never cut:** offline survival mode, the production gate, or the real latency measurement.

---

<a id="m3--v11--loop-a-and-the-labs--8-weeks"></a>

## M3 · v1.1 — Loop A and the labs · ~8 weeks

**Goal: the retention story and the standout screen. Highest technical risk in the project.**

| Scope                                                                | Requirements                                                      | Risk     |
| -------------------------------------------------------------------- | ----------------------------------------------------------------- | -------- |
| Review session, FSRS-backed                                          | `P3-30`…`P3-40`                                                   | Low      |
| Memory model / forgetting curve                                      | `P3B-01`…`P3B-08`                                                 | Low      |
| **Pronunciation lab — real forced alignment + GOP scoring**          | `P3C-01`…`P3C-08`, `AS-06`                                        | **High** |
| **Prosody lab — real F0 extraction, contour comparison, cue ladder** | `P3D-01`…`P3D-11`, `P3D-13`, `P3D-14`, `AS-05`                    | **High** |
| Roleplay — LLM scenes, coach notes, spoken replies                   | `P3A-01`…`P3A-10`, `AI-01`                                        | Medium   |
| Capture — OCR → review → add                                         | `P2-15`, `AI-03`                                                  | Medium   |
| Engine switching in Settings                                         | [practice-loops.md](practice-loops.md#can-a-learner-switch-loops) | Low      |
| Accent theming, dark theme                                           | `F-05`, `F-06`                                                    | Low      |
| Share recap, plan next trip                                          | `P5-13`                                                           | Low      |
| Content: 1 200 phrases; syllabification + `f0_native` for all        |                                                                   | Medium   |

**De-risking, starting in M1 as a background track:** a throwaway spike that extracts F0 from real
`es-ES` speech on a mid-range Android device and compares it to a reference. If that spike can't
produce a score a native speaker agrees with, the prosody lab is redesigned _before_ M3 starts, not
during. See [`architecture/prosody-dsp.md`](../architecture/prosody-dsp.md#validation).

**Exit criteria:** a native Spanish speaker agrees with the pronunciation and prosody scores on 20
recorded takes ≥80% of the time. If not, the labs don't ship — a wrong score is worse than no score.

---

## M4 · Scale and hardening · ~4 weeks

**Goal: work at 100k learners and at 2 000 owned phrases.**

- Sync at scale: batching, backpressure, conflict telemetry, large-library performance
- Library performance: virtualised lists, indexed search, tested at 2 000 phrases
- AI cost controls: cache tuning, rate limits, budget alerts
- Backend: read replicas, connection pooling, load test to 10× projected peak
- Observability: SLOs, alerting, runbooks
  ([`process/incident-response.md`](../process/incident-response.md))
- Content-quality dashboard closing the loop to the content lead
- Security review and a penetration test of the API and AI endpoints

**Exit criteria:** load test passes at 10× projected peak; p95 sync under 800 ms with a 2 000-phrase
library.

---

## M5 · v2 — the Run · ~8 weeks

**Gated on M3 data.** Only build this if the loop comparison
([practice-loops.md](practice-loops.md#how-well-actually-decide)) says variety-and-depth is worth
pursuing, or if Refrain retention is plateauing.

- The Run: all five phases, the draw, four finishers with real evaluation (`LC-01`…`LC-11`)
- Phrasebook / ladder collection (`LC-12`…`LC-15`)
- The Deploy finisher's open-ended speech evaluation — the hardest thing in the product

**Exit criteria:** the ladder distribution is a metric people check weekly, and rung ≥2 correlates
with 30-day retention.

---

## M6 · Beyond

Not planned, in rough order of expected value:

| Candidate                             | Why it might matter                                                          | Cost                                                      |
| ------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------- |
| **A second target language**          | The whole model is language-agnostic; the content and linguistic work is not | Large — see [localization.md](../process/localization.md) |
| **`es-419` (Latin American Spanish)** | Probably a larger market than `es-ES`. Mostly content + one voice            | Medium                                                    |
| Apple Watch — stream + refrain reps   | The Refrain is genuinely wrist-sized                                         | Medium                                                    |
| CarPlay / Android Auto — the stream   | Commute is prime hands-free time                                             | Medium                                                    |
| Shared phrasebooks                    | Couples and families learning together                                       | Medium                                                    |
| Conversation partner matching         | Real speaking practice; entirely new product surface                         | Very large                                                |
| Teacher tooling                       | Explicit non-persona today; revisit only with pull                           | Large                                                     |

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
durably and consistently ([practice-loops.md](practice-loops.md#loop-c--the-roguelike-run)) — so
delaying costs us nothing we can't recover.

**Why hardening gets its own milestone.** Sync and offline correctness at a 2 000-phrase library is
real work, and squeezing it into feature milestones is how you end up with a product that's great at
50 phrases and unusable at 500.
