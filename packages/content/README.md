# @loro/content

The Spanish catalog. Authored here, validated in CI, and **shipped independently of the app** — a
phrase fix reaches every learner within a day, no release
([ADR-0009](../../docs/architecture/adr/0009-content-pipeline-and-packs.md)).

Process: [content-authoring.md](../../docs/process/content-authoring.md) · Model:
[content-model.md](../../docs/product/content-model.md)

## Layout

```
es-ES/
├── phrases.json     # the catalog — 31 seed phrases, launch target ~600
├── scenarios.json   # 5 cross-theme bundles; the ORDER is the arc of the interaction
├── packs.json       # onboarding + trip packs, each with a promised count
└── drops.json       # trip drop schedules by trip length
schema/
└── phrase.schema.json
src/
├── validate.ts      # every mechanical check
├── enrich.ts        # LLM drafts resp/words/example/hint — a human edits every field
├── render.ts        # TTS + f0/syllable/mfcc extraction
└── publish.ts       # bump catalogVersion, publish the manifest
```

## Status

The seed catalog is extracted verbatim from the blueprint (`Loro.dc.html:2179-2211` and
`2885-2899`). **Most rows still need `resp`, `words`, `example`, `syl`, `f0_native`, and `audio`** —
those come from the enrich and render pipeline, and every field is human-reviewed before merge.

The under-populated packs in `packs.json` are deliberate and visible: their `promisedCount` is the
target, and `validate:packs` **fails** until membership matches. A pack that promises 8 phrases and
delivers 4 would be lying to the learner, and CI is what stops that shipping.

## Commands

```bash
pnpm content:validate                        # everything
pnpm --filter @loro/content validate:packs   # one check
pnpm content:enrich --ids cafe1,cafe2        # LLM drafts; you edit
pnpm content:render --ids cafe1              # TTS + reference extraction
pnpm content:publish                         # bump catalogVersion
```

## What validation catches

| Check           | Fails when                                                          |
| --------------- | ------------------------------------------------------------------- |
| Schema          | A field is missing or the wrong type                                |
| **Pack counts** | Membership ≠ `promisedCount`. _The count in the label is a promise_ |
| References      | A pack, scenario, or drop names a phrase that doesn't exist         |
| Audio           | A phrase has no audio, or a checksum doesn't resolve                |
| Prosody         | Syllable spans don't cover the phrase; `f0_native` isn't 14 points  |
| Duplicates      | Two phrases share the same `es` in one language                     |
| Stress          | `resp` CAPS placement disagrees with `resp_ipa`                     |
| Length          | An A1/A2 phrase exceeds 8 words — it must be learnable in 6 reps    |

## The two immutability rules

1. **Phrase ids are immutable.** Fixing a typo mutates the row. Changing the _meaning_ creates a new
   id and marks the old one `deprecated_by`.
2. **Deprecated phrases stay resolvable forever.** A learner who has practised a phrase 40 times
   must never see a broken row.

## The quality bar

Ten points, all of which must hold
([full list](../../docs/product/content-model.md#quality-bar-for-a-catalog-phrase)). The two that
are hardest to hold to:

- **"A real person would say this, in this situation, in this century."** No textbook Spanish.
  `Me pone un café` ✅ · `Quisiera un café` ❌
- **"It doesn't duplicate an existing phrase's function."** Two ways to say "the bill, please" is
  one phrase too many for someone with five slots a day. A growing catalog accumulates
  near-duplicates naturally, and each one dilutes a learner's daily set.

Every phrase needs a **native `es-ES` reviewer** (CODEOWNERS enforces it) and every audio clip needs
a human to listen to it. A phrase whose audio is wrong is worse than no phrase — the audio _is_ the
pronunciation model, and a learner will faithfully reproduce whatever they hear.
