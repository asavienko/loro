# Risk register

Reviewed at each milestone planning. Each risk has a **trigger** — the observable signal that it's
materialising — because a risk without a trigger is just an anxiety.

**Score** = likelihood × impact, on 1–5 each.

| #             | Risk                                                  |  L  |  I  | Score  | Owner        |
| ------------- | ----------------------------------------------------- | :-: | :-: | :----: | ------------ |
| [R-01](#r-01) | The DSP can't score well enough to be honest          |  4  |  5  | **20** | Core owner   |
| [R-02](#r-02) | On-device ASR is too weak for `es-ES` learner accents |  3  |  5  | **15** | Mobile lead  |
| [R-03](#r-03) | Sync loses learner data                               |  2  |  5  | **10** | Tech lead    |
| [R-04](#r-04) | The Refrain feels tedious, not alive                  |  3  |  5  | **15** | Product      |
| [R-05](#r-05) | Content quality doesn't scale to 600 phrases          |  3  |  4  |   12   | Content lead |
| [R-06](#r-06) | Team size can't deliver 21 screens plus native work   |  4  |  3  |   12   | Tech lead    |
| [R-07](#r-07) | Native audio work overruns                            |  3  |  4  |   12   | Mobile lead  |
| [R-08](#r-08) | The trip arc doesn't retain learners post-trip        |  3  |  4  |   12   | Product      |
| [R-09](#r-09) | AI costs run away                                     |  2  |  3  |   6    | Backend      |
| [R-10](#r-10) | Monetization is unvalidated                           |  4  |  4  | **16** | Product      |
| [R-11](#r-11) | The loop question never gets answered                 |  3  |  3  |   9    | Product      |
| [R-12](#r-12) | We drift into engagement-optimisation                 |  2  |  5  |   10   | Everyone     |
| [R-13](#r-13) | The privacy promise gets broken by accident           |  2  |  5  |   10   | Tech lead    |
| [R-14](#r-14) | Store rejection on the microphone or subscription     |  2  |  3  |   6    | Mobile lead  |
| [R-15](#r-15) | Platform API changes break widgets or ASR             |  3  |  2  |   6    | Mobile lead  |

---

<a id="r-01"></a>

### R-01 · The DSP can't score well enough to be honest · 20

The pronunciation and prosody labs claim per-syllable accuracy and a melody score. On-device DTW
against a native reference may not be accurate enough for a native speaker to agree with the
numbers.

**Trigger:** the M1 validation spike shows Spearman correlation with human judgement below 0.6, or
worst-syllable identification below 70%
([`../architecture/prosody-dsp.md`](../architecture/prosody-dsp.md#validation)).

**Mitigation**

- The spike runs in **M1**, months before the labs are due in M3. That's the whole point of
  scheduling it early.
- The labs are **not on the v1 critical path**, so a failure delays a feature rather than a release.
- A fallback design exists: **contour-only feedback** (much easier to get right) with no
  per-syllable numbers.
- The M3 gate is explicit — ≥80% native-speaker agreement, or the labs don't ship.

**Accepted position:** a wrong score is worse than no score. We will ship less rather than ship
theatre.

---

<a id="r-02"></a>

### R-02 · On-device ASR is too weak for `es-ES` learner accents · 15

Platform recognisers may not handle strong English-accented Spanish, making the production gates
frustrating.

**Trigger:** reveal-mode rate exceeds 15% of speaking sessions on either platform, or gate-failure
rate correlates with learner accent
([ADR-0005](../architecture/adr/0005-on-device-asr-cloud-fallback.md#revisit-if)).

**Mitigation**

- The forward-walk matcher already tolerates insertions and preserves partial credit.
- `asr.fuzzyTolerance` (bounded edit distance) exists as a flag — but turning it on is a
  _pedagogical_ decision about gate strictness, made with data.
- Reveal mode means the app never blocks.
- Escalation path: bundle a Whisper-class model as an **optional download**, sidestepping the
  binary-size objection.

---

<a id="r-03"></a>

### R-03 · Sync loses learner data · 10

Low likelihood, catastrophic impact. A learner losing their phrase library — especially on sign-in —
is the worst bug this product can have.

**Trigger:** conflict rate > 0.5%, any `max`-field regression detected by the nightly invariant
check, or a single claim/merge failure.

**Mitigation**

- One merge implementation, shared by client and server
  ([ADR-0002](../architecture/adr/0002-shared-rust-core.md)).
- A CI test fails if any syncable field lacks a declared merge class.
- Commutativity and idempotency property tests.
- The nightly server-side invariant check on monotonic fields.
- Two-device and sign-in-merge e2e suites.
- Two required reviewers on `packages/core/src/sync`.

---

<a id="r-04"></a>

### R-04 · The Refrain feels tedious, not alive · 15

The v1 hero's entire bet is that repetition can feel alive. If six reps of the same phrase is
boring, the product's differentiated loop fails.

**Trigger:** dogfooding says it's boring by week 2 of M2; or wave-completion rate below 50%; or
session abandonment rising with rep index.

**Mitigation**

- **Dogfooding from M1**, with real goals, is the primary control — this is exactly why it's
  mandatory ([ways-of-working.md](../process/ways-of-working.md#dogfooding)).
- The warming card, the beat, and the falling-effort chart are three independent feedback channels;
  if one doesn't land, the others might.
- Mode rotation means six reps are six different cognitive events, not one event six times.
- The engine abstraction means we can pivot the hero to Loop A without a rewrite.

**This is the risk that can only be found by using the product**, which is why no amount of testing
substitutes for the team practising daily.

---

<a id="r-05"></a>

### R-05 · Content quality doesn't scale to 600 phrases · 12

150 excellent phrases is achievable. 600 with the same ten-point quality bar, all natively reviewed
and human-listened, is a different problem.

**Trigger:** review throughput below 40 phrases/week, or removal rate above 20% on newer batches.

**Mitigation**

- LLM enrichment drafts the four expensive fields; humans edit
  ([content-authoring.md](../process/content-authoring.md)).
- CI validates everything mechanical, so human attention goes to naturalness.
- The content-quality dashboard identifies bad phrases from real learner behaviour — removal rate is
  a direct signal.
- **The catalog ships independently**, so a phrase can be fixed the same week
  ([ADR-0009](../architecture/adr/0009-content-pipeline-and-packs.md)).
- If throughput is the constraint, ship v1 with 400 good phrases rather than 600 mediocre ones.

---

<a id="r-06"></a>

### R-06 · Team size can't deliver 21 screens plus native work · 12

4.5 FTE, 21 dense screens, three native modules, two widget targets, a Rust core, and a backend.

**Trigger:** M1 or M2 slips more than two weeks.

**Mitigation**

- The roadmap already stages this: v1 is 12 screens, not 21.
- The cut list is decided **before** the work starts, in priority order
  ([`../product/roadmap.md`](../product/roadmap.md#m2--v1--7-weeks)).
- The labs (the most expensive screens) are v1.1.
- Loop C is v2 and conditional.
- Design system as its own M1 workstream, so screens compose rather than each being bespoke.

---

<a id="r-07"></a>

### R-07 · Native audio work overruns · 12

The audio module is the highest-skill native work in the project: gapless playback, unprocessed
capture, onset detection, rate with pitch preservation, and a long interruption matrix
([ADR-0007](../architecture/adr/0007-audio-pipeline.md)).

**Trigger:** the interruption matrix isn't passing by mid-M2.

**Mitigation**

- The module contains **no learning logic**, so its surface is narrow and stable.
- The interruption matrix is enumerated up front, not discovered.
- Fallback on Android: `ExoPlayer` for playback, Oboe for capture only — accepting two session
  owners on one platform.
- Playback and capture can be built and validated independently.

---

<a id="r-08"></a>

### R-08 · The trip arc doesn't retain learners post-trip · 12

The trip is the reason to install and the reason to churn. A learner whose trip ends may have no
reason to open the app again.

**Trigger:** post-trip 30-day retention below 25%.

**Mitigation**

- The souvenir screen's only real job is making the next session make sense
  ([`../product/trip-arc.md`](../product/trip-arc.md#regime-3--souvenir)).
- Trip phrases graduate into spaced review with FSRS state derived from actual trip performance, not
  reset.
- "Plan next trip" is a first-class action.
- The Trip Pass acknowledges that some learners are honestly one-trip customers — which is a pricing
  answer to a retention problem, and a legitimate one.

---

<a id="r-09"></a>

### R-09 · AI costs run away · 6

Roleplay is the only variable cost that scales with usage.

**Trigger:** AI spend per engaged learner exceeds $0.50/month, or cache hit rate falls below 55%.

**Mitigation:** bucketed cache keys, prompt caching, per-user and global budgets that **fail
silently to bundled scenes**, and pre-generation of the top combinations as the big lever
([`../architecture/ai-services.md`](../architecture/ai-services.md#cost-model)).

---

<a id="r-10"></a>

### R-10 · Monetization is unvalidated · 16

The blueprint contains no monetization surface. Everything in
[`../product/monetization.md`](../product/monetization.md) is inference from the product's shape,
and the numbers are placeholders.

**Trigger:** free→paid conversion below 2% at week 8, or research showing the free tier is either
too generous or dishonest.

**Mitigation:** Q-08 has a deadline (M2 mid) and an owner. Research all four personas. Test paywall
placement as a legitimate experiment. Keep the Trip Pass as a serious option rather than a fallback.

**This is the highest-scoring risk after the DSP**, and it's the one least mitigated by engineering.

---

<a id="r-11"></a>

### R-11 · The loop question never gets answered · 9

The engine abstraction preserves optionality. Optionality without a decision date becomes permanent
indecision, and we end up maintaining three loops forever.

**Trigger:** M3 starts without a named owner and a pre-registered metric for the loop experiment
(Q-05).

**Mitigation:** Q-05 is flagged as blocking M3 start specifically because the common cold probe must
be instrumented before the arms go live.

---

<a id="r-12"></a>

### R-12 · We drift into engagement-optimisation · 10

A learning app that optimises engagement will find dark patterns, because dark patterns work. Streak
anxiety raises DAU. This is a cultural risk, not a technical one, and it materialises gradually.

**Trigger:** any guardrail metric trips — particularly streak-without-mastery or notification
dependence ([`../product/metrics.md`](../product/metrics.md#guardrails)).

**Mitigation**

- The guardrails exist for exactly this and are **circuit breakers**, not dashboard decoration: a
  tripped guardrail reverts a change regardless of its wins.
- "No screen shames a missed day" is one of the three non-negotiables, and it constrains the
  scheduler and the widget, not just copy.
- The north star is _phrases produced under a real gate_, not DAU.
- The forbidden-copy list is audited every release.

---

<a id="r-13"></a>

### R-13 · The privacy promise gets broken by accident · 10

A future engineer adds an upload for a plausible reason ("just for quality sampling") and the
on-screen promise becomes false.

**Trigger:** the audio-egress canary fires — a P0 alert on any network request originating in the
audio module.

**Mitigation**

- **Structural, not procedural:** PCM never crosses into JS, so the code to upload it does not exist
  and would have to be deliberately added to a native module
  ([ADR-0011](../architecture/adr/0011-analytics-and-privacy.md)).
- Exactly one endpoint accepts audio, consent-gated, with a test asserting the temp file is deleted.
- The P0 canary.
- The threat-model review checklist on any PR touching audio.
- Allowlist-based analytics, so a new property is invisible until justified.

---

<a id="r-14"></a>

### R-14 · Store rejection on the microphone or subscription · 6

Continuous microphone use, background audio, and subscription mechanics all attract reviewer
attention.

**Trigger:** a rejection.

**Mitigation:** specific, honest purpose strings (the mic string states the privacy promise);
background audio is a genuine and demonstrable use; privacy manifests kept in sync in the same PR as
any data-flow change; a reviewer note explaining the mic usage; the free tier is genuinely useful,
which matters for subscription guidelines.

---

<a id="r-15"></a>

### R-15 · Platform API changes break widgets or ASR · 6

Live Activities, `SFSpeechRecognizer` on-device support, and Android offline speech packs all change
across OS versions.

**Trigger:** a beta OS breaks a manual QA pass.

**Mitigation:** test on OS betas from the first developer seed; the degradation ladders mean a
broken recogniser falls to reveal mode rather than breaking; widgets are a small, isolated surface
with a snapshot contract; the OS floor moves deliberately, once a year, announced a release ahead.

---

## Risks we're deliberately accepting

| Accepted                                              | Why                                                                                                                                                                                    |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A concurrent same-field sync write loses one value    | Requires one learner editing the same field on two devices within a sync window. The `max` class protects counters ([ADR-0003](../architecture/adr/0003-offline-first-sqlite-sync.md)) |
| A rooted device can read the local SQLite file        | The learner owns the device and the data is theirs. SQLCipher costs latency on the hot path (Q-09)                                                                                     |
| DSP accuracy is bounded by on-device compute          | The privacy promise is worth more than the accuracy ([ADR-0011](../architecture/adr/0011-analytics-and-privacy.md))                                                                    |
| 24 bundled roleplay scenes is limited variety offline | Roleplay is supplementary, not the daily loop                                                                                                                                          |
| Sync availability depends on us                       | The app works offline, so an outage delays sync rather than learning                                                                                                                   |
| A determined learner can extract the catalog          | It ships to every device. The moat is the pedagogy, not the phrase list                                                                                                                |
| Unicode glyphs render differently across platforms    | The authored iconography uses a small glyph set; verify it on both platforms (the app draws Material Symbols from a bundled subset, `apps/mobile/src/ui/Icon.tsx`)                     |
| We are not a 24/7 service                             | Offline-first makes best-effort out-of-hours on-call defensible — except for privacy and data-loss P0s                                                                                 |
