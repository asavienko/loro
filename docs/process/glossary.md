# Glossary

The blueprint invents a lot of vocabulary. Defined once, here, so the docs, the code, and the copy
agree.

---

## Core concepts

**Phrase** — the atom of the product. A complete utterance a learner can say to a person. Not a
word, not a sentence pattern, not a grammar point.

**Stream** — a learner's personal collection of phrases. Also, specifically, the hands-free
listening surface (screen 4). Context distinguishes them; when ambiguous, say "the phrase library"
or "the listening stream".

**The connective thread** — the blueprint's own name for its central mechanic: difficulty and tags,
set when adding, reshape the practice queue and roll up into progress. See
[`../product/learning-model.md`](../product/learning-model.md#the-connective-thread).

**Difficulty** — the learner's declaration of how hard a phrase is _for them_: `easy` (Easy) · `med`
(Learning) · `hard` (Difficult). Note the middle label is a status, not a rating.

**Tags** — "what's tricky about it": `pron` (Pronunciation) · `remember` (Hard to remember) ·
`useful` (Very useful ⭐) · `words` (Tricky words 🔤). About the _nature_ of the difficulty, never
its magnitude.

**Loved** (♥) — a third signal, neither difficulty nor tag: a phrase the learner simply enjoys.
Surfaces more often.

**Learned** — the learner has marked a phrase as done, or graded it `Easy` at `reps ≥ 3`. It leaves
the active stream but stays in review.

**Respelling** (`resp`) — an English-speaker's pronunciation guide with **CAPS on the stressed
syllable**: `meh PO-neh oon kor-TAH-doh por fah-VOR`. Not IPA — that's `resp_ipa`, which is for the
DSP.

**Memory hook** — a learner's note on a phrase, or one adopted from Loro's suggestions. Etymology or
imagery, never a restatement of the translation.

---

## Practice

**Practice engine** — a pluggable implementation of selection, sequencing, and evaluation. Five to
seven of them ([`../architecture/practice-engines.md`](../architecture/practice-engines.md)).

**Loop A / Loop B / Loop C** — the blueprint's three competing philosophies of daily practice. A the
engine (SRS + labs), B the ritual (the Refrain), C the run (roguelike). See
[`../product/practice-loops.md`](../product/practice-loops.md).

**Gate** — what a practice item requires before it counts. `listen` · `self-report` · `asr-full` ·
`asr-partial` · `score` · `tap`. **The production gate** specifically means `asr-full`: you must
produce the whole phrase, not merely recognise it.

**Reveal mode** — the no-microphone fallback: tapping the mic reveals and speaks the next word. A
first-class experience, not an error state.

---

## Loop B · the Daily Refrain

**The Refrain** — the hero practice screen. One phrase, rotating manner per rep, until it locks in.

**Wave** — one of three practice sessions across a day: Morning (meet & first reps) · Midday
(re-rep, from memory) · Evening (cold + perform).

**Today's five** — the closed, finite set for the day. Chosen once, persisted, never recomputed
mid-day. "You always see today."

**Mode** — the manner of a single rep, by rep index: **Echo** (hear then say) → **Chorus** (in
unison) → **Speed** (faster) → **Cloze** (fill the gap) → **Call** (say the Spanish for the English)
→ **Cold** (from memory, no model).

**Automaticity** — `min(100, round(reps_today / 6 × 100))`. How effortlessly a phrase comes out
_today_.

**Locked in** — automaticity reached 100% today. 💎 _"It comes out without thinking now."_

**Graduated** — locked in on four distinct days. Out of rotation, banked.

**The warming card** — the Refrain's hero visual: the phrase card heats from cold blue-grey through
cream and peach to hot coral as automaticity climbs. The app's most important animation.

**Falling effort** — measured production latency dropping across reps. The Refrain's actual feedback
signal, shown as a bar chart with a plain-language label (_"warming up"_ → _"instant & smooth"_).

**Fading tail** — recently graduated phrases, shown for three more days with days-left.

**Ambient loop** — all-day hands-free looping of today's set.

**Overlearning** — continuing past first success. Deliberate: the target is 6 reps whether or not
rep 1 was perfect.

---

## Loop A · SRS and the labs

**FSRS** — Free Spaced Repetition Scheduler, the scheduling algorithm
([ADR-0004](../architecture/adr/0004-fsrs-scheduler.md)).

**Stability** (`S`) — days until retrievability decays to the review threshold. What the
forgetting-curve screen plots.

**Retrievability** — the probability of recall right now. `R(t) = 0.5^(t/S)` in the blueprint's
display form.

**Confidence level** — the Memory-model screen's five-way self-rating: Forgot · Shaky · OK · Strong
· Instant. Maps onto FSRS's four grades.

**Focus banner** — the tag-driven instruction on a review card: _"PRONUNCIATION FOCUS — SAY IT OUT
LOUD"_, _"HARD TO REMEMBER — USE THE HOOK"_, etc. The connective thread made visible.

**Cue ladder** — the prosody lab's four levels of help: Listen & repeat → From text → From meaning
(5 s) → Cold recall (3 s). **Levelling up removes help, and that's the reward.**

**Three skill axes** — Perception · Recall · Production, per phrase, advancing at different rates.
Recall advances faster at high cue levels, because recalling without cues is what trains recall.

**Melody score** — the prosody lab's 0–99 contour-similarity score. **Real**, from F0 extraction and
DTW — never simulated.

**Take** — one recorded attempt in a lab. Stored as numbers and a normalised contour; **never
audio**.

---

## Loop C · the Roguelike Run

**Run** — one bounded session: `ready → spine → reveal → finisher → wrap`.

**Spine** — the constant ritual: re-fire the chain (recite phrases in rotation), then meet one new
phrase and fold it onto the end. "Retrieval disguised as a warm-up."

**The Draw** — the reveal: a real shuffle dealing one finisher card, constrained to what phrases are
ready for and biased toward weak spots. _"Surprise reads as fun; the targeting does the pedagogy."_

**Finisher** — the drawn challenge. **the Rally** (Bend) · **the Curveball** (Transfer) · **the
Gauntlet** (Pressure) · **the Sportscaster** (Deploy).

**The ladder** — five permanent rungs of depth per phrase: **Accumulated** (recognise and repeat) →
**Bent** (change its form) → **Transferred** (use it somewhere new) → **Pressure-tested** (fast,
distracted, under pressure) → **Deployed** (spontaneous, for real). Monotonic: _"you only climb or
hold."_

**Need** — `(stale ? 2 : 0) + stumbles`. Biases the draw and drives the `refresh` flags.

**Phrasebook** — the collection screen. Every phrase with its rung, plus the distribution histogram
that _is_ the learner's real ability.

---

## The trip arc

**Trip** — a countdown anchored to a real arrival date. States:
`planning → countdown → abroad → completed`.

**Drop** — a themed pack scheduled to unlock on a specific countdown day. Survival first, "sound
local" last, **never new phrases on the final day**.

**Ownership** — the readiness metric: phrases at `reps ≥ 3` or `learned`, over the trip's target
set. Shown as `38 / 100`.

**Survival mode** — what the app becomes on the arrival date: an offline deck reordered by immediate
need, with Capture promoted. "The flip."

**Need ordering** — the survival deck's ordering, from hours since landing, local time of day, trip
type, recency, and `useful` tags. All computable offline.

**Capture** — photograph a sign or menu, OCR it, bank the phrases.

**Souvenir** — the post-trip recap and the handoff of the trip set into long-term spaced review.

---

## Content

**Catalog** — the curated, versioned, immutable phrase content. Never written by the app.

**Theme** — one of 8 taxonomic categories, exactly one per phrase (Café · Dining · Travel ·
Directions · Shopping · Small talk · Survival · Hotel), plus three synthetic ones for
learner-authored phrases.

**Scenario** — a cross-theme, **ordered** bundle representing a real interaction (Dinner
reservation, Hotel check-in). The order is the arc of the interaction.

**Pack** — a marketable unit with a **promised count**. If the label says 8 phrases, exactly 8 are
added — CI enforces it.

**Catalog version** — a monotonic integer, bumped on publish. Ships independently of the app.

**Register** — `neutral` (default) · `casual` · `formal`. Default to neutral; over-formality is the
most common content failure.

---

## Technical

**`loro-core`** — the Rust crate holding every reproducible number: FSRS, sync merge, ranking,
selection, matching, DSP, notification policy
([ADR-0002](../architecture/adr/0002-shared-rust-core.md)).

**HLC** — hybrid logical clock. Orders sync operations. **Never shown to a learner.**

**`local_day`** — the device's local calendar date. Drives day boundaries, streaks, and trip
transitions, so they work offline. Distinct from HLC and not interchangeable with it.

**Merge class** — how a field resolves in sync: `LWW` · `max` · `latest-review` (grouped FSRS) ·
`append-only` · `tombstone`. **Every syncable field must declare one**; CI fails otherwise.

**Outbox** — the local queue of pending sync operations. Written in the same transaction as the data
change.

**Pinned content** — audio exempt from cache eviction: today's set, the trip set, the stream queue.

**The airplane-mode test** — the release gate: airplane mode, force-quit, relaunch, survival mode
usable in under 2 s.

**The device floor** — iPhone SE (3rd gen) and Pixel 6a / Galaxy A54. All p95 budgets are measured
here.

**Golden tests** — ~50 recorded utterances with committed expected DSP output. A moved score fails
CI and requires an explanation. What prevents silent scoring drift.

**The audio-egress canary** — a P0 alert on any network request originating from the audio module.
There should never be one.

---

## Product rules, by name

**The ten rules** — the architectural invariants in
[`../architecture/overview.md`](../architecture/overview.md#the-ten-rules).

**The three non-negotiables** — audio never leaves the device · every number is real · no screen
shames a missed day ([ways-of-working.md](ways-of-working.md#the-three-non-negotiables)).

**Rule 5** — every engine maintains every progress signal, including ones it doesn't display. What
makes engine switching lossless and the loop experiment interpretable.

**🔒 Promise** — something the UI states to the learner in writing, which the implementation must
therefore honour. Marked in the docs.

**Display model** — a formula in the blueprint that illustrates a concept but is replaced by the
real engine (e.g. the fixed review intervals). Distinguished from a **contract**, which must be
preserved exactly
([`../product/learning-model.md`](../product/learning-model.md#where-the-blueprints-numbers-came-from--and-what-is-real)).
