# Content authoring

How a Spanish phrase gets written, enriched, recorded, reviewed, and shipped.

Content is the product's raw material and it changes far more often than the app
([ADR-0009](../architecture/adr/0009-content-pipeline-and-packs.md)). This is the process that keeps
it good at volume.

---

## Roles

| Role                | Who                                                  | Owns                                                 |
| ------------------- | ---------------------------------------------------- | ---------------------------------------------------- |
| **Content lead**    | Native or near-native Spanish speaker                | What phrases exist, their register, pack composition |
| **Native reviewer** | A second native speaker (`es-ES`)                    | Naturalness sign-off. **Required on every phrase**   |
| **Voice**           | Managed neural TTS, one consistent voice per variant | The audio reference                                  |
| **Audio reviewer**  | Content lead                                         | Listens to every rendered clip before it ships       |
| **Engineer**        | Backend                                              | The pipeline, validation, publishing                 |

The two-native-speaker rule matters: the author is too close to their own phrasing to hear
stiffness, and stiffness is the failure mode that makes a language app feel like a textbook.

---

## The lifecycle

```
1 · Draft        author es + en + theme + emoji + register + cefr
2 · Enrich       LLM drafts resp, words[], example, hint  →  human edits every field
3 · Review       native reviewer: naturalness, register, correctness
4 · Render       TTS audio; extract f0_native, syllables, mfcc_ref
5 · Listen       content lead hears every clip
6 · Validate     CI: schema, pack counts, references, checksums
7 · Publish      catalog_version++ ; live to every device within a day
```

Steps 2–5 are where quality actually happens. Step 1 is fast; step 7 is automatic.

---

## 1 · Draft

Authored in `packages/content/es-ES/phrases.json`.

```jsonc
{
  "id": "cafe1",
  "lang": "es-ES",
  "es": "Me pone un cortado, por favor",
  "en": "A cortado, please",
  "theme": "Café",
  "emoji": "☕",
  "register": "neutral",
  "cefr": "A1",
}
```

### The quality bar

