# Content: 31 phrases → 600, with audio and the enrich pipeline

- **Requirement IDs:** the content targets in M1 (150), M2 (600), M3 (1 200)
- **Milestone:** M1 → M3
- **Spec:** `docs/product/content-model.md`, `docs/process/content-authoring.md`
- **ADRs:** 0009 (content pipeline and packs)
- **Size:** L (and mostly not engineering)

## Current state

`packages/content/es-ES/phrases.json` says it plainly in its own `$comment`:

> 31 phrases across 8 themes. Launch target is ~600. … Fields still to be authored for most rows:
> `resp`, `resp_ipa`, `words`, `example`, `hint`, `note`, `syl`, `f0_native`, `audio`. Those are
> produced by the enrich + render pipeline and human-reviewed before merge.

And **no audio at all** (`docs/product/roadmap.md`: "31 phrases, no audio"). The 31 rows were
extracted verbatim from the blueprint (`Loro.dc.html:2179–2211` and `2885–2899`).

The tooling scaffold exists — `pnpm content:validate` runs in CI as its own job, and
`content:enrich` / `content:render` / `content:publish` are declared in the root `package.json`.
What they actually do needs checking against what they need to do.

## Why this is on the critical path for three other plans

- **Audio** — [audio-playback-module.md](11-audio-playback-module.md) has
  `AudioSpec.source: 'catalog' | 'device-tts'`. With no catalog audio, every phrase falls back to
  device TTS, whose quality and availability vary by OEM. Catalog audio is what makes the app sound
  good on a cheap Android.
- **The labs** — [labs-pronunciation-and-prosody.md](27-labs-pronunciation-and-prosody.md) cannot
  score a phrase without `syl` (syllabification) and `f0_native` (the reference contour). A phrase
  without them simply cannot enter the lab.
- **Cloze** — [select-rs-cloze-and-set-selection.md](18-select-rs-cloze-and-set-selection.md) wants
  an authored informative-token marker as its primary path.

So "content is behind" is not a content-team problem in isolation; it gates engineering milestones.

## The work

### 1. Make the pipeline real, end to end, on a small batch first

Take 10 phrases through the whole path — author → enrich → record → render → review → publish — and
fix every rough edge before scaling. Doing 600 through an unproven pipeline is how you get 600 rows
needing rework.

Per `docs/process/content-authoring.md`, the pipeline produces: respelling (`resp`), IPA
(`resp_ipa`), word glosses (`words`), an example (`example`), a hook (`hint`), a note (`note`),
syllabification (`syl`), the native F0 contour (`f0_native`), and the audio file (`audio`).

### 2. Audio production

Decide and document: professional `es-ES` voice talent vs high-quality TTS. It affects cost,
consistency, `f0_native` quality, and whether the Prosody lab's reference is a real human contour
(which is the point of the lab). Then: recording spec (sample rate, format, loudness normalisation),
naming, licensing, and a re-record path for a phrase that turns out wrong.

**This plan owns that question, and it comes first.** [api-integrations.md](45-api-integrations.md)
§5.1 (decision D7) recommends a provider — Google Cloud TTS or Azure, chosen by a blind listening
test — but it does so having _assumed_ the answer is TTS. The two plans are consistent only if the
talent-vs-TTS question is settled here first; otherwise D7 picks a vendor for a path that was never
chosen. If it is filed as **Q-16**, scope the question as "voice source **and** provider", not
provider alone.

Audio is also the biggest driver of app size and prefetch budget
([offline-survival-mode.md](31-offline-survival-mode.md)) — decide bitrate against that budget, not
independently.

### 3. Reference data generation

`f0_native` (14-point `f0_display` plus full-resolution `f0_full`), quantised reference MFCC, and
per-syllable stress/duration — the `Reference` struct in `packages/core-rs/src/dsp/score.rs`.
Generate at content-build time with the _same_ Rust code the device runs, or the comparison is
between two different pipelines and every score inherits the difference.

### 4. The ten-point quality bar, enforced

`docs/product/content-model.md#quality-bar-for-a-catalog-phrase` defines it and the `$comment` says
every phrase must meet it. Encode as much as possible in `packages/content/src/checks.ts` so
`content:validate` fails on a violation rather than a reviewer catching it: register, CEFR level,
length, theme membership, required fields present, audio file exists and matches its declared
duration, `syl` count consistent with the text, IPA well-formed.

Some of the bar is human judgement (is this what a local would actually say?) and stays a review
step — document which checks are automated and which are not, so nobody assumes green means good.

### 5. Themes, scenarios, packs, and drops at scale

M2 wants 600 phrases, 30 scenarios, 10 packs, and drop schedules. Structural work, not just volume:
pack composition determines what onboarding seeds (`completeOnboarding` in the store), scenarios
back the roleplay screen, and drop schedules drive the trip arc.

### 6. Independent shipping, verified

ADR-0009: "a phrase fix needs no release." That is only true if the pack-publishing path actually
works end to end — versioning, ETag/caching, client-side pack updates, and a rollback for a bad
pack. Test the whole loop, including a learner on an old app version receiving a new pack, before
relying on it.

### 7. The content-quality dashboard

M4 scope, but the signals should be emitted from M2: which phrases get rated Difficult far more than
average, which get skipped, which have low ASR pass rates. That is the feedback loop to the content
lead, and it is worth much more than volume.

## Acceptance criteria

- 10 phrases pass through the complete pipeline before any bulk work starts.
- M1: 150 phrases with audio. M2: 600 phrases, 30 scenarios, 10 packs, drop schedules.
- Every phrase satisfies the automated portion of the quality bar; `content:validate` fails
  otherwise.
- Reference data is generated by the same Rust code the device runs.
- Audio meets the recording spec and the size budget; total prefetch stays within the documented
  cap.
- A phrase fix ships to devices with no app release, verified end to end including rollback.
- Content-quality signals are emitted.

## Tests

- `content:validate` extended with every automatable check; a deliberately broken fixture per check.
- A test that every phrase referenced by a pack, scenario, or drop exists (dangling-reference
  check).
- Audio integrity: every declared file exists, decodes, and matches its metadata.
- Reference-data determinism: regenerating produces identical output.

## Risks

- **Volume is the schedule risk.** 600 quality phrases with audio and reference data is the largest
  non-engineering task in v1, and it is sequenced against a part-time content lead
  (`docs/process/ways-of-working.md#the-team`). Flag it early; it is the most likely reason M2
  slips.
- **A phrase that is grammatical but not idiomatic** passes every automated check. Native review is
  not optional.

## Out of scope

`es-419` and other languages (Q-13, M6 — `docs/process/localization.md`).
