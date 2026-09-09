# Phrase lyrics and multi-style music generation

- **Requirement IDs:** `AI-04`, `AI-05`, `F-03`, `F-07`, `F-08`, `AS-04`, `P2-30`, `P3D-14`;
  proposed `P3F-01`…`P3F-12` (see [Requirement IDs](#requirement-ids))
- **Milestone:** later / experimental garnish (not one of the 23 authored v1.1 screens)
- **Status:** — Planning complete; implementation remains. Contract, validation and fixture slices
  can start now. Live LLM lyrics and ElevenLabs Music spend are gated by proposed **Q-21**
  (product/licensing/budget), plan-86 provider controls, and plan-61/62 storage/playback. This plan
  does not silently resolve Q-15, Q-08/Q-12, or Q-16–Q-20.
- **Depends on:** 86 vendor transports and common controls; 76/82 guarded LLM patterns and the
  existing Anthropic text transport; 66 API/security; 67 identity and per-principal budgets; 61
  object storage and checksummed assets; 62 playback/cache (reuse the player, separate namespace);
  56/81 route declaration and More grouping; 59 local persistence; 71 consent if generation is
  treated as a live AI path; 87 bilingual review before production lyrics quality claims; 88 private
  S3 when server artifacts leave the API host. 74 only if Product ties the surface to an
  entitlement.
- **Reviewed:** 2026-09-09 against `origin/main` at `d153d82`, then re-checked the same day against
  current `origin/main` (still `d153d82`) and live ElevenLabs Music docs. No ElevenLabs Music
  adapter exists in this repository; ElevenLabs is selected only as the cloud **TTS** provider
  (Q-15). See [Review (2026-09-09)](#review-2026-09-09).
- **Blueprint:** new design — do not edit authored artifacts under `design/`.

## Outcome

A learner selects phrases from the **current course stream**. Loro generates **lyrics that teach and
use those phrases**, then generates the **same lyrics** as music in **multiple styles** through
ElevenLabs Music. The daily loop stays LLM-free and offline-first. Generated songs are optional
garnish ([overview.md](../docs/architecture/overview.md#the-ten-rules) rule 9;
[ADR-0010](../docs/architecture/adr/0010-llm-roleplay-and-guardrails.md)): they never become
pronunciation references, never write `ProgressDelta`, and never send recorded learner audio
anywhere.

## Verified starting point

| Area | Current evidence |
| --- | --- |
| Phrase/catalog | `CatalogPhrase` / `PhraseState` / `PhraseView` in `packages/core/src/domain/phrase.ts`; eligibility is `isActive` / `isDue`. Course catalogs load through `loadLearningCatalog` (`packages/content`, `apps/mobile/src/store/learningCatalog.ts`). |
| Progress | Practice outcomes write only through `applyDelta`. Listening to generated music must not invent reps, latency, or scores. |
| Languages | UI `en` / `bg` / `ru`; targets `es-ES` / `bg-BG` / `ru-RU` excluding matching pairs (`F-08`). |
| Copy | Every learner-facing string goes through `apps/mobile/src/lib/copy.ts` and `src/lib/i18n/{en,bg,ru}.json`. |
| Navigation | `SURFACES` / `DESTINATIONS` in `apps/mobile/src/lib/navigation.ts`. More lists built destinations by group. No music surface exists. |
| LLM | Anthropic text transport exists and is **unregistered**. `AI_PROVIDER=stub`. Plans 76/82 own feature prompts; plan 86 owns transports. |
| ElevenLabs | Selected for **catalog/on-demand TTS** only (`AS-01`, Q-15). `TTS_PROVIDER=stub`. No Music client, no music env var, no music contract. |
| Audio privacy | Recorded PCM is P0 and never leaves the device (`P3D-14`, `AI-04`, ADR-0011). Generated vendor audio is a different class — see [Privacy](#privacy). |
| Sync | `fieldPolicy.ts` has no song entity. New syncable fields need a merge class before any client write. |
| Contracts | Current / target / draft entry points in `packages/core/src/api/`. New music operations start as **draft** with an explicit gate, same pattern as chat (`draftGates`). |
| Screens | Eight of 23 authored learner screens are built. This feature is **not** in `Loro.dc.html` or `Loro Chat.dc.html`. |

## Product intent

1. The learner picks a small set of phrases they are actually learning.
2. An LLM writes a short teaching song whose **sung lines are in the course target language** and
   that uses each selected phrase as a real lyric line or contiguous lyric span.
3. The learner **reviews the lyrics** (and can reject/regenerate once) before any music spend.
4. The same validated lyric document is rendered as audio in **two or more Loro-owned styles** via
   ElevenLabs Music (`composition_plan`, not a free-text prompt that might drop or rewrite lyrics).
5. The learner plays and compares styles. Cached tracks replay offline. Generation itself requires
   network and a paid provider path.

This is **not** catalog TTS, not Refrain ambient loop (`LB-05`), not a pronunciation lab reference,
and not “document ElevenLabs TTS”. Q-15 still owns licensed **phrase** reference audio.

### Proposed learner journey

```
More (practice) → /music
  → pick 3–8 phrases from the current course stream
  → request lyrics (online) or use the deterministic lyrics-only floor (offline)
  → review lyrics (target text + native gloss)
  → pick 2–4 styles
  → confirm generation (cost/time honesty)
  → play / switch styles / replay from cache
```

Optional later entry from phrase detail (`P2-30`) pre-selects that phrase and still requires the
minimum set size.

## Phrase selection

### Source of truth

Selection is against the **joined `PhraseView` rows of the active course** (current
`targetLocale` + the learner’s meaning language), the same catalog the store already loads via
`loadLearningCatalog`. Do not invent a second catalog.

| Input | Rule |
| --- | --- |
| Course | The active pair only. Never silently substitute Spanish or another target. |
| Default pool | Active stream rows (`isActive`: not `learned` and `graduatedAt === null`). |
| Explicit extras | Loved or recently practiced rows may be included when the learner taps them; they stay course-scoped. |
| First slice | **Catalog-backed rows only** (`phraseId !== null` and a resolvable `CatalogPhrase` without `deprecatedBy`). Custom, import, and capture phrases wait for a later slice: their text is P2, unreviewed, and easier to leak private notes or pasted documents. |
| Size | Minimum 3, maximum 8 selected rows. The picker keys rows by `UserPhraseId`; the API and `LyricDocument` carry **ordered unique `catalog_phrase_id`s**. Duplicate catalog ids collapse; do not send two user rows that resolve to the same catalog phrase. |
| Order | Learner order is preserved as that catalog-id list so verses can follow it. |
| Identity | `user_phrase_id` stays on the device for picker/preset state. The lyrics request sends only catalog ids plus locales. The API re-loads catalog text from the published catalog for that `target_locale` (`loadLearningCatalog` already exists on the API). Reject unknown, wrong-locale, or deprecated ids. The client must not be the only source of sung text. |
| Session | Selection is ephemeral UI state until the learner confirms lyrics. A confirmed lyric document becomes durable (local first). |

### What is never selected or sent

The lyrics request **must not** include:

- recorded audio, PCM handles, file paths, ASR transcripts
- memory-hook / note text (`PhraseState.note`)
- FSRS fields, automaticity, latency, scores, reps, streak, or any learner number
- chat turns or captured OCR text
- other courses’ phrases

Optional steering may send **tag counts** (`pron` / `remember` / `useful` / `words`) in the same
bucketed shape as `SceneRequestSchema`, not the raw tag list as prose.

Today’s Refrain set may be offered as a **one-tap preset** (“Use today’s set”) when it has ≥3 active
catalog phrases. That is a convenience over the same `PhraseView` rows, not a second scheduler.

## LLM lyrics pipeline

### Ownership

| Layer | Owns |
| --- | --- |
| `packages/core` | Lyric document schema, phrase-containment validator, draft HTTP types |
| `packages/content` | Catalog lookup helpers used by the validator; no runtime LLM |
| `apps/api` | Prompt, schema parse, safety, budget, repair-once, provenance |
| Plan 86 | Anthropic (or successor) **text** transport, deadlines, concurrency, redaction |
| Plans 76/82 | Patterns to reuse: trusted system vs untrusted learner input, structured output, no audio fields |
| Mobile | Phrase picker, review UI, copy. No provider keys. No prompt text in the app. |

`AI_PROVIDER` stays the lyrics-model selector. Do not overload it with Music. Do not call ElevenLabs
from the lyrics step.

### Language

| Text | Language |
| --- | --- |
| Sung lyrics (`lines[]`) | Course **target** (`es-ES` / `bg-BG` / `ru-RU`) |
| Section labels in the composition plan (`[Verse 1]`) | English (ElevenLabs documents English style/section text as the reliable input language) |
| Native gloss / title for the review screen | Learner **UI / meaning** language (`en` / `bg` / `ru`) |
| Style pack names shown in UI | Copy/`i18n`, native language |
| Style strings sent to ElevenLabs | English (required by the Music API for best results) |

Lyrics are not authored in the UI language. A Bulgarian UI learning Spanish still sings Spanish.

### Lyric document (normative shape)

```ts
// Illustrative — implement as Zod in packages/core, then draft OpenAPI.
type LyricDocument = {
  schema_version: 1
  target_locale: 'es-ES' | 'bg-BG' | 'ru-RU'
  meaning_language: 'en' | 'bg' | 'ru'
  catalog_version: number
  phrase_ids: string[] // catalog ids, order-preserving
  title: { target: string; translation: string } // short; not a copyrighted song title
  sections: Array<{
    name: string // Verse 1 | Chorus | Bridge | Outro
    lines: string[] // target-language lyric lines
  }>
  used_phrases: Array<{
    catalog_phrase_id: string
    target_text: string
    section_name: string
    line_index: number
    match: 'exact_line' | 'contiguous_span'
  }>
  gloss_lines: Array<{ target: string; translation: string }> // UI only; not sung
}
```

Bounds must fit ElevenLabs Music composition limits (see [ElevenLabs Music](#elevenlabs-music)):

- ≤ 30 lines per section; ≤ 200 characters per line
- ≤ 8 sections for this product (well under the API’s 30-chunk cap)
- title ≤ 80 characters; no artist/songwriter/album/label names

### Pedagogical fidelity (must fail closed)

Server-side, after Zod parse and before the learner sees lyrics:

1. **Coverage.** Every selected catalog `targetText` appears at least once as a full lyric line or a
   contiguous span inside a line, after Unicode NFC and a single-space fold. Locale-specific folds
   are allowed only when they do not change the teaching words (Spanish accent-insensitive matching
   is in; do not invent a bg/ru fold that drops `ё`/`й` or otherwise rewrites the phrase). Do not
   “helpfully” substitute synonyms (`dónde está` must remain those words).
2. **No extras as if they were selected.** Invented connecting words are allowed; invented extra
   **catalog phrases** and invented learner stats are not.
3. **No fake numbers.** Reject output that includes percentages, latencies, streak counts, or
   “score” claims. The song may not praise or shame the learner’s progress.
4. **Language.** Target-script/language check on `lines[]` (reuse the spirit of scene
   `looksLikeSpanish`, generalized per `target_locale`).
5. **Safety.** Treat any learner-supplied custom text in later slices as untrusted data, not
   instructions. Refuse disallowed content; do not solicit personal data.
6. **Copyright hygiene for the next hop.** Music Terms (26 May 2026) prohibit **any** artist/
   songwriter name, **any** song or album title, label/publisher names, and substantial copyrighted
   lyrics as Input — not only famous ones. Keep `LyricDocument.title` on the review screen; **do
   not** copy it into `composition_plan` text. Section labels stay generic (`[Verse 1]`,
   `[Chorus]`). Reject lines that include artist names or look like a lifted copyrighted lyric.
   Vendor `bad_prompt` / `bad_composition_plan` is a backstop, not the first filter.

One repair attempt that feeds validator errors back to the model; then the
[bundled floor](#bundled-fallback). Never ship an unvalidated lyric document.

### Prompt constraints (structure, not final copy)

Live prompt text will live versioned under `apps/api` (same rule as `ai-services.md` for scenes).
Required system rules:

- You write a short teaching song for a language-learning app.
- Sung lines are only in `{target_locale}`.
- Each selected phrase must appear verbatim at least once.
- Natural song, not a numbered textbook list and not a shame/praise report.
- No artist names, song titles, or copyrighted lyrics.
- No scores, streaks, or claims about the learner.
- Output JSON matching the schema. Nothing else.

User payload: ordered phrase `targetText` + meaning-language translation + optional theme/CEFR/
register from the **catalog**, plus bucketed tag counts. No notes. No progress fields.

### Safety and cost

Reuse plan 86 admission (deadline, concurrency, redaction, no retry on ambiguous spend). Add a
lyrics-specific per-principal and global budget key, separate from scene/chat. Cache key:

`sha256(schema_version, prompt_version, model_id, target_locale, meaning_language, catalog_version, ordered_catalog_ids, tag_bucket)`

Hits skip the LLM. Cache stores the **validated lyric document**, not provider transcripts beyond
the approved retention window (follow the same privacy posture as chat: proposed Q-21 must answer
provider retention; default is **do not allow training / long retention**).

## ElevenLabs Music

Researched 2026-09-09 from published ElevenLabs docs. Do not treat this section as a substitute for
the live OpenAPI at implementation time — pin the adapter to the then-current reference and record
the retrieved date.

### What exists (do not invent)

| Fact | Source |
| --- | --- |
| Compose: `POST https://api.elevenlabs.io/v1/music` | [Compose music](https://elevenlabs.io/docs/api-reference/music/compose) |
| Detailed compose: `POST /v1/music/detailed` (audio + composition plan + metadata) | [Compose detailed](https://elevenlabs.io/docs/api-reference/music/compose-detailed) |
| Create a plan from a prompt: composition-plan API | [Create composition plan](https://elevenlabs.io/docs/api-reference/music/create-composition-plan) |
| `prompt` XOR `composition_plan` | Compose reference |
| `composition_plan` is a **union**: music_v1-shaped `MusicPrompt` (`sections` / `lines` / global styles) **or** music_v2 `CompositionPlan` (`chunks` / `text` / per-chunk styles). Pin **`music_v2` + `chunks`**. Do not send the `MusicPrompt` schema with `music_v2` unless the then-current OpenAPI says that pairing is valid. | Compose / compose-detailed references retrieved 2026-09-09 |
| Models: `music_v1` (default in the compose reference), `music_v2` (recommended; `music_v1` is “outclassed”) | Compose reference; [Models](https://elevenlabs.io/docs/overview/models) |
| `music_v2` languages listed as `en`, `es`, `de`, `ja`, and more | Models overview table |
| Marketing: vocals in **59** languages; “native-like quality in 11” (examples include English, Portuguese, Italian, Finnish, Greek). Bulgarian and Russian are still **not named**. | [Eleven Music API](https://elevenlabs.io/eleven-music-api) |
| Paid API only; Free plan music concurrency **0** | [Music quickstart](https://elevenlabs.io/docs/eleven-api/guides/cookbooks/music); Models concurrency table |
| Music concurrency: Starter/Creator/Pro **2**; Scale/Business **5**; Enterprise highest | [Models — concurrency](https://elevenlabs.io/docs/overview/models) |
| API list price **$0.15 per minute** of generated music (taxes extra; ElevenLabs may change prices) | [API pricing](https://elevenlabs.io/pricing/api) retrieved 2026-09-09 |
| Composition-plan lyrics: max 30 lines/section (or chunk), max 200 characters/line; chunk/section duration 3 000–120 000 ms; `music_v2` up to 30 chunks, total length 3 s–10 min | Compose / ElevenLabs music skill docs |
| Style fields are **free-text English** lists (`positive_styles` / `negative_styles` or global/local equivalents). There is **no published enum of genres**. First chunk styles set the song; docs recommend 6–7 styles early, including generic production-quality tags. | Compose reference |
| `seed` cannot be combined with `prompt`; exact reproducibility is **not** guaranteed | Compose reference |
| `force_instrumental` only with `prompt` (so this product, which needs vocals, uses a composition plan and does **not** set `force_instrumental`) | Compose reference |
| Copyrighted prompts/plans return `bad_prompt` / `bad_composition_plan` with a suggestion when possible; harmful prompts get no suggestion | Music quickstart |
| Optional C2PA signing for mp3 (`sign_with_c2pa`, vendor default **false**); optional `store_for_inpainting` | Compose reference |
| `compose_detailed` also accepts `with_timestamps` and `with_waveform_visual` (both default false). Do not draw a decorative waveform from the latter. | [Compose detailed](https://elevenlabs.io/docs/api-reference/music/compose-detailed) |
| Residency hosts: `api.eu.residency.elevenlabs.io`, plus US / India / Singapore. Prefer EU only if counsel wants EU processing. | Compose servers list |
| Official JS SDK `@elevenlabs/elevenlabs-js` (`client.music.compose`) | Compose reference / quickstart |
| Music Terms (26 May 2026): prohibited industries; prohibited inputs (artist/songwriter names, song/album titles, publisher/label names, substantial copyrighted lyrics); no impersonation of recording artists; output not guaranteed unique | [Music Terms](https://elevenlabs.io/music-terms) |
| Marketing: broad commercial use on **paid** plans; film/TV/large studio game rights need Enterprise; see also Eleven Music v1 terms / model-specific terms | [Eleven Music API](https://elevenlabs.io/eleven-music-api) |

**Not established by current public docs (leave open):** whether Loro’s in-app playback + on-device
cache of learner-requested songs is covered by the self-serve commercial table; required learner-
visible attribution; Bulgarian/Russian **music** vocal quality (Spanish is listed on `music_v2`;
bg/ru are not named in that table); whether a composition plan sings catalog phrases verbatim
enough for teaching. Counsel must read the Music Terms, Model-Specific Terms, and the
commercial-rights table before production.

### How Loro passes lyrics (decision)

**Do not** send a single prose `prompt` that embeds lyrics. ElevenLabs may interpret or drop them.
**Do not** call `composition_plan.create` to invent structure from a prompt — that would rewrite
our phrases.

**Do** build a `music_v2` `CompositionPlan` (`chunks`) on the server from the **already validated**
`LyricDocument`:

- Each lyric section becomes one chunk. Chunk `text` is a generic `[Verse 1]` / `[Chorus]` label
  plus the lyric lines. No artist names. No `LyricDocument.title`. Optional `{soft vocal}` cues
  only from a Loro allowlist, never from the model freely.
- `positive_styles` / `negative_styles` come from the selected [style pack](#loro-style-packs), in
  English, with ≥6 strings on the first chunk as the vendor docs recommend. Leave
  `negative_styles` empty unless the pack explicitly avoids something.
- `duration_ms` per chunk: product default **8 000–15 000** (within 3 000–120 000). **Total**
  `sum(duration_ms)` target **35–60 s** so a 3-style request stays near **2–3 billed minutes**.
  That budget is a constraint on the lyric document: pack 3–8 phrases into a few sections (for
  example two verses + chorus), not one 8–15 s verse per phrase. An 8-phrase one-line-per-verse
  layout at 8 s already exceeds 60 s. Prompt + validator reject plans whose chunk durations sum
  outside 35–60 s (still inside the vendor 3 s–10 min cap).
- `context_adherence`: `high` (vendor default). This means later chunks stay musically consistent
  with their neighbors. It is **not** a guarantee that every catalog phrase is sung verbatim.
- Leave `conditioning_ref` / `AudioRefChunk` unset. Do not condition style B on style A’s
  `song_id` (that is audio Input under the Music Terms).
- `model_id`: **`music_v2`** (pin in config; do not silently float to `music_v1`).
- Prefer `compose` / `compose_detailed` with that hand-built plan. Use `compose_detailed` when we
  persist the returned plan + `song_metadata` for provenance. Do **not** show vendor
  `song_metadata.title` / genres as the learner’s title. Do not enable `store_for_inpainting`,
  `with_waveform_visual`, or streaming in v1. `with_timestamps` waits for a later slice that
  treats vendor timestamps as real metadata, not an estimate.
- `sign_with_c2pa`: product default **true** for mp3 once legal confirms it is appropriate
  (vendor default is false); record the choice in provenance.
- Output format: start with vendor default (`auto` → `mp3_48000_192` for v2). Do not ask the
  mobile client to decode an undocumented container.

A composition plan is the **control surface** for lyrics, not a lock. Pedagogical fidelity is
enforced on the lyric document the learner reviews. Sung intelligibility and phrase preservation
in the mp3 are a quality gate ([Q-21g](#open-questions)), including for `es-ES`.

The API maps Loro style IDs → style arrays. The client never sends raw ElevenLabs style strings.

### Loro style packs

ElevenLabs has no style enum. Loro owns a versioned catalog in `@loro/content` (English style
strings + native-language **labels** via `copy.ts`). Starter set (product may rename; IDs stay
stable):

| `style_id` | Intent | Example `positive_styles` (English, illustrative) | Example `negative_styles` |
| --- | --- | --- | --- |
| `acoustic_folk` | Clear vocals, guitar, teaching-song pace | acoustic guitar, warm folk, clear lead vocal, gentle percussion, intimate, studio quality, great production quality | screamed vocals, heavy distortion, nightclub drop |
| `modern_pop` | Contemporary pop, still intelligible lyrics | modern pop, bright chorus, clear diction, mid-tempo, polished mix, great production quality | death metal, inaudible whispered vocal |
| `gentle_ballad` | Slow, spacious, easy to sing along | gentle ballad, piano, soft vocal, slow tempo, warm, great production quality | rap verse, aggressive brass sting |
| `upbeat_kids` | Cheerful, simple melody (not childish insult) | upbeat acoustic, simple melody, choir-friendly, clear enunciation, cheerful, great production quality | horror drone, growled vocal |

Default request: learner picks **3** of these (min 2, max 4). Same `LyricDocument` for every style.
Do not regenerate lyrics per style.

### Storage, playback, caching

| Store | What | Notes |
| --- | --- | --- |
| API object store (plan 61/86/88 S3 or host disk in dev) | mp3 (or chosen format) bytes, checksum, content type | Key: `music/{sha256}`. Immutable. No public bucket. Short-lived download URLs; never forward API bearer tokens to an arbitrary URL. |
| API Postgres | Job row: principal, lyric document id, style_id, model_id, plan hash, sha256, byte length, duration_ms, provider song id if present, status, error code, spend micros, created_at | Not a sync entity in v1. |
| Device SQLite | `music_job` / `music_track` metadata: ids, hashes, style, lyric foreign key, local path, catalog_version | Local-first. **Do not** add to `fieldPolicy` until a later sync decision exists. |
| Device file cache | Downloaded bytes, content-addressed | Separate namespace from phrase TTS cache (`AS-01` / plan 62). Phrase reference audio and generated songs must not evict each other by accident. Pin the last successful set. |
| Playback | Reuse plan 62 native/web player | Foreground first. Background/lock-screen (`AS-04`) is a later slice and must not imply the track is a catalog reference. |

Cache key for a track:

`sha256(lyric_document_hash, style_id, style_pack_version, model_id, composition_plan_hash, output_format)`

A cache hit does not call ElevenLabs.

### Cost model (planning numbers, not UI)

At the retrieved **$0.15/min** list price:

- One 45 s render ≈ **$0.11**
- Three styles ≈ **$0.34** plus lyrics-LLM cents
- Four styles ≈ **$0.45**

These figures are for budgeting and tests with **fixtures**. They must **not** be shown to a learner
as a live “price” unless Product later decides to surface a real, metered number. If the UI mentions
cost at all, it is a qualitative “uses your song allowance” string, not an invented dollar amount
(non-negotiable: no fake numbers). Three styles still bill as three generations; dispatch them
within the workspace Music concurrency (typically 2), not as a naive fan-out.

Per-principal monthly music budget and a global daily cap live next to the existing
`AI_MONTHLY_BUDGET_USD_PER_USER` / `AI_DAILY_BUDGET_USD_GLOBAL` as **separate** music keys (for
example `MUSIC_MONTHLY_BUDGET_USD_PER_USER`). Exhaustion degrades to lyrics-only + cached tracks.

Ordinary CI **must not** call ElevenLabs or spend. Paid smoke is explicitly enabled, separate, and
capped.

### Rate limits and failure modes

| Failure | Learner-visible outcome |
| --- | --- |
| Offline / timeout | Honest unavailable; keep lyrics; offer retry; play any cached style |
| `429` / concurrency headers | Queue server-side with a short bound; then fail. Do not hammer. Music concurrency is **2** on Starter/Creator/Pro and **5** on Scale/Business (Free is **0**). A default 3-style request must be **serialized or paired**, not three parallel `compose` calls. |
| `bad_prompt` / `bad_composition_plan` | Do **not** auto-apply the vendor’s rewritten prompt (it may drop our phrases). Surface a generic safety/copyright failure and keep the lyric review. Log only codes. |
| Harmful-content reject (no suggestion) | Same generic refusal. |
| Invalid / truncated audio | Fail the style; other styles may still succeed. |
| Ambiguous timeout after dispatch | Do not retry blindly (plan 86 spend rule). Mark job `unknown_spend` for reconciliation. |
| Budget exhausted | Lyrics-only + cache. No fake track. |
| Missing paid Music plan (concurrency 0) | Configured-unavailable; stub/fixture in development. |

Partial success (2 of 3 styles) is a first-class state.

### Licensing and attribution

- API access requires a **paid** ElevenLabs plan. Do not ship a production path that depends on the
  Free tier (music concurrency 0).
- Self-serve “broad commercial use” is **marketing language** plus the Music Terms / model-specific
  terms. Production enablement is Q-21: counsel confirms Loro may generate, cache, and play these
  tracks inside the app for learners, including offline replay of a copy Loro stored.
- Do not claim exclusivity of a generated song (Music Terms: output may not be unique).
- Do not offer social republishing, App Store “ringtone export”, or film/trailer use until rights
  for that use are confirmed (Enterprise table mentions film/TV/games).
- Learner-visible provenance: a copy string such as “Generated song — not a pronunciation model”
  plus, if counsel requires, a provider attribution line. Until Q-21 answers attribution, the UI
  must still distinguish generated music from catalog reference audio.
- Optional C2PA is a provenance aid, not a license.

## Architecture

```
mobile app                    API                         vendors
─────────────                 ──────────────              ────────
phrase picker ──POST /v1/music/lyrics──► lyrics service ─► Anthropic (text)
lyric review  ◄── LyricDocument ────────┘
style confirm ──POST /v1/music/renders──► music service ─► ElevenLabs Music
player/cache  ◄── job + signed GET ─────┘                 (composition_plan)
     │                         │
     ▼                         ▼
 SQLite + file cache      Postgres job + object store
```

### Where work lives

| Package | Responsibility |
| --- | --- |
| `packages/core` | Domain types, validators, draft/target schemas, operation metadata. No provider SDK. |
| `packages/content` | Style-pack table, catalog reload for containment checks. |
| `apps/api` | Coordinators, authz, budgets, adapters, redaction. Credentials stay here. |
| `apps/mobile` | Routes, copy, picker, review, player wiring. |
| `packages/core-rs` | **Out of scope.** No new maths. Do not run DSP on generated songs as if they were native references. |
| Plan 86 integrations | `integrations/elevenlabs/music.ts` **separate** from the existing TTS checklist (plan 86 item 5 / plan 61 is catalog TTS only). `MUSIC_PROVIDER=stub\|elevenlabs`. Never `TTS_PROVIDER`. |

### Contracts

Add draft operations (names illustrative) gated like chat:

- `POST /v1/music/lyrics` — any **authenticated** principal (including plan-67
  installation-bound / anonymous accounts) with a budget. **No** unauthenticated public route.
  Body: `target_locale`, `meaning_language`, ordered unique `catalog_phrase_ids` (3–8), optional
  tag buckets. Response: `LyricDocument` + `provenance` + `fallback` boolean + `cached` boolean.
- `POST /v1/music/renders` — `lyric_document_id` (server-held) + `style_ids[]`. Response: job ids
  and per-style status. No audio bytes on the JSON response.
- `GET /v1/music/tracks/{id}` — authorized download or 302 to a short-lived object URL.

Request/response types **structurally omit** audio uploads, recording handles, and ASR text.
Promote current/target only after Q-21. Examples in OpenAPI remain fixtures, never fallback songs.

### Persistence and sync

- Lyric documents and track metadata persist locally so review/playback survive a process kill.
  `F-03` is consumed as the **offline floor** of this garnish (picker, cached play, lyrics-only
  card). `/music` is not a daily practice surface and does not reclassify Today/Refrain.
- v1: **no ordinary sync** of lyrics or audio. Cross-device replay is a later decision that needs
  merge classes, tenant isolation tests, and a size/cost story.
- Account erasure (`F-07`) must delete server jobs and objects and local files. Export may include
  lyric text the learner generated; it must not include other learners’ output.
- `upsert` rules still apply if a later sync entity appears: never `INSERT OR REPLACE`; never touch
  `field_hlc` / `deleted_at` from a metadata write.

### Offline behaviour

| Situation | Behaviour |
| --- | --- |
| Airplane mode, no cache | Picker works. Generate actions show a real unavailable state. Deterministic lyrics-only floor is available. |
| Airplane mode, cached tracks | Playback works from disk. No spinner that implies generation. |
| Online generation | May wait on HTTP; must not block unrelated practice writes. |
| Practice screens | Unchanged. No network banner on Today/Refrain because music is unavailable. |

Rule 9 / `AI-05`: a useful floor exists when the vendor is down.

### Bundled fallback

When the LLM or Music path fails:

1. **Lyrics-only floor:** a deterministic document that uses each selected `targetText` as its own
   verse line, a simple repeated chorus line taken from the first phrase, and meaning-language
   glosses from the catalog. Mark `fallback: true` and `provenance.kind: 'bundled'`. This is a
   sing-along card, not a fake AI song.
2. **No bundled generated mp3** that pretends to be the learner’s song. A single optional **demo**
   track (human-reviewed, checksummed, clearly labelled “example song”) may ship for UX preview; it
   is never returned as the result of a generation job.
3. Device TTS may speak lyric lines if the learner asks to hear a line (`AS-01` fallback tier 3).
   That is phrase TTS, not Music.

## Privacy

### Generated music is not a learner recording

`P3D-14` / ADR-0011 / the printed promise constrain **recorded learner audio** (PCM, waveforms,
cloud ASR, voice clone, “anonymous sampling”). This feature:

- **never** captures microphone audio
- **never** accepts a recording handle, path, or bytes on any new type or route
- **never** uses ElevenLabs Speech-to-Speech, voice clone, or instant voice clone
- **never** sends catalog reference PCM or device TTS buffers to Music (Music Terms treat sound
  recordings as Input; leave `conditioning_ref` / `AudioRefChunk` unset; we will not upload audio
  references in v1)

Generated mp3 files are **vendor output** requested by the learner, stored as their artifact. They
are not P0. They are also not public catalog audio (`P5`) until a content-lead publishing path
exists (out of scope). Treat lyric documents that embed the learner’s phrase selection as **P2**
when they leave the device (they reveal what the learner is studying). Catalog phrase text itself is
already public content.

### Classification additions (implement with the first networked slice)

| Class | Data |
| --- | --- |
| P0 unchanged | Recorded PCM, ASR audio |
| P2 | Lyric documents, selected phrase ids, generation jobs |
| P4 | Job ids, style ids, durations, success/fail codes, spend micros — **no** lyric text, phrase text, or audio |
| Generated blob | Server object + device cache; deleted on erasure; not analytics |

Settings already exclude `cloudAsrConsent` / `voiceCloneConsent` from sync. Do not add a consent
flag that pretends to authorize recording upload.

## UX and copy

### Screens

New design, declared before it is reachable:

1. Add `{ id: 'phrase-music', path: '/music', kind: 'learner', availability: 'planned' }` to
   `SURFACES` **and** a matching `SURFACE_LAWS` row in the same change (`Record<SurfaceId, …>` is
   exhaustive): `push`, `occasional`, `resumable: false`. Cached tracks are files, not session
   resume.
2. When the route is built, add a More `DESTINATIONS` row in group `practice` with
   `resume: 'none'` (not `practice-session`), not the rail, not Today’s daily CTA. Plan 81 owns
   chrome/laws; plan 56 owns registry/recovery.
3. Do not add this to the 23-screen catalog as if it were authored. A short note in
   `docs/design/screen-catalog.md` under utilities / later surfaces is enough when the route is
   declared.

Route composition stays in `apps/mobile/app/music.tsx` (or a small local folder) until a widget is
used twice. Shared player chrome that is truly shared with Stream/Speak belongs in
`src/ui/components` only with domain props, never `copy` or the store.

### Copy and i18n

- All learner strings through `copy.ts` + `en.json` / `bg.json` / `ru.json` (and `en-XA` if the
  pseudo-locale suite requires the new keys).
- No string literals in `apps/mobile/app/**`.
- Interpolation for counts only (`{count, plural, …}`).
- No shaming (“you ignored practice, so here is a sad song”).
- Target lyric text uses `accessibilityLanguage` matching the real target locale in native source
  (`check:lang`). Browser E2E cannot see that prop.
- Style names and statuses are named in copy (`music.styles.acoustic_folk`,
  `music.state.unavailable`, `music.fallback.lyricsOnly`).
- Distinguish “Generated song” from “Hear it” catalog TTS on phrase detail.

### Accessibility

- Phrase rows and style chips are ≥48 px, named, and selected via `accessibilityState` **and**
  flat `aria-*` (see `Pressable.tsx`).
- Generating is a real busy state with an accessible name, not a decorative spinner without a
  label.
- Player exposes play/pause, style, and duration **only when duration is known from the file or
  provider metadata** — never an estimate.
- Text scale 200% / 310% must keep confirm/generate actions visible.
- Reduced-motion: no implied “waveform dancing” without a real analyser; if there is no real
  signal, do not draw a fake one.

## Requirement IDs

### Existing IDs this plan consumes (do not mint replacements)

| ID | Why it applies |
| --- | --- |
| `AI-05` | Bounded, rate-limited, schema/safety-validated learner-visible AI with a useful fallback |
| `AI-04` | No implementation may upload recorded learner audio |
| `F-03` | Offline floor of this garnish: picker + cached playback + lyrics-only card without network |
| `F-07` | Export/erasure includes generated lyric/audio artifacts |
| `F-08` | Target vs UI language; all seven pairs considered; no silent Spanish |
| `AS-04` | Later playback/transport reuse — not a license to treat songs as catalog TTS |
| `P2-30` | Optional phrase-detail entry; detail remains the phrase source of truth |
| `P3D-14` | Privacy promise; this plan must not weaken it |

`AI-01` / `AI-02` / `AS-01` are **adjacent** (LLM scenes, authoring enrichment, phrase TTS). Do not
reuse them as if they specified songs.

[ADR-0010](../docs/architecture/adr/0010-llm-roleplay-and-guardrails.md) currently lists Roleplay,
chat, coach notes, and import/capture translation as the only runtime LLM uses. This plan does
**not** silently expand that accepted list. When Product accepts the surface, amend ADR-0010 to
add phrase-song lyrics as another garnish path with the same five hard rules. Until then, treat
the addition as proposed.

### Proposed IDs (land in `docs/product/prd.md` only when Product accepts the surface)

Follow the PRD rule that IDs are stable. Prefer the next unused **P3F** series (P3E is chat). Until
Product accepts them, cite them only from this plan.

| ID | Requirement | Rel |
| --- | --- | --- |
| `P3F-01` | Learner selects 3–8 catalog phrases from the current course stream (optional Today-set preset) | later |
| `P3F-02` | LLM (or bundled floor) produces a lyric document that uses those phrases | later |
| `P3F-03` | The same lyric document is rendered in 2–4 Loro style packs via ElevenLabs Music | later |
| `P3F-04` | Validator rejects lyrics that miss a selected phrase, invent scores, or fail safety/language checks | later |
| `P3F-05` | Learner reviews lyrics and confirms before music spend | later |
| `P3F-06` | Offline: cached play + lyrics-only floor; generation unavailable is honest | later |
| `P3F-07` | Generated audio is never the pronunciation/prosody reference | later |
| `P3F-08` | No music/lyrics request type accepts recordings or ASR audio | later |
| `P3F-09` | Partial style success, budget, provider, and copyright failures have real states | later |
| `P3F-10` | All copy through `copy.ts` / i18n; target lyrics carry the real locale | later |
| `P3F-11` | Content-addressed cache, pinned provenance (model, plan hash, style pack version) | later |
| `P3F-12` | Erasure/export deletes or includes the learner’s lyric/audio artifacts | later |

### Proposed open question (do not add to `open-questions.md` until Product wants it tracked globally)

**Q-21 — Phrase-song generation.** May Loro generate learner-requested songs from selected catalog
phrases using a guarded LLM plus ElevenLabs Music, for which targets, under what budget and
entitlement, and under which commercial-rights/attribution/retention terms? **Invariant while
open:** fixture adapters, draft contracts, and validators may land; production keys, learner-visible
enablement, and spend stay off. Q-15 remains the **phrase TTS** gate and does not answer Q-21.

## Testing and acceptance

### Unit / contract

- Phrase-containment and language checks, including accents, Cyrillic, and NFC.
- Style-pack mapping: client `style_id` → English style arrays; unknown ids rejected.
- Draft Zod schemas: no audio upload fields; lyric bounds match vendor limits.
- Redaction tests: logs cannot contain lyric text, phrase text, or API keys.
- Budget/concurrency failure metadata is stable (plan 86 pattern).
- Deterministic lyrics-only floor coverage of all selected phrases.

### API

- Lyrics coordinator: valid / repair / fallback / injection / wrong-language fixtures.
- Music adapter: recorded HTTP fixtures for compose, `bad_prompt`, 429, truncated body. **No live
  ElevenLabs in `pnpm check` or `pnpm ci:local`.**
- Authz: another principal cannot GET a track.
- Canary: native capture module is not referenced by music routes.

### E2E (when the surface is learner-visible)

Add rows to `apps/mobile/e2e/states.ts` in the same change as the route:

- `music · empty selection`
- `music · phrases selected`
- `music · lyrics ready`
- `music · lyrics fallback`
- `music · generating`
- `music · partial styles`
- `music · playing`
- `music · unavailable`
- `music · provider error`

Flow spec: select → lyrics → confirm → (fixture) play. `render.spec.ts` only if a bar/fill states a
**real** duration or count.

### What browser E2E cannot prove

- Native audio session, interruption, background (`AS-04`)
- `accessibilityLanguage` / `accessibilityHint`
- ElevenLabs vocal quality or lyric intelligibility
- Commercial rights
- Physical-device cache after process death (web SQL.js is not that evidence)
- Cost at production volume

### Acceptance criteria (implementation later)

- Catalog phrase selection cannot exceed bounds or cross course; the API rejects unknown,
  wrong-locale, deprecated, or duplicate catalog ids.
- Every accepted lyric document covers every selected phrase or is the marked bundled floor, and
  its planned chunk durations sum to 35–60 s.
- Multi-style renders share one lyric hash and differ only by `style_id` / plan styles; they are
  not dispatched in parallel beyond the workspace Music concurrency.
- No recorded audio field, PCM handle, or `conditioning_ref` exists on the wire or in JS types.
- Offline replay of a cached track does not call the network.
- CI never spends against ElevenLabs or Anthropic.
- No `ProgressDelta` is written because a song played.
- Generated tracks are labelled as generated, not as “native reference”.
- Sung phrase preservation is not assumed from a 200 on `compose`; it is a named quality gate
  (Q-21g).

## Implementation slices (separate later commits)

Each slice should leave `pnpm check` green and carry a requirement id.

1. `feat(core): add lyric document and music draft contracts (p3f-02)` — Zod + draft operations +
   `draftGates.music = ['Q-21']` once Q-21 is recorded, or a plan-local gate comment until then.
2. `feat(core): validate phrase coverage in lyric documents (p3f-04)`
3. `content(content): add versioned music style packs (p3f-03)`
4. `feat(api): stub lyrics coordinator with bundled floor (ai-05)`
5. `feat(api): add elevenlabs music adapter fixtures (p3f-03)` — no live calls
6. `feat(api): persist music jobs and checksummed objects (p3f-11)`
7. `feat(mobile): declare planned /music surface and copy keys (p3f-10)`
8. `feat(mobile): phrase picker and lyric review (p3f-01)`
9. `feat(mobile): style confirm and fixture playback (p3f-03)`
10. `test(mobile): add music e2e states (p3f-09)`
11. `docs(docs): add P3F rows to the PRD when Product accepts (p3f-01)`
12. Live wiring (separate, gated): Anthropic registration for lyrics + `MUSIC_PROVIDER=elevenlabs`,
    only after Q-21, plan-86 controls, and a paid-smoke harness that is **not** default CI.

Do not mix generated bindings, unrelated refactors, or TTS adapter work into these commits. The
ElevenLabs **TTS** checklist in plan 61/86 stays on Q-15.

## Open questions

| ID | Question | Owner | Blocks |
| --- | --- | --- | --- |
| Q-21 (proposed) | Enablement, budget, entitlement, commercial rights, attribution, provider retention, EU residency | Product + privacy + finance + counsel | Live keys, production route |
| Q-21a | Are custom/import phrases allowed after the catalog-only slice? | Product + privacy | Slice after P3F-01 |
| Q-21b | Sync lyric/audio metadata across devices? | Backend + privacy | Any `fieldPolicy` entity |
| Q-21c | Human bilingual review before the learner sees LLM lyrics, or validator-only? | Content (plan 87) | Production quality claims for bg/ru and es-ES |
| Q-21d | How many included songs/month, and is the surface Plus-gated? | Product + Q-08/Q-12 | Entitlement copy |
| Q-21e | Required C2PA / learner attribution wording | Counsel | Production mp3 flags and copy |
| Q-21f | `music_v2` vocal quality for `bg-BG` and `ru-RU` | Content + tech | Enabling those targets for **vocals** (es-ES may proceed earlier if review passes) |
| Q-21g | Does a `music_v2` composition plan sing the selected phrases clearly enough to ship? | Content + tech | Production quality claims for **all** targets, including `es-ES` |
| — | Async job queue vs synchronous HTTP | Backend | Only if p95 generation exceeds a single request budget; plan 86 still defers Redis until a consumer exists |

## Dependencies and ownership

| Owner | Slice |
| --- | --- |
| **96 (this plan)** | Product semantics, lyric validator, music coordinator, mobile surface, style packs |
| 86 | Anthropic reuse; new ElevenLabs **Music** transport; shared spend/concurrency; redaction |
| 76 / 82 | Prompt-injection / safety taxonomy to copy, not Roleplay/Chat UI |
| 61 / 88 | Checksummed object storage and IAM |
| 62 | Player, interruption, cache primitives (separate keyspace) |
| 56 / 81 | Surface registry, More, stack header / Today escape |
| 66 / 67 | Authn/z, principal budgets, no unauthenticated spend leak |
| 59 | Local SQLite tables / migrations |
| 71 | Consent/flags if treated as live AI |
| 87 | Linguistic review of sample songs |
| 74 | Only if paid-gated |

Working rule from the roadmap: **86 owns vendor controls; 96 owns product AI semantics** (same split
as 76/82 vs 86).

## Explicitly out of scope

- Replacing or implementing catalog/on-demand **TTS** (plans 61/62, Q-15)
- Using generated songs as F0 / alignment / DSP references (plans 63/77)
- Writing practice progress from listen-through
- Uploading learner recordings, voice cloning, Speech-to-Speech, audio reference conditioning
- Refrain ambient loop, widgets, lock-screen radio
- Inpainting, finetunes, Music-from-video, stem export, social share
- Editing authored `design/*.dc.html`
- Redis/workers until an implemented volume justifies them
- Enabling GitHub Actions
- Shipping provider keys in the app, APK, or git
- Claiming Q-15, Q-08, or chat questions are resolved
- Polish or any target outside the current seven pairs
- Teaching songs as graded “fluency %” or any simulated score

## Cost / ops notes

- Separate `MUSIC_API_KEY` (or reuse a server-only ElevenLabs key **if** ops accepts one vendor
  credential with two adapters — still two provider switches: `TTS_PROVIDER` and `MUSIC_PROVIDER`).
- Prefer EU residency host if counsel wants EU processing; record the base URL in config, not in
  the client.
- Emit only redacted ops metrics: job counts, latency, provider status codes, concurrency headers,
  spend micros. No lyrics.
- Plan 88’s $25–35 host budget does **not** include Music minutes. Paid smoke and production spend
  are a different envelope (Q-21).
- Image/deploy: new deps (`@elevenlabs/elevenlabs-js` if used) must land in the API image and pass
  `scripts/ci-api-image.sh` before EC2 cutover. Adapter-only fixture tests do not prove that.

## Docs this plan does not change yet

Durable specs stay in `docs/` when Product accepts the surface: PRD `P3F-*` rows, a short
`ai-services.md` table row, a privacy-class row, an ADR-0010 garnish-path amendment, and
optionally Q-21 in `docs/decisions/open-questions.md`. This file is the implementation owner
until then. Do **not** add Q-21 to the global open-questions list from this planning change.

## Review (2026-09-09)

Adversarial re-read of this plan against `origin/main` at `d153d82` and live public ElevenLabs
Music docs (compose, compose-detailed, models, API pricing, Music Terms 26 May 2026, Music API
marketing, music quickstart). Repo checks: PRD IDs, `PhraseView` / `isActive`,
`SceneRequestSchema` tag buckets, `draftGates` (no music key yet; last global Q is Q-20),
`fieldPolicy` (no song entity), `AI_PROVIDER` / `TTS_PROVIDER` stubs, unregistered Anthropic
transport, `SURFACES` / `SURFACE_LAWS` / More `practice` group, copy/`en-XA`, and plan 86’s
TTS-only ElevenLabs checklist.

**Held:** optional garnish (not a 23-screen / daily-loop path); catalog-only 3–8 selection;
guarded LLM + repair-once + bundled lyrics floor; `composition_plan` over a lyrics-in-prompt;
Loro-owned style packs (no vendor genre enum); `MUSIC_PROVIDER` ≠ `TTS_PROVIDER`; local-only v1
(no `fieldPolicy`); no `ProgressDelta`; recorded PCM never on the wire; `/music` via More;
proposed `P3F-01`…`12` and `Q-21` do not collide; live spend stays off CI; authored design
untouched; Q-21 stays out of `open-questions.md`.

**Adjusted in this pass (not implementation):** request identity is catalog ids only;
deprecated/wrong-locale rejection; 35–60 s total vs 3–8 phrases; pin `music_v2` **chunks** (not
the v1 `MusicPrompt` union member); `context_adherence` is musical, not a lyric lock; sung
fidelity is Q-21g; titles stay off the vendor wire; `conditioning_ref` unset; serialize styles
against concurrency 2; authenticated principals only; ADR-0010 amendment deferred until Product
accepts; residency hosts listed beyond EU; `compose_detailed` waveform/timestamp flags called
out.

`CLAUDE.md` already carries the next plan number (**97**). No extra feature pointer was added
there; the active owner stays this file and `plans/README.md`.
