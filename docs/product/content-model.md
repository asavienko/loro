# Content model

What a phrase is, how phrases are grouped, and where the content comes from. The machine-readable
version is in [`packages/content/`](../../packages/content/) with a JSON Schema; this document is
the reasoning behind it.

---

## The phrase

The atom of the entire product. Everything in Loro is a lens over a set of phrases.

### Core fields — every phrase, always

| Field   | Type   | Example                         | Notes                                                                                                                           |
| ------- | ------ | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `id`    | string | `cafe1`                         | Stable forever. Catalog ids are `<theme-prefix><n>`; user phrases are `usr_<uuid>`; imports `imp_<uuid>`; captures `cap_<uuid>` |
| `lang`  | BCP-47 | `es-ES`                         | Target language + variant                                                                                                       |
| `es`    | string | `Me pone un cortado, por favor` | The phrase. Full punctuation, including `¿`/`¡`                                                                                 |
| `en`    | string | `A cortado, please`             | Natural English, **not** a gloss — "A cortado, please", not "Me put a cortado, for favour"                                      |
| `theme` | enum   | `Café`                          | One of 8 (below) + `Imported`, `Mine`, `Captured`                                                                               |
| `emoji` | string | `☕`                            | Row identity at a glance; one per phrase                                                                                        |

<a id="enrichment-fields--optional-but-they-carry-most-of-the-value"></a>

### Enrichment fields — optional, but they carry most of the value

