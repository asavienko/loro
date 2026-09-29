# Open questions

Unresolved decisions, with an owner and the date each one starts blocking. Reviewed in the weekly
review.

**Status** — `open` (needs an answer) · `leaning` (we have a working assumption, stated) ·
`deferred` (deliberately not now) · `closed` (answered; kept for the record with the answer).

| #             | Question                                                                  | Status      | Owner                 | Blocks                              | By                       |
| ------------- | ------------------------------------------------------------------------- | ----------- | --------------------- | ----------------------------------- | ------------------------ |
| [Q-01](#q-01) | Is 6 reps the right Refrain target?                                       | leaning     | Product               | Tuning, not shipping                | M3                       |
| [Q-02](#q-02) | Should graduation require a _cold_ lock-in?                               | open        | Product               | Loop B correctness                  | M3                       |
| [Q-03](#q-03) | Does learner-declared difficulty stay accurate?                           | open        | Product               | The whole thread's validity         | M3                       |
| [Q-04](#q-04) | Should the ladder be the universal depth model?                           | leaning     | Tech lead             | Nothing — already mitigated         | M5                       |
| [Q-05](#q-05) | Who owns the loop decision, and when?                                     | **open**    | **Product**           | **Experiment activation; Run**      | **Before M3 experiment** |
| [Q-06](#q-06) | Is the practice loop a setting or an assignment?                          | leaning     | Product               | Settings UI, experiment design      | M2                       |
| [Q-07](#q-07) | How does trip mode serve "moving abroad"?                                 | **open**    | **Product**           | **Plan 69 trip state machine**      | **Before plan 69**       |
| [Q-08](#q-08) | Pricing, tiers, and the paywall                                           | **open**    | **Product**           | **v1 launch**                       | **M2 mid**               |
| [Q-09](#q-09) | SQLCipher for the local database?                                         | deferred    | Tech lead             | Nothing today                       | Revisit at M4            |
| [Q-10](#q-10) | A text-production mode for deaf learners?                                 | open        | Product + design      | Accessibility completeness          | M3                       |
| [Q-12](#q-12) | Store mechanics: RevenueCat or direct?                                    | **open**    | **Backend**           | **Plan 74 implementation**          | **Before plan 74**       |
| [Q-13](#q-13) | Is `es-419` a later target variant beyond the current starter courses?    | deferred    | Product               | Nothing pre-v1                      | Post-v1                  |
| [Q-14](#q-14) | How should the Refrain's peak card render its English subtitle?           | **open**    | **Design**            | **Plan 72 peak sign-off**           | **Before M2 release**    |
| [Q-15](#q-15) | Which licensed voice and source produce production audio?                 | **leaning** | **Product**           | **Pronunciation review; live seed** | **2026-09-10**           |
| [Q-16](#q-16) | Is guided open chat committed v1.1 scope or an experiment?                | **open**    | **Product**           | **Chat release enablement**         | **2026-08-06**           |
| [Q-17](#q-17) | Which daily destinations earn a home-rail slot?                           | **open**    | **Product + design**  | **Plan 81 rail ordering**           | **2026-08-06**           |
| [Q-18](#q-18) | Who can use live chat, and what is its provider budget?                   | **open**    | **Product + finance** | **Plan 82 live provider**           | **2026-08-06**           |
| [Q-19](#q-19) | How long are local chat threads retained?                                 | **open**    | **Product + privacy** | **Plan 82 persistence**             | **2026-08-06**           |
| [Q-20](#q-20) | May a provider retain chat text, and for how long?                        | **open**    | **Privacy + backend** | **Plan 82 provider contract**       | **2026-08-06**           |
| [Q-21](#q-21) | May Discover request live phrase suggestions, and under what eval/budget? | **leaning** | **Product + privacy** | **Plan 97 live suggest**            | **Before live garnish**  |
| [Q-22](#q-22) | May licensed neural TTS audio be shared as a learner-owned file?          | **open**    | **Privacy + content** | **Plan 99 share-out-of-app**        | **Before neural export** |

---

<a id="q-01"></a>

### Q-01 · Is 6 reps the right Refrain target?

The blueprint uses 6 (`Loro.dc.html:3361`) and `automaticity = reps/6`. It's a reasonable number
with no evidence behind it.

**Leaning:** ship 6, expose it as `refrain.repTarget` (already a flag), and run 4/6/8 as the first
experiment ([experimentation.md](../process/experimentation.md#the-loop-experiment)). An adaptive
target (stop when measured latency plateaus) is more elegant but harder to make legible — "you
always see today" depends on the learner knowing how much work today is.

---

<a id="q-02"></a>

### Q-02 · Should graduation require a _cold_ lock-in?

Currently four days of lock-in graduates a phrase, and a day's reps might end on Cloze rather than
Cold. A phrase that has never been produced from memory alone arguably hasn't been learned.

**Options:** (a) four days as-is; (b) the final day must reach Cold mode; (c) a separate cold probe
before graduation. (c) is also the cleanest source for the loop experiment's common measure — worth
deciding alongside Q-05.

---

<a id="q-03"></a>

### Q-03 · Does learner-declared difficulty stay accurate over weeks?

**The most important open question in the product.** The connective thread assumes the learner keeps
their ratings roughly honest. If they set them once at add-time and never revisit, the signal decays
and the whole mechanic becomes decoration.

Measured by **tag predictiveness** — AUC of declared difficulty predicting recall failure, target
≥0.65
([`../architecture/observability.md`](../architecture/observability.md#learning-quality-telemetry)).

If it decays: add drift correction — nudge FSRS difficulty from observed performance and prompt a
re-rate when the two disagree strongly. That's a real feature, so we need the measurement before M3.

---

<a id="q-04"></a>

### Q-04 · Should the ladder be the universal depth model?

The five-rung ladder is the most pedagogically defensible progress model in the blueprint, and it
belongs to Loop C, which ships last.

**Leaning: already mitigated.** We persist `rung` on every phrase from v1, maintained by whichever
engine is active ([ADR-0006](../architecture/adr/0006-pluggable-practice-engines.md)). So the data
exists regardless. The open part is whether the ladder should become a _visible_ progress surface in
v1, replacing or joining the four mastery buckets on the Progress screen.

---

<a id="q-05"></a>

### Q-05 · Who owns the loop decision, and when? 🔴

The engine abstraction preserves optionality, but optionality without a decision date becomes
indecision.

**Needs:** a named owner, a decision date, a pre-registered primary metric, and a required sample
size. The metric and design are drafted
([`../product/practice-loops.md`](../product/practice-loops.md#how-well-actually-decide)); the owner
and the power calculation are not.

**Blocks activation of the M3 loop experiment and plan 78's Run decision**, because the common cold
probe has to be instrumented before the arms are live — you cannot retro-fit the measure onto an
experiment already running. It does not block unrelated M3 implementation such as Review/Memory or
Roleplay once their technical dependencies pass.

---

<a id="q-06"></a>

### Q-06 · Is the practice loop a setting or an assignment?

**Leaning:** assign a default from the onboarding goal, allow switching in Settings, log switches as
a signal (implemented in `resolveEngine`,
[practice-engines.md](../architecture/practice-engines.md#engine-resolution)).

Assignment gives cleaner experiment cohorts and fewer confused learners; a setting is more
respectful. The hybrid is probably right but it does mean the experiment has self-selection leakage,
which Q-05's design has to account for.

---

<a id="q-07"></a>

### Q-07 · How does trip mode serve "moving abroad"?

Ana's persona picks "moving abroad", which is a _date_ but not a _trip_. Survival mode never ends,
and drops should presumably continue weekly rather than stopping.

Currently the trip machinery assumes a return. Options: (a) an "indefinite" trip type with no return
date and continuing weekly drops; (b) a distinct "relocation" mode; (c) treat it as a normal trip
with a far-future return date. (a) is cheapest and probably right.

**Blocks plan 69 before the trip state machine is committed.** Navigation, persistence, content, and
scheduling foundations may proceed; implementing return/end semantics may not.

---

<a id="q-08"></a>

### Q-08 · Pricing, tiers, and the paywall 🔴

Everything in [`../product/monetization.md`](../product/monetization.md) is a **proposal, not a
decision** — the blueprint contains no monetization surface at all.

**Needs before M2 mid:** willingness-to-pay research across all four personas; a decision on whether
the Trip Pass is a compromise or the primary SKU; confirmation that the free tier teaches enough to
be honest; and regional pricing tiers.

The Trip Pass question is the interesting one: if trip-mode learners convert at several times
everyday learners, the whole pricing model should be built around trips.

---

<a id="q-09"></a>

### Q-09 · SQLCipher for the local database?

Currently we rely on OS full-disk encryption
([`../architecture/security-privacy.md`](../architecture/security-privacy.md#encryption)). SQLCipher
costs 5–15% on every read, and the hot path (reading phrase state mid-rep) is latency-sensitive.

**Deferred.** The data is a phrase library — personal, but not credentials or health data. Revisit
if we ever store something more sensitive, or if a platform requirement changes.

---

<a id="q-10"></a>

### Q-10 · A text-production mode for deaf learners?

Loro is a pronunciation-and-melody app, and for a profoundly deaf learner the labs and speaking
gates aren't meaningfully usable
([`../architecture/accessibility.md`](../architecture/accessibility.md#the-honest-limitation)).

**Proposal:** typing the phrase as a first-class alternative to saying it — same gate, same
progress, same FSRS write. Not scoped. It's a genuine feature, not an accessibility afterthought,
and it would also serve anyone who can't speak aloud in the moment (open office, quiet carriage,
sleeping baby) — which is a much larger group than the accessibility framing suggests.

---

<a id="q-12"></a>

### Q-12 · Store mechanics: RevenueCat or direct StoreKit 2 / Play Billing?

RevenueCat is faster to implement, handles receipt validation and cross-platform entitlements, and
costs a revenue share. Direct is more work and more control.

Relevant constraint: entitlements must be cached client-side with a grace period so a learner abroad
with no network doesn't lose Plus mid-trip
([`../architecture/backend.md`](../architecture/backend.md#billing)). Whichever we choose has to
support that cleanly.

---

<a id="q-13"></a>

### Q-13 · Is `es-419` a later target variant beyond the current starter courses?

Latin American Spanish is a variant (4–6 weeks) and probably a larger market than `es-ES`
([localization.md](../process/localization.md#the-cheap-one-es-419)). English/Bulgarian/Russian UI
and Bulgarian/Russian starter targets already landed in plan 87; this question now concerns adding
es-419 beyond that scope, with its own content/voice review.

**Deferred** until post-v1 — but worth noting now, because `variants[]` is already in the phrase
schema, which is what keeps this cheap later.

---

<a id="q-14"></a>

### Q-14 · How should the Refrain's peak card render its English subtitle?

Found by the contrast gate, not by inspection — which is the gate doing its job.

At 100% automaticity the warming card is a hot-coral gradient with white text. The blueprint puts a
**13 px English subtitle in white at 0.7 opacity** on it (`Loro.dc.html:1442`). White on the
gradient's light stop is **2.66:1** — below even the 3:1 large-text floor.

Darkening the light stop to `#d28145` gets white to 3.01:1, which is fine for the 26 px phrase. But
the 13 px subtitle needs 4.5:1, and reaching that means darkening the gradient to roughly
`#a86737 → #8f4119` — **a muddy brown, which destroys the app's single most important reward
moment.**

So the constraint was _recorded and enforced_ rather than resolved: the first app's
`packages/design-tokens/tokens/color.json` declared `warming.peak.textSizeFloor: "large"`, and
`checkContrast.ts` failed if that floor was removed. That package was removed with the first app on
2026-09-30; the current app has no warming card.

**Options**

- (a) Drop the English subtitle at peak. Arguably right — at 100% the learner owns the phrase.
- (b) Render the subtitle on a solid inset chip rather than on the gradient.
- (c) Accept the muddy gradient.
- (d) Keep white but raise the subtitle to ≥17 px semibold.

Lean: (a) or (b). Needs the designer.

---

<a id="q-15"></a>

### Q-15 · Which licensed voice and source produce production audio?

The bundled catalog remains text-only on disk. Plan 61 still cannot ship a listened seed batch, and
plan 62 cannot treat cached files as the pronunciation reference, until a content-lead listen
passes.

**Provider decision — 2026-09-07 (product owner): ElevenLabs is the selected cloud TTS provider**,
including for Bulgarian and Polish audio evaluation. This supersedes the earlier Amazon Polly
recommendation and the historical ElevenLabs rejection in archived plan 45. It does not add Polish
to the shipped course catalog.

**Leaning — 2026-09-10 (product owner): pin `eleven_multilingual_v2` and the Voice Library IDs in
the [listening-voice packet](listening-voice-packet.md) for in-app catalog reference (`AS-01`) and
listening cache/playback (`AS-07`).** Filling
[`CATALOG_REFERENCE_VOICES`](../../packages/core/src/listening/constants.ts) and
[`LISTENING_VOICE_DECISION`](../../packages/core/src/listening/constants.ts) is the
licensed-generate switch. Local and CI stay on `TTS_PROVIDER=stub` and must not spend credits. This
pin does **not** claim a bilingual pronunciation listen happened, does not make the clips
production-quality, and does **not** grant share-out-of-app ([Q-22](#q-22);
`LISTENING_SHARE_ENABLED` stays false). Official default voices (Rachel `21m00Tcm4TlvDq8ikWAM` and
siblings) expire 2026-12-31 and are rejected. Voice Library / PVC voices can be withdrawn; a
withdrawn id fails closed rather than substituting another locale.

| Class     | Locale  | Voice ID               | Name          |
| --------- | ------- | ---------------------- | ------------- |
| Catalog   | `es-ES` | `t9LRTh3y1ioN00e9wsNh` | Aaron Abad    |
| Catalog   | `bg-BG` | `406EiNlYvqFqcz3vsnOm` | Peter K       |
| Catalog   | `ru-RU` | `1qd9R09Ljlx9V1Ok0t5S` | Ivan          |
| Listening | `es-ES` | `KHCvMklQZZo0O30ERnVn` | Sara Martin 1 |
| Listening | `es-ES` | `usTmJvQOCyW3nRcZ8OEo` | Dante         |
| Listening | `bg-BG` | `M1ydWt7KnBCiuv4CnEDC` | Milena        |
| Listening | `bg-BG` | `gdk0ZsvfAOobfbTtnx6p` | Kosta         |
| Listening | `ru-RU` | `EDpEYNf6XIeKYRzYcx4I` | MARIIA_R      |
| Listening | `ru-RU` | `ogi2DyUAKJb7CEdqqvlU` | Stanislav     |

**Budget (character-based; no invented USD):** catalog is one take per phrase for 150 then 600;
listening defaults to 3 takes/phrase rotating two IDs (`A`, `B`, `A`). Fail closed on 429/402.

**Replacement:** a failed listen replaces that listening ID, or re-renders the whole catalog if the
reference voice is wrong. Never silently substitute another locale. Device TTS is a labeled in-app
fallback, not a bypass of this gate.

**Still needed before calling these production-quality / shipping the seed batch:** content-lead
listen of starter phrases; live `TTS_API_KEY` on a paid plan with Voice Library add-to-My-Voices;
commercial redistribution for Q-22; physical-device 58/72. This environment had no decryptable
`TTS_API_KEY`, so no live ElevenLabs seed was cached. Learner recordings remain subject to the
separate non-negotiable that PCM never leaves native memory/the device.

---

<a id="q-16"></a>

### Q-16 · Is guided open chat committed v1.1 scope or an experiment?

`Loro Chat.dc.html` authors Open chat and Message inspector as “Loop D”, but it does not decide
whether the production surface is a generally available v1.1 commitment, a bounded experiment, or a
later release. That choice changes release flags, evaluation sample, entitlement messaging, and how
much content/provider capacity must exist at launch.

**Invariant while open:** plans 79/82 may define the private domain, bundled topic floor, safety
contract, and evaluation harness. Plan 83 must not claim general availability or enable the route
for release until Product chooses the launch posture. The answer cannot weaken offline fallback,
explicit save, real-output, or recorded-audio privacy requirements.

**Decision owner/date:** Product, 2026-08-06.

---

<a id="q-17"></a>

### Q-17 · Which daily destinations earn a home-rail slot?

This number is intentionally reserved for the authored navigation question at
`Navigation.dc.html:865–873`: route frequency belongs beside depth. The contract requires every
route to declare `expectedUse: daily | weekly | rare`; the remaining judgment is which daily routes
win the scarce rail positions on each resolved home. The artifact's example says daily Review
outranks weekly Add, but does not fully classify every current/future destination.

**Invariant while open:** plan 81 can land the route metadata, spine, switcher, and state-driven
More menu. It must not hardcode Today as the only home or let any built daily destination become
unreachable. Rail ordering remains data on each possible resolved home.

**Decision owner/date:** Product + design, 2026-08-06.

---

<a id="q-18"></a>

### Q-18 · Who can use live chat, and what is its provider budget?

The bundled conversation floor works for every eligible chat learner without a provider. A live text
request adds variable cost and abuse surface, so the release needs a decision on free/paid or
experimental entitlement, per-user turn/rate/cost limits, global daily spend, and what happens at
the cap. This decision is narrower than Q-08's whole-product pricing and does not wait for a final
subscription SKU.

**Invariant while open:** budget exhaustion selects the bundled continuation without fabricated
typing or a fake live reply. It never disables the conversation, uploads audio, or exposes an
internal allowance as a learner score.

**Decision owner/date:** Product + finance, 2026-08-06.

---

<a id="q-19"></a>

### Q-19 · How long are local chat threads retained?

Open chat needs crash/relaunch resume, Start over, export, erasure, and bounded storage, but the
authored design does not choose whether completed local threads expire after days, weeks, or only on
explicit deletion. The answer must cover active drafts, turns, inspector evidence, and what happens
to explicitly kept phrases when their source thread expires.

**Invariant while open:** thread text is local/private by default, excluded from telemetry and
ordinary phrase sync. Explicitly kept phrases remain ordinary learner-owned records with source
metadata; thread expiry cannot silently delete them. Start over is explicit and confirmable when
retained learner turns exist.

**Decision owner/date:** Product + privacy, 2026-08-06.

---

<a id="q-20"></a>

### Q-20 · May a provider retain chat text, and for how long?

A guarded live request necessarily sends bounded transcript text unless an approved zero-retention
provider mode makes a stronger guarantee. Before `/v1/chat/turn` can ship, choose whether any
provider retention is permitted, its maximum window and region, training/secondary-use prohibition,
deletion/export duties, and the consent/copy required before the first live request.

**Invariant while open:** no production live request. Bundled topics remain usable offline. Audio is
structurally absent; prompts/logs/telemetry contain no thread text or ASR transcript; and local
development defaults to the bundled path.

**Decision owner/date:** Privacy + backend, 2026-08-06.

---

<a id="q-21"></a>

### Q-21 · May Discover request live phrase suggestions, and under what eval/budget?

Catalog search, authored scenarios, Add your own and bundled topic packs are enough for an honest
offline Discover. A live `/v1/phrases/suggest` path would extend reach for situations the library
does not cover, at the cost of unreviewed language reaching the learner as **marked, editable
own-phrase candidates**.

**Leaning:** share the existing per-user/global AI spend cap; keep live Discover garnish **off**
until a named eval corpus passes per target/native pair (naturalness, length, register, safety,
injection, no silent Spanish substitution). Cache only `(folded_query, pair, content_version)`.
Provider retention follows the same unresolved bar as Q-20; until then the stub returns bundled or
empty suggestions with no production request.

**Invariant while open:** no production live suggest request. Bundled topics and Add your own remain
usable offline. Audio is structurally absent from the type. Telemetry contains no query or phrase
text.

**Decision owner/date:** Product + privacy, 2026-09-09.

---

<a id="q-22"></a>

### Q-22 · May licensed neural TTS audio be shared off-device as a learner-owned file?

In-app cache keeps model audio inside Loro. A listening export writes an AAC/M4A the learner can
copy into Files, Music, or a car player. That is redistribution of synthesised speech, which Q-15
does not by itself decide.

Plan 99's **primary path** is online generation plus on-device cache, then in-app listen from disk.
That in-app cache is the same privacy class as planned catalog audio (`AS-01`): it stays in the app.
Q-15 leaning pins cover in-app generate; they do **not** answer this question.

**Still needed before neural share-out-of-app:** commercial and personal-copy rights for each pinned
listening voice; whether the learner may keep the file after uninstall; deletion if a voice licence
is withdrawn; and an honest UI that never implies a neural voice when the clip was device-TTS
fallback.

**Invariant while open:** plan 99 may ship **in-app** cache and in-app listen of licensed neural
clips. It must not write ElevenLabs (or other licensed neural) audio to a shareable learner-owned
file, and must not present device-TTS output as that neural file. A device-TTS-only export is not
the v1 companion and is out of scope for the first slices.

**Decision owner/date:** Privacy + content, 2026-09-09. Not resolved by the 2026-09-09 online-first
listening-cache specification. Q-21 remains Discover live suggest.

---

## Closed

<a id="q-11"></a>

### Q-11 · Rename the blueprint folder? — closed 2026-07-30

**Decision: retain `design/Language Learning by Phrases - V1.1/` as the canonical path.** The
artefact has already moved under `design/`, its versioned authored name distinguishes it from future
blueprints, and repository citations/tooling now use that location. The inconvenience of quoting a
path with spaces is smaller than another repo-wide rename and citation migration. This is no longer
an M1 blocker.

**Update 2026-09-30:** the folder was removed from the tree with the first app. It remains in Git
history at `52a0e3b`; `apps/mobile` is now the reference for learner-visible behaviour.
