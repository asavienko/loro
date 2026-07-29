# Open questions

Unresolved decisions, with an owner and the date each one starts blocking. Reviewed in the weekly
review.

**Status** — `open` (needs an answer) · `leaning` (we have a working assumption, stated) ·
`deferred` (deliberately not now) · `closed` (answered; kept for the record with the answer).

| #             | Question                                                        | Status   | Owner            | Blocks                         | By            |
| ------------- | --------------------------------------------------------------- | -------- | ---------------- | ------------------------------ | ------------- |
| [Q-01](#q-01) | Is 6 reps the right Refrain target?                             | leaning  | Product          | Tuning, not shipping           | M3            |
| [Q-02](#q-02) | Should graduation require a _cold_ lock-in?                     | open     | Product          | Loop B correctness             | M3            |
| [Q-03](#q-03) | Does learner-declared difficulty stay accurate?                 | open     | Product          | The whole thread's validity    | M3            |
| [Q-04](#q-04) | Should the ladder be the universal depth model?                 | leaning  | Tech lead        | Nothing — already mitigated    | M5            |
| [Q-05](#q-05) | Who owns the loop decision, and when?                           | **open** | **Product**      | **The loop experiment**        | **M3 start**  |
| [Q-06](#q-06) | Is the practice loop a setting or an assignment?                | leaning  | Product          | Settings UI, experiment design | M2            |
| [Q-07](#q-07) | How does trip mode serve "moving abroad"?                       | open     | Product          | Trip arc completeness          | M2            |
| [Q-08](#q-08) | Pricing, tiers, and the paywall                                 | **open** | **Product**      | **v1 launch**                  | **M2 mid**    |
| [Q-09](#q-09) | SQLCipher for the local database?                               | deferred | Tech lead        | Nothing today                  | Revisit at M4 |
| [Q-10](#q-10) | A text-production mode for deaf learners?                       | open     | Product + design | Accessibility completeness     | M3            |
| [Q-11](#q-11) | Rename the blueprint folder?                                    | open     | Tech lead        | Tooling ergonomics             | M1            |
| [Q-12](#q-12) | Store mechanics: RevenueCat or direct?                          | open     | Backend          | Billing implementation         | M2 start      |
| [Q-13](#q-13) | Is `es-419` the next language, before UI localization?          | deferred | Product          | Nothing pre-v1                 | Post-v1       |
| [Q-14](#q-14) | How should the Refrain's peak card render its English subtitle? | open     | Design           | Loop B accessibility           | M2            |

---

### Q-01 · Is 6 reps the right Refrain target?

The blueprint uses 6 (`Loro.dc.html:3361`) and `automaticity = reps/6`. It's a reasonable number
with no evidence behind it.

**Leaning:** ship 6, expose it as `refrain.repTarget` (already a flag), and run 4/6/8 as the first
experiment ([experimentation.md](../process/experimentation.md#the-loop-experiment)). An adaptive
target (stop when measured latency plateaus) is more elegant but harder to make legible — "you
always see today" depends on the learner knowing how much work today is.

---

### Q-02 · Should graduation require a _cold_ lock-in?

Currently four days of lock-in graduates a phrase, and a day's reps might end on Cloze rather than
Cold. A phrase that has never been produced from memory alone arguably hasn't been learned.

**Options:** (a) four days as-is; (b) the final day must reach Cold mode; (c) a separate cold probe
before graduation. (c) is also the cleanest source for the loop experiment's common measure — worth
deciding alongside Q-05.

---

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

### Q-04 · Should the ladder be the universal depth model?

The five-rung ladder is the most pedagogically defensible progress model in the blueprint, and it
belongs to Loop C, which ships last.

**Leaning: already mitigated.** We persist `rung` on every phrase from v1, maintained by whichever
engine is active ([ADR-0006](../architecture/adr/0006-pluggable-practice-engines.md)). So the data
exists regardless. The open part is whether the ladder should become a _visible_ progress surface in
v1, replacing or joining the four mastery buckets on the Progress screen.

---

### Q-05 · Who owns the loop decision, and when? 🔴

The engine abstraction preserves optionality, but optionality without a decision date becomes
indecision.

**Needs:** a named owner, a decision date, a pre-registered primary metric, and a required sample
size. The metric and design are drafted
([`../product/practice-loops.md`](../product/practice-loops.md#how-well-actually-decide)); the owner
and the power calculation are not.

**Blocks M3 start**, because the common cold probe has to be instrumented before the arms are live —
you cannot retro-fit the measure onto an experiment already running.

---

### Q-06 · Is the practice loop a setting or an assignment?

**Leaning:** assign a default from the onboarding goal, allow switching in Settings, log switches as
a signal (implemented in `resolveEngine`,
[practice-engines.md](../architecture/practice-engines.md#engine-resolution)).

Assignment gives cleaner experiment cohorts and fewer confused learners; a setting is more
respectful. The hybrid is probably right but it does mean the experiment has self-selection leakage,
which Q-05's design has to account for.

---

### Q-07 · How does trip mode serve "moving abroad"?

Ana's persona picks "moving abroad", which is a _date_ but not a _trip_. Survival mode never ends,
and drops should presumably continue weekly rather than stopping.

Currently the trip machinery assumes a return. Options: (a) an "indefinite" trip type with no return
date and continuing weekly drops; (b) a distinct "relocation" mode; (c) treat it as a normal trip
with a far-future return date. (a) is cheapest and probably right.

---

### Q-08 · Pricing, tiers, and the paywall 🔴

Everything in [`../product/monetization.md`](../product/monetization.md) is a **proposal, not a
decision** — the blueprint contains no monetization surface at all.

**Needs before M2 mid:** willingness-to-pay research across all four personas; a decision on whether
the Trip Pass is a compromise or the primary SKU; confirmation that the free tier teaches enough to
be honest; and regional pricing tiers.

The Trip Pass question is the interesting one: if trip-mode learners convert at several times
everyday learners, the whole pricing model should be built around trips.

---

### Q-09 · SQLCipher for the local database?

Currently we rely on OS full-disk encryption
([`../architecture/security-privacy.md`](../architecture/security-privacy.md#encryption)). SQLCipher
costs 5–15% on every read, and the hot path (reading phrase state mid-rep) is latency-sensitive.

**Deferred.** The data is a phrase library — personal, but not credentials or health data. Revisit
if we ever store something more sensitive, or if a platform requirement changes.

---

### Q-10 · A text-production mode for deaf learners?

Loro is a pronunciation-and-melody app, and for a profoundly deaf learner the labs and speaking
gates aren't meaningfully usable
([`../architecture/accessibility.md`](../architecture/accessibility.md#the-honest-limitation)).

**Proposal:** typing the phrase as a first-class alternative to saying it — same gate, same
progress, same FSRS write. Not scoped. It's a genuine feature, not an accessibility afterthought,
and it would also serve anyone who can't speak aloud in the moment (open office, quiet carriage,
sleeping baby) — which is a much larger group than the accessibility framing suggests.

---

### Q-11 · Rename the blueprint folder?

`Language Learning by Phrases/` has spaces, which is awkward for scripts, globs, and CI paths.
`design/blueprint/` would be cleaner.

Against: it's the author's artefact and every doc in this repo cites paths into it. If we rename,
all citations update in the same PR.

---

### Q-12 · Store mechanics: RevenueCat or direct StoreKit 2 / Play Billing?

RevenueCat is faster to implement, handles receipt validation and cross-platform entitlements, and
costs a revenue share. Direct is more work and more control.

Relevant constraint: entitlements must be cached client-side with a grace period so a learner abroad
with no network doesn't lose Plus mid-trip
([`../architecture/backend.md`](../architecture/backend.md#billing)). Whichever we choose has to
support that cleanly.

---

### Q-13 · Is `es-419` the next language, before UI localization?

Latin American Spanish is a variant (4–6 weeks) and probably a larger market than `es-ES`
([localization.md](../process/localization.md#the-cheap-one-es-419)). UI localization is a different
kind of work with a different payoff.

**Deferred** until post-v1 — but worth noting now, because `variants[]` is already in the phrase
schema, which is what keeps this cheap later.

---

### Q-14 · How should the Refrain's peak card render its English subtitle?

Found by the contrast gate, not by inspection — which is the gate doing its job.

At 100% automaticity the warming card is a hot-coral gradient with white text. The blueprint puts a
**13 px English subtitle in white at 0.7 opacity** on it (`Loro.dc.html:1442`). White on the
gradient's light stop is **2.66:1** — below even the 3:1 large-text floor.

Darkening the light stop to `#d28145` gets white to 3.01:1, which is fine for the 26 px phrase. But
the 13 px subtitle needs 4.5:1, and reaching that means darkening the gradient to roughly
`#a86737 → #8f4119` — **a muddy brown, which destroys the app's single most important reward
moment.**

So the constraint is currently _recorded and enforced_ rather than resolved:
`packages/design-tokens/tokens/color.json` declares `warming.peak.textSizeFloor: "large"`, and
`checkContrast.ts` fails if that floor is removed while the colours stay as they are.

**Options**

- (a) Drop the English subtitle at peak. Arguably right — at 100% the learner owns the phrase.
- (b) Render the subtitle on a solid inset chip rather than on the gradient.
- (c) Accept the muddy gradient.
- (d) Keep white but raise the subtitle to ≥17 px semibold.

Lean: (a) or (b). Needs the designer.

---

## Closed

None yet. When a question closes, move it here with its answer and the date — the reasoning is worth
more than the conclusion.
