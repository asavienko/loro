# Open questions

Decisions that are still open for the current app (`apps/mobile`) and API. IDs are never reused;
questions about the removed first app (Refrain, Run, trips, chat, home rails) were dropped on
2026-09-30 and remain in Git history.

| #             | Question                                                          | Status   | Owner             | Blocks                              |
| ------------- | ----------------------------------------------------------------- | -------- | ----------------- | ----------------------------------- |
| [Q-08](#q-08) | Pricing, tiers and the paywall                                    | open     | Product           | Launch                              |
| [Q-12](#q-12) | Store billing: RevenueCat or direct StoreKit 2 / Play Billing?    | open     | Backend           | Purchases                           |
| [Q-13](#q-13) | Is `es-419` a later target variant?                               | deferred | Product           | Nothing yet                         |
| [Q-15](#q-15) | Which licensed voice and source produce production audio?         | leaning  | Product           | Pronunciation review; live audio    |
| [Q-21](#q-21) | Under what eval and budget may live AI phrase generation run?     | leaning  | Product + privacy | Calling AI phrases reviewed content |
| [Q-22](#q-22) | May licensed neural TTS audio be shared off-device as a file?     | open     | Privacy + content | Any export of neural audio          |
| [Q-23](#q-23) | Who reviews the Spanish, Bulgarian and Russian text, and when?    | open     | Product + content | Calling any course content reviewed |
| [Q-24](#q-24) | Which desired retention schedules reviews: the core's 50% or 90%? | open     | Product           | The review-date policy in core-rs   |

<a id="q-08"></a>

## Q-08 · Pricing, tiers and the paywall

There is no monetization surface in the app. Generation is limited per user per day
(`LIMIT_*_DAILY`), which is the natural place a paid tier would change. Needs: willingness-to-pay
evidence, what the free tier includes, and regional pricing.

<a id="q-12"></a>

## Q-12 · Store billing: RevenueCat or direct?

RevenueCat is faster and handles receipts and cross-platform entitlements for a revenue share;
direct StoreKit 2 / Play Billing is more work and more control. Either way, entitlements must be
cached on the device with a grace period so an offline learner doesn't lose access.

<a id="q-13"></a>

## Q-13 · Is `es-419` a later target variant?

Latin American Spanish is probably a larger market than `es-ES`. Deferred; it would need its own
content and voice review.

<a id="q-15"></a>

## Q-15 · Which licensed voice and source produce production audio?

**Decided 2026-09-07:** ElevenLabs is the cloud TTS provider. **Leaning 2026-09-10:** pin
`eleven_multilingual_v2` and these Voice Library IDs, which fill `CATALOG_REFERENCE_VOICES` and
`LISTENING_VOICE_DECISION` in `packages/core/src/listening/constants.ts`:

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

Local runs stay on `TTS_PROVIDER=stub` and spend no credits. A withdrawn voice fails closed; never
substitute another locale. The device voice is a labelled fallback, not a way around this.

**Still needed:** a native-speaker listen of the starter phrases and a live `TTS_API_KEY` on a paid
plan. The pin does not claim either happened. Learner recordings are separate: they never leave the
device.

<a id="q-21"></a>

## Q-21 · Under what eval and budget may live AI phrase generation run?

Make a set asks Claude for phrases when the API holds `ANTHROPIC_API_KEY`, inside per-user daily
limits; otherwise it answers from the phrase bank and says so. Claude's phrases are marked as
unchecked by a native speaker and are added only by an explicit learner action.

**Leaning:** keep that labelling until a named eval corpus passes per language pair (naturalness,
length, register, safety, prompt injection). Provider retention of prompts needs a privacy decision.

<a id="q-22"></a>

## Q-22 · May licensed neural TTS audio be shared off-device as a file?

Cached clips stay inside the app. Writing them to a learner-owned file (Files, Music, a car player)
is redistribution, which Q-15 does not decide. Needs: commercial and personal-copy rights per voice,
what happens after uninstall or a withdrawn licence, and UI that never passes device-voice output
off as the neural voice. **Until then:** no neural audio is written to a shareable file.

<a id="q-23"></a>

## Q-23 · Who reviews the course text, and when?

The phrases, notes, glosses and UI copy in `packages/content/v2/` and `apps/mobile/src/shared/copy/`
for Spanish, Bulgarian and Russian have not had a native-speaker review. Needs a reviewer per
language and a rule for which content may be shown as reviewed.

<a id="q-24"></a>

## Q-24 · Which desired retention schedules reviews?

The core's 50% desired retention makes intervals about 90× stability, so a second on-time Easy
schedules the next review years away. The app instead reviews when predicted recall falls to 90%,
keeping the core's 50% date as the upper bound (see
[v2-prototype-decisions.md](../design/v2-prototype-decisions.md#findings-for-product) and
[fsrs-model.md](../architecture/fsrs-model.md)). Product needs to confirm or change this.