| Field       | Type                 | Example                                                      | Used by                                                                                          |
| ----------- | -------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `resp`      | string               | `meh PO-neh oon kor-TAH-doh por fah-VOR`                     | Detail hero, review card back. English-speaker respelling with **CAPS on the stressed syllable** |
| `words`     | `{es, gloss, say}[]` | `{es:"¿Dónde", gloss:"Where", say:"dónde"}`                  | Word-by-word chips. `say` is what TTS speaks when the chip text is a fragment                    |
| `example`   | `{es, en}`           | `Perdone, ¿dónde está la parada de taxis más cercana?`       | Detail "In context"                                                                              |
| `hint`      | string               | `"Encantado" = enchanted — you are "enchanted to meet you."` | Review reveal for `remember`-tagged phrases. An etymological or imagery hook                     |
| `resp_ipa`  | string               | `me ˈpone un koɾˈtaðo poɾ faˈβoɾ`                            | Alignment and DSP, not display                                                                   |
| `syl`       | `{t, stress, dur}[]` | `[{t:"¿Dón",stress:0.30,dur:0.8}, …]`                        | Pronunciation and prosody labs                                                                   |
| `f0_native` | number[]             | `[0.34,0.35,0.37,…]`                                         | Normalised native pitch contour, 14 points                                                       |
| `audio`     | `{uri, sha256, ms}`  |                                                              | Pre-rendered native TTS; see [Audio](#audio)                                                     |
| `register`  | enum                 | `neutral` \| `casual` \| `formal`                            | Roleplay option selection; "sound local" drops                                                   |
| `cefr`      | enum                 | `A1`…`B2`                                                    | Level-appropriate seeding from the onboarding answer                                             |
| `variants`  | `{lang, es}[]`       | `{lang:"es-419", es:"Me da un cortado, por favor"}`          | Future regional support                                                                          |

### Learner state — per learner, never in the catalog

Written by the learner and the engines. Full DDL in
[`architecture/data-model.md`](../architecture/data-model.md).

| Field                                                           | Set by                                                  | Range                                        |
| --------------------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------- |
| `difficulty`                                                    | learner                                                 | `easy` \| `med` \| `hard`                    |
| `tags`                                                          | learner                                                 | subset of `pron` `remember` `useful` `words` |
| `loved`                                                         | learner                                                 | bool                                         |
| `learned`                                                       | learner or `Easy@reps≥3`                                | bool                                         |
| `note`                                                          | learner (or adopted from suggestions)                   | text                                         |
| `plays`                                                         | StreamEngine                                            | int                                          |
| `reps`                                                          | all engines                                             | int                                          |
| `reps_today`                                                    | RefrainEngine                                           | int                                          |
| `automaticity`                                                  | RefrainEngine                                           | 0–100                                        |
| `rung`                                                          | any engine (see [practice-loops.md](practice-loops.md)) | 0–4                                          |
| `stale`, `stumbles`                                             | RunEngine                                               | int                                          |
| `cue_level`                                                     | ProsodyEngine                                           | 0–3                                          |
| `ax_perception`, `ax_recall`, `ax_production`                   | ProsodyEngine                                           | 0–99                                         |
| `srs_stability`, `srs_difficulty`, `srs_due`, `srs_last_review` | SrsEngine (FSRS)                                        |                                              |
| `added_at`, `graduated_at`                                      | system                                                  |                                              |

**Separation rule:** the catalog is immutable, versioned, shared content. Learner state is private,
synced, and per-user. They are joined by `phrase_id` and never merged into one table.

---

## Themes — 8, fixed

From `Loro.dc.html:2239–2245`. Themes are a **taxonomy**, not tags: exactly one per phrase.

| Theme      | Emoji | Covers                                                        | Seed count |
| ---------- | ----- | ------------------------------------------------------------- | ---------- |
| Café       | ☕    | Ordering coffee, pastries, paying                             | 4          |
| Dining     | 🍽     | Restaurants, recommendations, allergies, compliments          | 4          |
| Travel     | 🚆    | Taxis, trains, buses, lost luggage                            | 4          |
| Directions | 🧭    | Getting somewhere, being lost, turns, distance                | 4          |
| Shopping   | 🛍     | Price, size, browsing, payment                                | 4          |
| Small talk | 🤝    | Introductions, origins, work, farewells                       | 4          |
| Survival   | 🆘    | Repeat that, I don't understand, do you speak English, slower | 4          |
| Hotel      | 🏨    | Reservations, breakfast, wifi                                 | 3          |

Plus three synthetic themes for learner-originated phrases: `Imported` 📝 · `Mine` ✍️ · `Captured`
📷.

The blueprint's seed library is **31 phrases** across these eight themes — enough to make every
screen real. Production launch target is **~600 phrases** for `es-ES` ([roadmap.md](roadmap.md)).

---

## Scenarios — cross-theme bundles

From `Loro.dc.html:2230–2238`. A scenario is a _situation_, so it deliberately crosses themes: a
dinner reservation needs Dining phrases _and_ a greeting.

| Scenario           | Emoji | Composition (seed)                                                                                      |
| ------------------ | ----- | ------------------------------------------------------------------------------------------------------- |
| Dinner reservation | 🍽     | `din1` table for two · `din2` what do you recommend · `tlk1` nice to meet you · `din4` it was delicious |
| Catching a train   | 🚆    | `trv2` train time · `trv1` taxi stand · `dir3` is it far · `srv1` repeat that                           |
| Hotel check-in     | 🏨    | `htl1` reservation · `htl2` breakfast · `htl3` wifi · `srv3` do you speak English                       |
| Market & shops     | 🛍     | `shp1` how much · `shp2` another size · `shp4` card · `shp3` just looking                               |
| Getting un-lost    | 🧭    | `dir1` how do I get to · `dir3` is it far · `dir4` I'm lost · `srv4` speak slower                       |

Scenarios are **ordered** — the sequence is the arc of the real interaction. A scenario add
preserves that order in the stream.

Production target: ~30 scenarios. Authoring rule: 4–6 phrases, and someone who learns only that
scenario can get through the real situation.

---

<a id="phrase-relation-graph"></a>

## Phrase relation graph

Authored **edges** between catalog phrases, not a second kind of atom. A node is a catalog phrase
id. A sound is still the phrase's `audio` attribute — never a graph node and never PCM.

The seed relation is `scenario_next`: the existing scenario `phrases[]` order, stored so a
deterministic score can read it. Same-theme adjacency is **derived** from `theme`; it is not stored
(a stored clique does not scale to the ~600-phrase launch target). Later authored relations
(`reply`, `lexical`, `contrast`, `prerequisite`, `register_shift`) wait on data most starters lack.

Two scores consume the graph, with different inputs. Implementation owner:
[plan 101](../../plans/101-phrase-sound-graph.md).

| Score          | When                       | Reads                                                                              | Does not read                                   |
| -------------- | -------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------- |
| `assoc_score`  | Discover after add (P2-04) | Anchor difficulty/tags, authored edges, candidate catalog fields, owned aggregates | Candidate FSRS/mastery (candidates are unowned) |
| `gap_priority` | Authoring CLI              | Scenario/pack/audio coverage and arc orphans                                       | Any learner state                               |

Discover association keeps the authored **theme bands** (`Loro.dc.html:2306–2310`): same-theme
first, then the rest, cap 6. The score orders **inside** a band. The artifact context label is
`More like “{anchorEs}”` (`2369`); the current app shows `More like {theme}` — that copy is a
recorded divergence plan 101 fixes. This score is **not** Stream rank and **not** FSRS; see
[scheduling.md](../architecture/scheduling.md#association-is-not-a-sixth-scheduler).

The graph ships in the bundled snapshot (`graph.json` beside `scenarios.json`) and in the disk
loader the authoring CLIs use. Course ids stay course-scoped (`cafe1` on `es-ES`, `bg-BG:cafe1`
otherwise). Own-phrases have no catalog node.

---

<a id="packs--onboarding-and-drops"></a>

## Packs — onboarding and drops

From `Loro.dc.html:2089–2096`. A pack is a _marketable unit_ of phrases with a promised count.

| Pack                | Emoji | Count | Onboarding | Trip drop       |
| ------------------- | ----- | ----- | ---------- | --------------- |
| Café & ordering     | ☕    | 8     | ✅         | ✅              |
| Getting around      | 🚕    | 10    | ✅         | ✅              |
| Eating out          | 🍽     | 8     | ✅         | ✅              |
| Small talk          | 🤝    | 8     | ✅         | ✅              |
| Shopping            | 🛍     | 6     | ✅         | ✅              |
| Survival basics     | 🆘    | 8     | ✅         | ✅ (day 1)      |
| Airport & taxi      | 🛫    | 8     | —          | ✅ (day 1)      |
| Sound local         | 🗣     | 8     | —          | ✅ (final days) |
| Pharmacy & problems | 💊    | 6     | —          | ✅              |
| Nightlife           | 🍷    | 6     | —          | ✅              |

The count in the label is a **promise**: if the pack says 8, exactly 8 phrases are added. Validated
in CI ([process/content-authoring.md](../process/content-authoring.md)).

---

## Trip drops

A drop is a pack scheduled to a specific day of a countdown. The blueprint's escalation principle:

> Each morning a themed set unlocks — survival basics first, "sound local" extras as the date nears.
> — `Loro.dc.html:1981`

Default schedule for a 12-day countdown (see [trip-arc.md](trip-arc.md) for other lengths):

| Day | Pack                   | Why here                            |
| --- | ---------------------- | ----------------------------------- |
| 12  | Airport & taxi 🛫      | The first thing that happens        |
| 11  | Survival basics 🆘     | The safety net, early               |
| 10  | Hotel check-in 🏨      | The second thing that happens       |
| 9   | Café & ordering ☕     | Highest-frequency daily interaction |
| 8   | Getting around 🚕      |                                     |
| 7   | Eating out 🍽           |                                     |
| 6   | Directions 🧭          |                                     |
| 5   | Shopping 🛍             |                                     |
| 4   | Small talk 🤝          | Now that survival is covered        |
| 3   | Pharmacy & problems 💊 | The "what if" set                   |
| 2   | Sound local 🗣          | Polish, once essentials are owned   |
| 1   | Review only            | No new load the day before          |

**Rule: no new phrases on the final day.** Cramming the night before a flight produces anxiety, not
retention.

---

## Audio

Every catalog phrase ships with pre-rendered native audio. This is not optional: on-device TTS
quality varies wildly by platform and locale, and the pronunciation reference must be identical for
every learner.

| Property          | Value                                                                           |
| ----------------- | ------------------------------------------------------------------------------- |
| Voice             | Managed neural TTS, `es-ES`, one consistent voice per variant                   |
| Format            | AAC 64 kbps mono, 24 kHz                                                        |
| Rates             | Rendered at 1.0×; other rates are time-stretched on device (pitch preserved)    |
| Size              | ~12 KB per phrase → ~7 MB for a 600-phrase catalog                              |
| Delivery          | CDN, content-addressed by `sha256`, prefetched per pack                         |
| Fallback          | On-device TTS when the file is missing, with a quality caveat                   |
| Reference contour | `f0_native` extracted from the rendered audio at build time and shipped as data |

Learner-authored phrases (typed, imported, captured) have no pre-rendered **reference** audio.
Practice playback may use on-device TTS on a cache miss. Plan 99 listening-class clips are a
separate on-demand neural render (multiple licensed voices, cached on device) and must never be
stored as this `audio` object or used for `f0_native`. That quality difference is visible and
acceptable — the prosody lab stays **catalog-only**, since it needs a trustworthy native reference.

---

## Versioning and delivery

The catalog is versioned content, shipped independently of app releases.

```
content/
├── manifest.json          # catalog version, pack index, checksums
├── es-ES/
│   ├── phrases.json       # the catalog
│   ├── scenarios.json
│   ├── graph.json         # authored edges (plan 101); not yet shipped
│   ├── packs.json
│   └── drops.json         # drop schedules by trip length
└── audio/<sha256>.m4a     # on the CDN, not in the repo
```

- `manifest.json` carries `catalog_version` (monotonic int). The app fetches the manifest, diffs
  against its local version, and pulls only changed phrases.
- **Phrase ids are immutable.** Fixing a typo mutates the row; changing the meaning creates a new id
  and deprecates the old one (`deprecated_by`).
- A **bundled snapshot** ships in the app binary so a fresh install with no network still has the
  onboarding packs.
- Deprecated phrases stay resolvable forever — a learner who owns one must never see a broken row.

Details: [`architecture/api.md`](../architecture/api.md#content) and
[ADR-0009](../architecture/adr/0009-content-pipeline-and-packs.md).

---

## Where content comes from

| Source               | Volume         | Path                                                                                                                                                                               |
| -------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Curated catalog**  | ~600 at launch | Authored by a native-speaker content lead, enriched with LLM assistance, **reviewed by a human before merge**. See [process/content-authoring.md](../process/content-authoring.md) |
| **Learner-typed**    | unbounded      | "Add your own" in Discover. Translation is offered but not required                                                                                                                |
| **Learner-imported** | unbounded      | Paste a list; parsed as `es SEP en` pairs (7 separators, cap 12/paste)                                                                                                             |
| **Learner-captured** | unbounded      | v1.1 — photograph a sign or menu, OCR, review, add                                                                                                                                 |
| **AI-suggested**     | —              | Related phrases and roleplay lines. **Never silently added to the stream**                                                                                                         |

**Rule: nothing enters a learner's stream without an explicit tap.** Not a suggestion, not an
import, not an AI generation. The stream is the learner's, and the whole model depends on them
believing that.

---

## Quality bar for a catalog phrase

A phrase merges only if all of these hold:

1. **A real person would say this, in this situation, in this century.** No textbook Spanish.
2. **It's a complete utterance** — usable alone, not a fragment needing scaffolding.
3. `en` is what an English speaker would _actually say_, not a literal gloss.
4. `resp` marks stress with CAPS and is checkable against `resp_ipa`.
5. Length ≤ 8 words for A1/A2 phrases (they must be learnable in 6 reps).
6. `theme` is unambiguous — if it fits two themes equally, the phrase is too vague.
7. `example` uses the phrase verbatim inside a longer sentence.
8. `hint` (where present) is a real mnemonic, not a restatement of the translation.
9. Audio has been listened to by a human.
10. It doesn't duplicate an existing phrase's _function_. Two ways to say "the bill, please" is one
    phrase too many for a learner with 5 slots a day.

---

## Multi-language readiness (not v1)

`es-ES` only ships in v1, but nothing in the model is Spanish-specific:

- `lang` is on every phrase and every catalog file is per-locale.
- `resp` (English-speaker respelling) is source-language-dependent → the field is keyed by the
  learner's UI language in the schema.
- `syl` / `f0_native` / `resp_ipa` are language-agnostic structures.
- Themes and scenarios are universal; packs and drops are per-language.
- **Not ready:** stress/syllabification rules, ASR model availability, and the pronunciation
  coaching copy — all of which need per-language linguistic work.

See [process/localization.md](../process/localization.md) for the distinction between _UI
localization_ (cheap) and _a new target language_ (a project).
