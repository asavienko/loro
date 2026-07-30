# Monetization

⚠️ **Not validated.** This is a proposal, not a decision. The blueprint contains no pricing,
paywall, or upgrade surface — so everything here is inference from the product shape, and the
numbers are placeholders pending research. Tracked as **Q-08** in
[open-questions.md](../decisions/open-questions.md).

---

## The principle

**Never paywall the thing that helps someone in a foreign country.** A learner standing in a taxi
rank in Madrid must be able to open Loro and find the phrase they need. If that moment is behind a
subscription, the product has failed at the only job the primary persona hired it for.

Everything else is negotiable.

---

## Proposed tiers

### Free — permanently useful

| Included                                 | Limit                          |
| ---------------------------------------- | ------------------------------ |
| Onboarding + starter packs               | Full                           |
| Phrase stream (hands-free listening)     | Full                           |
| The Daily Refrain                        | **3 phrases/day** instead of 5 |
| Add your own phrases                     | Up to **60 owned phrases**     |
| Import (paste a list)                    | Full                           |
| Catalog browsing and Discover            | Full                           |
| Progress screen                          | Full                           |
| Speak to progress (ASR)                  | Full                           |
| **Survival mode, once a trip is set up** | **Full, forever**              |
| Native audio for owned phrases           | Full                           |

### Loro Plus — the learner who's actually committed

| Additional                                           |                  |
| ---------------------------------------------------- | ---------------- |
| Unlimited owned phrases                              |                  |
| Full 5-phrase Refrain, all three waves, ambient loop |                  |
| Review sessions + memory-model view                  |                  |
| Pronunciation lab + prosody lab                      |                  |
| Roleplay scenes                                      | Fair-use limited |
| The trip arc — countdown, daily drops, widget        |                  |
| Capture (photograph a sign or menu)                  | Fair-use limited |
| Cross-device sync                                    |                  |

**Placeholder pricing:** $8.99/mo · $47.99/yr (56% off) · 7-day trial, no card up front. A one-off
**Trip Pass** ($12.99, 30 days of Plus) exists for the one-trip learner who will never subscribe —
it's the honest offer for Mara, and refusing to make it just loses the sale.

---

## Where the paywall goes

Three moments, all of them after the learner has felt the value:

| Trigger                              | Context                                              | Ask               |
| ------------------------------------ | ---------------------------------------------------- | ----------------- |
| **61st phrase**                      | They're invested enough to have a real library       | Unlimited phrases |
| **First trip setup**                 | Highest intent moment in the product                 | Trip Pass or Plus |
| **First prosody/pronunciation take** | They just saw their pitch contour against a native's | Plus              |

Never: at launch, before the first session, or mid-session. A learner interrupted between rep 4 and
rep 5 of the Refrain will not convert; they'll quit.

---

## Why not the alternatives

| Model                                | Why not                                                                                                                         |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| **Ads**                              | The core surface is audio. An ad in a listening stream is intolerable, and an ad on the survival screen abroad is indefensible. |
| **Pay per pack**                     | Fragments the catalog and makes the daily drop a store. The trip arc's escalation would become a purchase funnel.               |
| **Freemium with a hard lesson gate** | We have no lessons. Gating _days_ re-introduces the punishment mechanic the product explicitly rejects.                         |
| **One-time purchase only**           | Content, TTS, and AI are recurring costs; a perpetual licence doesn't fund them. Offered as the Trip Pass compromise instead.   |
| **Streak-loss recovery purchases**   | Actively hostile, and contradicts [vision.md](vision.md#what-loro-is-not).                                                      |

---

## Cost structure per learner

Rough monthly marginal cost of an active Plus learner. Assumptions are in
[`architecture/ai-services.md`](../architecture/ai-services.md#cost-model); re-derive before setting
a price.

| Cost                            | Estimate        | Notes                                                     |
| ------------------------------- | --------------- | --------------------------------------------------------- |
| TTS (catalog)                   | ~$0             | Rendered once at content build, served from CDN           |
| TTS (learner phrases)           | ~$0.01          | On-device TTS by default; server render only if requested |
| ASR                             | ~$0             | On-device; reveal mode is the unavailable fallback        |
| LLM roleplay + coach notes      | ~$0.10–0.30     | Cached scenes; the dominant AI cost                       |
| Prosody / pronunciation scoring | $0              | 🔒 On-device by design                                    |
| CDN + storage                   | ~$0.01          | ~10 MB/learner                                            |
| Backend (sync, content, API)    | ~$0.03          |                                                           |
| **Total**                       | **~$0.15–0.35** | Placeholder until pricing/provider decisions close        |

The architecture keeps costs low **because** it pushes work to the device — on-device ASR and
on-device DSP were chosen for privacy and offline function first
([ADR-0005](../architecture/adr/0005-on-device-asr-cloud-fallback.md)), and cheap unit economics are
the side effect.

**The one cost that can run away is roleplay.** Mitigations, all in
[`architecture/ai-services.md`](../architecture/ai-services.md): aggressive scene caching keyed by
`(theme, level, tag-profile)`, per-learner rate limits, prompt caching, and a bundled fallback scene
set that makes a hard cap acceptable rather than breaking.

---

## What we need before committing

1. **Willingness-to-pay research** with all four personas. Mara's number and Ana's number are
   probably very different.
2. **Is the trip arc the product?** If trip-mode learners convert at 4× everyday learners, the
   pricing should be built around trips and the Trip Pass becomes the primary SKU.
3. **Does the free tier teach enough to be honest?** A free tier that can't actually get someone
   through a café is a demo, and it will be reviewed as one.
4. **Regional pricing.** A Spanish-learning app sells worldwide; Latin American and Southern
   European pricing needs its own tiers.
5. **Store mechanics.** RevenueCat vs direct StoreKit 2 / Play Billing — a real decision with
   migration cost. Not started.
