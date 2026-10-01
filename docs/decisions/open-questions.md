# Open questions

Decisions that are still open for the app (`apps/mobile`) and the API. IDs are never reused; the
first app's questions (Refrain, Run, trips, chat, home rails) were dropped and remain in Git history
at `e36cc758`.

| #             | Question                                                          | Status   | Owner             | Blocks                              |
| ------------- | ----------------------------------------------------------------- | -------- | ----------------- | ----------------------------------- |
| [Q-08](#q-08) | Pricing, tiers and the paywall                                    | open     | Product           | Launch                              |
| [Q-12](#q-12) | Store billing: RevenueCat or direct StoreKit 2 / Play Billing?    | open     | Backend           | Purchases                           |
| [Q-13](#q-13) | Is `es-419` a later target variant?                               | deferred | Product           | Nothing yet                         |
| [Q-15](#q-15) | Which licensed voice and source produce production audio?         | leaning  | Product           | Pronunciation review; live audio    |
| [Q-21](#q-21) | Under what eval and budget may live AI phrase generation run?     | leaning  | Product + privacy | Calling AI phrases reviewed content |
| [Q-22](#q-22) | May licensed neural TTS audio be shared off-device as a file?     | open     | Privacy + content | Any export of neural audio          |
| [Q-23](#q-23) | Who reviews the course text in each language, and when?           | open     | Product + content | Calling any course content reviewed |
| [Q-24](#q-24) | Which desired retention schedules reviews: the core's 50% or 90%? | open     | Product           | The review-date policy              |
| [Q-25](#q-25) | May the frequency and CEFR lists behind the syllabus be used?     | open     | Product + content | The syllabus vocabulary bands       |
| [Q-26](#q-26) | Is the American English course written, or adapted from British?  | open     | Product           | Plan 112 batches for en-US          |
| [Q-27](#q-27) | Which domain serves the landing page, and when does CloudFront?   | open     | Product           | A memorable address for the page    |

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
owner's listen. American English, Polish and Czech (2026-10-02) read `TTS_VOICE_EN_US`,
`TTS_VOICE_PL_PL` and `TTS_VOICE_CS_CZ`; none is chosen yet, so those courses and prompts are silent
until the owner pins a voice for each. Two listening-class voices per language are also pinned in
`LISTENING_VOICE_DECISION` for the API's `/v1/tts` routes, which the app does not call.

Local runs may stay on `TTS_PROVIDER=stub` and spend no credits, but then nothing can be heard: the
app plays only the server's clips. A withdrawn voice fails closed; never substitute another locale.

**Still needed:** a native-speaker listen of the starter phrases and a live `TTS_API_KEY` on a paid
plan. The pin does not claim either happened.

**Plan [112](../../plans/112-course-content-at-scale.md), 2026-10-01:** course clips are
pre-rendered by a budgeted backfill, level by level, targets first and prompts by demand. Still to
decide with it: speech at `mp3_44100_64` (the format joins the clip URL's `?v=` hash) and clip bytes
moving from PostgreSQL to S3 before they pass 2 GB.

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

**Course content (plan [112](../../plans/112-course-content-at-scale.md), 2026-10-01):** the same
model writes the courses offline, through `apps/api/src/authoring/`, under a per-run `--limit-usd`
ceiling and a dated price table, with deterministic checks and a model judge. The pilot (500 A1
phrases per course) is the eval: at most 5% critical errors in a native sample and at most 25%
deterministic rejects, or that language does not scale.

<a id="q-22"></a>

## Q-22 · May licensed neural TTS audio be shared off-device as a file?

Phrase clips play only inside the app. Writing them to a learner-owned file (Files, Music, a car
player) is redistribution, which Q-15 does not decide. Needs: commercial and personal-copy rights
per voice, and what happens after uninstall or a withdrawn licence. **Until then:** no neural audio
is written to a shareable file (`LISTENING_SHARE_ENABLED` stays `false`).

<a id="q-23"></a>

## Q-23 · Who reviews the course text, and when?

The phrases, notes, glosses and UI copy in `packages/content/v2/` and `apps/mobile/src/shared/copy/`
for Spanish, Bulgarian, English, Russian, Polish and Czech have not had a native-speaker review. The
British English and Russian courses, their bank phrases and the API's English and Russian grammar
rules and sound tips (`apps/api/src/library/notes/`) were written by AI (Claude Sonnet 5.5) on
2026-10-01 and need it most, as do the American English, Polish and Czech courses, the Polish and
Czech translations of everything else, the Polish and Czech UI copy and the API's Polish and Czech
rules, all written by AI (Claude Sonnet 5.5) on 2026-10-02. Needs a reviewer per language and a rule
for which content may be shown as reviewed.

**Proposed rule (plan [112](../../plans/112-course-content-at-scale.md), revised 2026-10-02):**
verdicts live in `packages/content/v2/reviews/<course>.jsonl`, tied to a hash of the content they
checked and to the language checked (the target or an interface language). Each batch is sampled (60
phrases under 1,200, 5% above, stratified by grammar and topic, plus every judge-flagged or
model-IPA phrase), translations included; a batch passes at 5% or fewer critical errors per
language, otherwise its topic is fully reviewed or regenerated with a recorded reason. A set shows
as reviewed for a language only when every phrase in it is. Reviewers are still needed: phase 1 of
plan 112 is blocked until one reader per pilot language is named.

<a id="q-24"></a>

## Q-24 · Which desired retention schedules reviews?

The core's 50% desired retention makes intervals about 90× stability, so a second on-time Easy
schedules the next review years away. The app instead reviews when predicted recall falls to 90%,
keeping the core's 50% date as the upper bound; that policy lives in the app
(`apps/mobile/src/shared/state/memory.ts`), not in core-rs (see
[v2-prototype-decisions.md](../design/v2-prototype-decisions.md) and
[fsrs-model.md](../architecture/fsrs-model.md)). Product needs to confirm or change this.

<a id="q-25"></a>

## Q-25 · May the frequency and CEFR lists behind the syllabus be used?

Plan [112](../../plans/112-course-content-at-scale.md) bands each course's vocabulary A1–C2 from
published lists, committing only the derived bands with attribution in
`packages/content/v2/syllabus/SOURCES.md`. Candidates: Wiktionary frequency lists (CC BY-SA),
SUBTLEX, the Russian National Corpus frequency dictionary, and the Bulgarian, Polish and Czech
national corpora's lists. Oxford 3000/5000 and the English Vocabulary Profile are proprietary and
not used. Needs: each source's licence checked for derived, committed bands, and a fallback for
Bulgarian, which has the weakest public CEFR inventories.

<a id="q-26"></a>

## Q-26 · Is the American English course written, or adapted from British?

Plan [112](../../plans/112-course-content-at-scale.md) writes seven courses, two of them English.
Writing en-US from scratch costs a seventh of the budget and lets the two courses drift apart;
adapting it from en-GB (a variety stage: spelling, vocabulary, present perfect usage, idiom) is a
small call per set, keeps the courses aligned phrase for phrase (an en-GB phrase and its en-US twin
could even share a set id suffix), but risks British phrasing with American spelling where the
adapter is lazy. The owner decides before the first en-US batch; until then en-US has no batch.

<a id="q-27"></a>

## Q-27 · Which domain serves the landing page, and when does CloudFront?

`apps/landing` is served from AWS Amplify Hosting at its default `amplifyapp.com` address
([landing-deployment.md](../process/landing-deployment.md), decided 2026-10-02). Still open: a
domain of Loro's own (none is registered; the API's token issuer only defaults to `api.loro.app`),
and the switch to the no-cost S3-behind-CloudFront stack in `infra/landing/cloudfront.yaml`, which
waits on AWS Support verifying the account for CloudFront. A custom domain on Amplify or CloudFront
needs a certificate in `us-east-1` and a hosted zone, about $0.50 a month in Route 53 or none at
another registrar; decide the domain before the switch so it is set up once.
