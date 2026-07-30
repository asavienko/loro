# 0011 · Treat the on-screen audio promise as a technical requirement

- **Status:** Accepted
- **Date:** 2026-07-28
- **Deciders:** Tech lead, product, mobile lead

## Context

The prosody lab displays this to the learner, in the footer, next to the microphone
(`Loro.dc.html:1281`):

> 🔒 **Private — your audio stays on your device**

That is not marketing copy in a privacy policy nobody reads. It is a sentence shown at the exact
moment a learner decides whether to press record.

Meanwhile, the tempting architecture for a pronunciation app is the opposite: upload the audio,
score it on a GPU with a good acoustic model, return a number. It is easier, more accurate, and
every competitor does it.

We also need analytics to answer the questions the product exists to answer — does the tagging
thread work, is automaticity real, which loop teaches better
([observability.md](../observability.md#learning-quality-telemetry)) — and analytics is where
privacy promises usually leak, one convenient property at a time.

## Options considered

### A · Server-side scoring, and change the screen copy

**Pros** Better accuracy; a real acoustic model; no on-device DSP to build or validate. **Cons**
Breaks offline function ([offline.md](../offline.md)), adds per-take latency and cost, and requires
us to delete a promise from a screen. It also makes the app's most personal data — a learner's voice
— a thing we hold.

### B · Server-side scoring with "anonymous" audio upload

**Rejected.** Voice is identifying; "anonymous audio" is close to a contradiction. And a promise
with an asterisk is not a promise.

### C · On-device scoring, and treat the displayed promise as a binding constraint

**Pros** The promise holds. Offline works. Zero marginal cost. Voice data is never ours to lose.
**Cons** We build and validate the DSP ourselves ([prosody-dsp.md](../prosody-dsp.md)); accuracy is
bounded by what runs in 200 ms on a mid-range phone.

## Decision

**Option C, elevated to an architectural invariant** ([overview.md](../overview.md#the-ten-rules),
rule 3):

> **Recorded audio never leaves the device.** Consent is not an exception.

And the corollary that makes it durable:

> **The promise is kept by making the violation hard to write, not by remembering not to write it.**

### How it is structurally enforced

| Mechanism                                                                              | Effect                                                                                                                                                              |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PCM lives in **native memory only**; `stopRecording()` returns a `bufferId`, not bytes | There is no JS API that yields audio, so upload code does not exist and would have to be deliberately added to a native module ([ADR-0007](0007-audio-pipeline.md)) |
| DSP runs in `loro-core` on a native thread, taking the buffer by handle                | Scoring never surfaces audio                                                                                                                                        |
| Buffer released within 50 ms of scoring                                                | Also a memory budget ([performance.md](../performance.md#memory))                                                                                                   |
| Audio is **never written to disk**                                                     | Nothing to attach to a crash report, nothing to find in a backup                                                                                                    |
| `take` stores numbers and a normalised contour — no audio, no path                     | [data-model.md](../data-model.md)                                                                                                                                   |
| Crash reporter configured with **no attachments**                                      |                                                                                                                                                                     |
| **A P0 alert on any network request originating in the audio module**                  | There should never be one ([observability.md](../observability.md#alerting))                                                                                        |
| No API endpoint accepts recorded learner audio                                         | [api.md](../api.md#tts)                                                                                                                                             |

### The analytics posture that follows

Because we take the audio promise literally, we take the rest literally too.

**Allowlists, not denylists.** An event property not explicitly allowlisted for its event name is
dropped before queueing. A CI test asserts every documented event's properties are allowlisted. With
a denylist, every new property is a leak until someone remembers to exclude it; with an allowlist, a
new property is invisible until someone justifies it.

**Never in telemetry:** recorded audio or any derivative beyond a numeric score; phrase text for
learner-authored phrases (a salted hash instead, so we can count without reading); note and
memory-hook text (a boolean instead); captured OCR text (a line count instead); ASR transcripts
(match outcome instead); email or provider identity; precise location.

**Opt-out is client-side.** With analytics disabled, nothing is queued — not merely not sent.

**Learner data is never used for model training.** Cheap to promise and true in the pipeline,
because our AI use is text generation from a prompt, not personalisation from a corpus
([ADR-0010](0010-llm-roleplay-and-guardrails.md)).

**Analytics consent** is off by default and revocable
([security-privacy.md](../security-privacy.md#consent-surfaces)).

## Consequences

### Good

- The screen tells the truth, which is the whole point.
- Scoring works offline and at zero marginal cost — the DSP being on-device is why the labs are
  usable on a plane and why they don't appear in the cost model.
- Voice data is never in our possession, so it cannot be breached, subpoenaed, or leaked by us. The
  strongest privacy posture is not holding the data.
- The P0 audio-egress canary means a future engineer who _does_ add an upload finds out immediately,
  before a learner does.
- Allowlisted analytics fails safe, which is what makes the privacy claims durable across a year of
  feature work.
- A genuine differentiator, honestly earned, in a category where the norm is uploading people's
  voices.

### Bad — accepted deliberately

- **Accuracy is bounded** by what fits in 200 ms on the device floor. We use DTW against a native
  reference rather than a trained acoustic model
  ([prosody-dsp.md](../prosody-dsp.md#3--forced-alignment)). Mitigated by a validation gate: if
  native speakers don't agree with our scores ≥80% of the time, **the labs don't ship** — a wrong
  score is worse than no score.
- We build and maintain the DSP, including golden tests to prevent silent drift.
- Analytics is less rich than a permissive setup. Accepted: the questions we actually need answered
  (retention, latency trends, tag predictiveness) are all answerable with ids and numbers.
- The salted-hash approach means we can never inspect a problematic learner-authored phrase, even to
  debug. Accepted.

### Revisit if…

- The DSP validation gate fails and cannot be fixed on-device. Then the honest options are a
  contour-only lab (no per-syllable numbers, much easier to get right) or no scoring lab. Server
  scoring is not a fallback.
- A regulator or platform requirement forces a change in what we can say on screen.
- On-device acoustic models become small enough to bundle, which would raise accuracy with no change
  to the promise. This is the likeliest and happiest trigger.
