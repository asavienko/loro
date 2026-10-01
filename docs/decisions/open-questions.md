# Open questions

Decisions that are still open for the app (`apps/mobile`) and the API. IDs are never reused; the
first app's questions (Refrain, Run, trips, chat, home rails) were dropped and remain in Git history
at `e36cc758`.

| #             | Question                                                                | Status   | Owner             | Blocks                              |
| ------------- | ----------------------------------------------------------------------- | -------- | ----------------- | ----------------------------------- |
| [Q-08](#q-08) | Pricing, tiers and the paywall                                          | open     | Product           | Launch                              |
| [Q-12](#q-12) | Store billing: RevenueCat or direct StoreKit 2 / Play Billing?          | open     | Backend           | Purchases                           |
| [Q-13](#q-13) | Is `es-419` a later target variant?                                     | deferred | Product           | Nothing yet                         |
| [Q-15](#q-15) | Which licensed voice and source produce production audio?               | leaning  | Product           | Pronunciation review; live audio    |
| [Q-21](#q-21) | Under what eval and budget may live AI phrase generation run?           | leaning  | Product + privacy | Calling AI phrases reviewed content |
| [Q-22](#q-22) | May licensed neural TTS audio be shared off-device as a file?           | open     | Privacy + content | Any export of neural audio          |
| [Q-23](#q-23) | Who reviews the Spanish, Bulgarian, English and Russian text, and when? | open     | Product + content | Calling any course content reviewed |
| [Q-24](#q-24) | Which desired retention schedules reviews: the core's 50% or 90%?       | open     | Product           | The review-date policy              |

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
`eleven_multilingual_v2` and one voice per language, which speaks that language's prompts and
targets alike. The server's phrase clips use the voices set in `TTS_VOICE_*`;
`apps/api/.env.example` carries the first three, which `CATALOG_REFERENCE_VOICES` in
`packages/core/src/listening/constants.ts` also records:

| Locale  | Voice ID               | Name       |
| ------- | ---------------------- | ---------- |
| `es-ES` | `t9LRTh3y1ioN00e9wsNh` | Aaron Abad |
| `bg-BG` | `406EiNlYvqFqcz3vsnOm` | Peter K    |
| `ru-RU` | `1qd9R09Ljlx9V1Ok0t5S` | Ivan       |
| `en-GB` | `Xb7hH8MSUJpSbSDYk0k2` | Alice      |

The `en-GB` voice (ElevenLabs' premade "Alice", British) was set in `TTS_VOICE_EN_GB` on 2026-10-01
so English prompts have a clip now that the app has no device voice (plan 108); it awaits the
owner's listen. Two listening-class voices per language are also pinned in
`LISTENING_VOICE_DECISION` for the API's `/v1/tts` routes, which the app does not call.

Local runs may stay on `TTS_PROVIDER=stub` and spend no credits, but then nothing can be heard: the
app plays only the server's clips. A withdrawn voice fails closed; never substitute another locale.

**Still needed:** a native-speaker listen of the starter phrases and a live `TTS_API_KEY` on a paid
plan. The pin does not claim either happened.

<a id="q-21"></a>

## Q-21 · Under what eval and budget may live AI phrase generation run?

Make a set asks DeepSeek V4.1 Flash (Fireworks, then OpenRouter) for phrases when the API holds
`FIREWORKS_API_KEY` or `OPENROUTER_API_KEY`, inside per-user daily limits; otherwise it answers from
the phrase bank and says so. A model's phrases are marked as unchecked by a native speaker and are
added only by an explicit learner action.

**Leaning:** keep that labelling until a named eval corpus passes per language pair (naturalness,
length, register, safety, prompt injection; a first live run's mnemonics were not always true).
Provider retention was decided on 2026-10-01
([ADR-0015](../architecture/adr/0015-open-model-providers.md)): Fireworks keeps no prompts for open
models, and OpenRouter routes only to providers that don't.

<a id="q-22"></a>

## Q-22 · May licensed neural TTS audio be shared off-device as a file?

Phrase clips play only inside the app. Writing them to a learner-owned file (Files, Music, a car
player) is redistribution, which Q-15 does not decide. Needs: commercial and personal-copy rights
per voice, and what happens after uninstall or a withdrawn licence. **Until then:** no neural audio
is written to a shareable file (`LISTENING_SHARE_ENABLED` stays `false`).

<a id="q-23"></a>

## Q-23 · Who reviews the course text, and when?

The phrases, notes, glosses and UI copy in `packages/content/v2/` and `apps/mobile/src/shared/copy/`
for Spanish, Bulgarian, English and Russian have not had a native-speaker review. The British
English and Russian courses, their bank phrases and the API's English and Russian grammar rules and
sound tips (`apps/api/src/library/notes/`) were written by AI (Claude Sonnet 5.5) on 2026-10-01 and
need it most. Needs a reviewer per language and a rule for which content may be shown as reviewed.

<a id="q-24"></a>

## Q-24 · Which desired retention schedules reviews?

The core's 50% desired retention makes intervals about 90× stability, so a second on-time Easy
schedules the next review years away. The app instead reviews when predicted recall falls to 90%,
keeping the core's 50% date as the upper bound; that policy lives in the app
(`apps/mobile/src/shared/state/memory.ts`), not in core-rs (see
[v2-prototype-decisions.md](../design/v2-prototype-decisions.md) and
[fsrs-model.md](../architecture/fsrs-model.md)). Product needs to confirm or change this.