A phrase merges only if all ten hold
([`../product/content-model.md`](../product/content-model.md#quality-bar-for-a-catalog-phrase)):

1. **A real person would say this, in this situation, in this century.**
2. **It's a complete utterance** — usable alone, not a fragment needing scaffolding.
3. `en` is what an English speaker would _actually say_, not a literal gloss.
4. `resp` marks stress with CAPS and matches `resp_ipa`.
5. **≤ 8 words** for A1/A2 — it must be learnable in 6 reps.
6. `theme` is unambiguous. If it fits two themes equally, the phrase is too vague.
7. `example` uses the phrase verbatim inside a longer sentence.
8. `hint` (where present) is a real mnemonic, not a restatement of the translation.
9. Audio has been listened to by a human.
10. **It doesn't duplicate an existing phrase's function.** Two ways to say "the bill, please" is
    one phrase too many for someone with five slots a day.

Rule 10 is the one that's hard to hold to. A growing catalog naturally accumulates near-duplicates,
and each one dilutes a learner's daily set.

### Register is a real decision

| Register  | Example                        | When                                                     |
| --------- | ------------------------------ | -------------------------------------------------------- |
| `formal`  | _Quisiera un café, por favor_  | Rarely. Textbook Spanish, and it marks you as a learner  |
| `neutral` | **Me pone un café, por favor** | The default. What people actually say in a bar in Madrid |
| `casual`  | _Ponme un café_                | Friends, informal settings. The "sound local" pack       |

**Default to `neutral`.** The whole point of the app is that the learner sounds like a person, and
the most common failure in language content is being too formal.

---

## 2 · Enrich

An LLM drafts the four enrichment fields; **a human edits every one**
([`../architecture/ai-services.md`](../architecture/ai-services.md)).

```bash
pnpm content:enrich --ids cafe1,cafe2,cafe3
```

```jsonc
{
  "resp": "meh PO-neh oon kor-TAH-doh por fah-VOR",
  "resp_ipa": "me ˈpone un koɾˈtaðo poɾ faˈβoɾ",
  "words": [
    { "es": "Me pone", "gloss": "Could you give me", "say": "me pone" },
    { "es": "un cortado", "gloss": "a cortado", "say": "un cortado" },
    { "es": "por favor", "gloss": "please", "say": "por favor" },
  ],
  "example": {
    "es": "Buenos días, me pone un cortado, por favor.",
    "en": "Good morning, a cortado please.",
  },
  "hint": null,
  "note": "Watch the soft 'd' in cortado — closer to 'th' in 'the' than an English d.",
}
```

### Field conventions

**`resp`** — English-speaker respelling, hyphens between syllables, **CAPS on the stressed
syllable**. It has to be readable by someone who has never seen IPA, because it's shown on the
phrase detail hero and the review card back.

**`words[]`** — glosses may be literal; that's their job. `say` is required whenever the chip text
is a fragment (`¿Dón` → `dónde`), because the chips are tappable and must speak a real word
(`Loro.dc.html:2483`).

**`example`** — the phrase verbatim inside a longer, natural sentence. Its job is to show _where the
phrase sits_ in real speech.

**`hint`** — only for phrases likely to be tagged "hard to remember". Etymology or imagery, never a
restatement:

> ✅ _"'Encantado' = enchanted — you are 'enchanted to meet you.'"_ ✅ _"'Des-ayuno' = un-fasting —
> break-fast, same idea as English."_ ❌ _"This means 'nice to meet you.'"_

**`note`** — the default coaching line for the labs. One concrete physical fix
([`../design/copy-and-tone.md`](../design/copy-and-tone.md#2--name-the-specific-thing-to-change)).

### The LLM's role, precisely

It drafts. It does not decide. Every field is human-edited before review, and unreviewed model
output never reaches a learner
([ADR-0010](../architecture/adr/0010-llm-roleplay-and-guardrails.md)). In practice the LLM is
excellent at `resp` and `words[]`, decent at `example`, and unreliable at `hint` — a good mnemonic
needs taste.

---

## 3 · Native review

A second native `es-ES` speaker checks:

- [ ] Would you say this? (Not "is it correct" — **would you say it**)
- [ ] Is the register right for the context?
- [ ] Does the English match what an English speaker would say in that situation?
- [ ] Is the respelling's stress correct?
- [ ] Do the glosses help without misleading?
- [ ] Does the example sound natural?
- [ ] Is this distinct in function from every existing phrase?

Recorded as a PR approval from the reviewer, required by CODEOWNERS on `packages/content/**`.

---

<a id="4--render-and-extract"></a>

## 4 · Render and extract

```bash
pnpm content:render --ids cafe1 --dry-run
pnpm content:render --ids cafe1 --ceiling 5000
```

`packages/content/src/render.ts` is Node-only. It injects the ElevenLabs transport from the API
package so Metro never imports it. `--dry-run` estimates characters without calling the provider.
Verified sha256 files with matching voice/locale provenance are skipped. Stub mode, unknown
providers, exhausted ceilings and failed renders cannot write a publishable pack. Duration is
measured from the file; it is never estimated from text. Conversion from the provider format to AAC
64 kbps mono 24 kHz is the CLI's job when an encoder is supplied; identity write is the default so
CI never needs ffmpeg.

Live seed rendering still needs Q-15 voice/rights/listen review. Files land in gitignored
`.render-cache/`; S3/CDN publication is not this slice. F0 / syllable / MFCC extraction remains
plan 77.

The later `tts-render` worker still owns:

1. Uploading checksummed catalog audio to storage → CDN.
2. Extracting the **14-point normalised `f0_native` contour**.
3. Deriving **syllable spans** and reference MFCC.

Idempotent and content-addressed, so a rerun is cheap and safe
([`../architecture/prosody-dsp.md`](../architecture/prosody-dsp.md#native-reference-data)).

**One voice per variant, forever.** Changing the voice would change every learner's pronunciation
reference mid-learning, and would invalidate every `f0_native` contour. A voice change is a
catalog-wide re-render and a deliberate decision, not a config tweak. Plan 99 listening-class voices
are additional licensed takes for a listening companion; they must never replace this reference or
be written into `audio.sha256` / `f0_native`. Pinning those takes is the
[Q-15 listening-voice packet](../decisions/listening-voice-packet.md); `LISTENING_VOICE_DECISION`
stays empty until signed.

---

## 5 · Listen

**The content lead listens to every clip.** Non-negotiable, and it catches things no automated check
does:

- Wrong stress placement by the TTS
- A mispronounced loanword
- Unnatural pauses at commas
- Wrong intonation on a question
- Clipping or artefacts

A phrase whose audio is wrong is worse than no phrase, because the audio _is_ the pronunciation
model — a learner will faithfully reproduce whatever they hear.

---

## 6 · Validate

`pnpm content:validate`, and CI on every PR touching `packages/content/**`:

| Check           | Fails when                                                                        |
| --------------- | --------------------------------------------------------------------------------- |
| Schema          | A field is missing or the wrong type                                              |
| **Pack counts** | A pack's membership ≠ its `promised_count`. _The count in the label is a promise_ |
| References      | A pack, scenario, or drop names a phrase that doesn't exist                       |
| Audio           | A phrase has no audio, or a checksum doesn't resolve                              |
| Syllables       | Spans don't cover the phrase                                                      |
| Contour         | `f0_native` isn't 14 points                                                       |
| Duplicates      | Two phrases share the same `es` in one language                                   |
| Stress          | `resp` CAPS placement disagrees with `resp_ipa`                                   |
| Length          | An A1/A2 phrase exceeds 8 words                                                   |
| Emoji           | Missing, or more than one                                                         |
| Deprecations    | A `deprecated_by` points at a non-existent phrase                                 |

---

## 7 · Publish

```bash
pnpm content:publish            # bumps catalog_version, updates the manifest
```

Live to every device within a day (on next launch or the 24-hour check). No app release
([`../architecture/api.md`](../architecture/api.md#content)).

### The two immutability rules

1. **Phrase ids are immutable.** Fixing a typo mutates the row. Changing the _meaning_ creates a new
   id and marks the old one `deprecated_by`.
2. **Deprecated phrases stay resolvable forever.** A learner who has practised a phrase 40 times
   must never see a broken row.

---

## Packs, scenarios, drops

### Packs

A marketable unit with a **promised count** that CI enforces. Composition rules:

- Survival-first ordering within a pack.
- Every phrase in a pack is usable independently — a pack is not a sequence.
- A pack should get someone _through_ its situation, not merely acquaint them with it.

### Scenarios

Cross-theme bundles, and **the order is the arc of the real interaction**. A dinner reservation
needs a greeting _and_ the dining phrases. 4–6 phrases; someone who learns only that scenario can
get through the real situation.

### Drop schedules

`packages/content/es-ES/drops.json`, keyed by trip length
([`../product/content-model.md`](../product/content-model.md#trip-drops)). Two rules:

- **Survival basics and Airport & taxi come first** — what happens first on the trip is taught
  first.
- **No new phrases on the final day.** Cramming the night before a flight produces anxiety, not
  retention.

### Roleplay fallback scenes

24 hand-authored scenes ship in the binary: three per theme, at two levels
([ADR-0010](../architecture/adr/0010-llm-roleplay-and-guardrails.md)). They must be **good** —
they're what an offline learner gets, and they're the local-development default, so they're
exercised constantly.

Each scene: 3 turns + a closer, 3 options per turn, **exactly one marked `best`**, and a specific
`tip` on every option.

---

## The feedback loop

The content-quality dashboard is where authoring learns from reality
([`../architecture/observability.md`](../architecture/observability.md#dashboards)), reviewed
weekly:

| Signal                                                           | Means                                                  |
| ---------------------------------------------------------------- | ------------------------------------------------------ |
| **Removal rate** — % of learners who add a phrase then remove it | > 30% is a bad phrase. Fix or retire it                |
| **Never-practised** — added but zero reps                        | Uninteresting, or it looks harder than it is           |
| **Tagged `hard` disproportionately**                             | Genuinely difficult (fine), or badly worded (not fine) |
| **Tagged `pron` disproportionately**                             | Needs a better `note`                                  |
| **Low prosody scores across many learners**                      | The TTS reference may be wrong — re-listen             |
| **High `useful` tagging**                                        | Prioritise in drops and starter packs                  |

That last one is a gift: learners are telling you which phrases matter, at scale, for free.

---

## Adding a language

Not v1. It's a project, not a config change — see
[localization.md](localization.md#adding-a-target-language). The pipeline is language-agnostic; the
**syllabification rules, stress rules, IPA mapping, respelling conventions, and coaching copy are
not.**
