# Batch phrase listening companion

- **Requirement IDs:** `AS-07`, `AS-01`, `F-03`
- **Number allocation:** 96 is archived account screens; 97 is generative Discover; 98 is catalog
  TTS (AS-01). This listening companion is 99.
- **Milestone:** M2
- **Status:** 🟡 Composer, listening-class TTS contract, ElevenLabs transport, native file-URI
  cache/`playFile` with checksum-on-lookup, batch restore, `/listen-export` copy/E2E, a labeled
  development fixture that **downloads over loopback HTTP** into that cache (native debug, not
  Hermes `__DEV__`; not a `store()` bypass), file-URI generate/cache/listen tests, iOS/Android
  `playFile`/download parity, Q-15 leaning Voice Library pins in `LISTENING_VOICE_DECISION`, pinned
  listening generate into the native file-URI cache (ElevenLabs or labeled `TTS_STUB_RENDER=1`), and
  Q-22 mux/share fail-closed are implemented. Browser generate stays `native-unavailable` (no JS PCM
  download). Pronunciation review remains on [Q-15](../docs/decisions/open-questions.md#q-15).
  Share-out-of-app remains ⛔ [Q-22](../docs/decisions/open-questions.md#q-22). On the `loro_listen`
  API 36 emulator (`emulator-5554`, `app.loro.android.dev`), native `download()` fetched the labeled
  silent AAC over loopback HTTP (20× `fixture-http-download` + sha256
  `7450e588d78b20dabaccb960a9860951f2374de5d18756751f358578727cb6b0`), then airplane mode
  (`ping 8.8.8.8` unreachable) replayed that `file://` clip via `playFile`. Debug fixture seed is
  skipped when licensed generate is available (native cache + API URL + pins + network) so Generate
  uses `POST /tts/render` + native `download()`, not `installDevFixture`. `TTS_STUB_RENDER=1` may
  serve listening-class silence without a bearer for local cache wiring; it is not licensed neural
  audio. That is not physical-device 58/72 and not licensed Q-15 audio. Device TTS is a labeled
  fallback, not the primary path. `CI_BASE_REF=origin/main pnpm ci:local` passed at `bcd35dc`
  (learner E2E 197, workbench, production-e2e, mobile-bundle, API image). Item 7 pins are filled;
  pronunciation review and Q-22 remain.
- **App swap (2026-09-30):** the composer, `/listen-export` route and `loro-audio-cache` native
  module were in the first app and were removed with it. The listening-class TTS contract,
  ElevenLabs transport and API render remain; the current app has no listen-companion client.
- **Depends on:** 56 route declaration; 81 More destination; 59 active-course phrase inventory; 87
  target locale; 62 disk cache, atomic download, and exclusive playback session; 86 ElevenLabs
  transport; 61 asset identity and checksum policy for model audio; 58/72 for native evidence. The
  draft `POST /tts/render` route is a 66+86 implementation input (61 owns identity rules) — this
  plan consumes it and does not add a second TTS client.
- **Reviewed:** 2026-09-09 specification against `d153d82`; implementation pass 2026-09-09 for
  contract, cache, composer, restore, and fail-closed transports; 2026-09-10 checksum-on-lookup,
  development fixture seed, file-URI generate/cache/listen tests, emulator airplane-mode fixture
  listen, loopback HTTP download+hash+`playFile` on `loro_listen` (2026-09-10), and
  `CI_BASE_REF=origin/main pnpm ci:local` green at `bcd35dc`. Live generate still needs a key;
  share-out-of-app, pronunciation review, and physical-device 58/72 remain gated.

## Outcome

A learner prepares a batch of active-course phrases for **listening**, not practice. The app
**renders multi-voice takes online** (ElevenLabs is the selected provider; pins live in
`LISTENING_VOICE_DECISION`; stub/missing key still fail closed), **caches each phrase×voice clip on
device**, then plays that cache in airplane mode. Optionally, after
[Q-22](../docs/decisions/open-questions.md#q-22), native code concatenates those same cached clips
into one AAC/M4A and shares it through the OS share sheet.

Each phrase is spoken several times in sequence, rotating through distinct **licensed neural**
voices for the target locale. The artifact and the in-app sequence are model audio only. Learner
recordings never enter the cache or the file.

This is a **listening companion**, not Stream. It does not write `ProgressDelta`, does not replace
Stream repeats (`P3-02`), does not replace canonical one-voice reference audio (`AS-01` /
[content-authoring.md](../docs/process/content-authoring.md#4--render-and-extract)), and does not
replace in-app background transport (`AS-04` / plan 62).

## Why this is a new owner

| Existing owner                                                      | What it already covers                                                   | Why it cannot absorb this                                                                                        |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| [61](archive/2026-09-09/61-content-and-audio-assets.md)             | Catalog render, one consistent reference voice per variant, signed packs | Multi-voice listening clips would invalidate the “one voice forever” pronunciation reference and `f0_native`     |
| [62](archive/2026-09-09/62-native-audio-playback.md)                | In-app session, cache, rates, lock-screen / background transport         | Stream keeps audio inside practice playback; this plan owns batch selection, listening-class pins, and share-out |
| [67](archive/2026-09-09/67-anonymous-auth-and-account-lifecycle.md) | GDPR JSON export of phrases and progress (`F-07`)                        | JSON is not listenable; mixing file-share TTS with account portability would blur privacy and entitlement        |
| [86](archive/2026-09-09/86-provider-integrations.md)                | Vendor transports, including the fail-closed ElevenLabs TTS adapter      | Adapter is shared input; this plan owns the listening product, cache identity, and UX                            |

Canonical in-app reference audio stays one reviewed voice per variant. Multi-voice rotation is
listening-only and must never become the DSP or Speak model.

## Verified starting point (pre-implementation)

- Starter catalogs remain text-only. `packages/content` has no `.m4a`/`.mp3` assets; `audioCheck`
  currently warns that catalog rows have no rendered audio. Phrase `audio` is `{ uri, sha256, ms }`
  with no voice-id or listening-class field — listening identity is a separate cache key, not a
  catalog mutation.
- `apps/mobile/modules/loro-audio-speech` still plays one installed offline target voice for
  practice TTS. This plan added `playFile` for cached `file://` clips and a **separate**
  `loro-audio-cache` module for HTTPS download. JavaScript never receives PCM.
- Phrase Detail / Stream already consume device TTS. Browser E2E cannot prove native speech.
- Account JSON export (`F-07`) remains unimplemented in plan 67 and is a different artifact.
- Q-15 leaning pins cover in-app generate. A provisioned API key is not a voice licence and is not
  redistribution permission. Q-22 still blocks sharing licensed neural audio as a learner-owned
  file. Neither question is resolved by this plan.
- ADR-0011: learner PCM never leaves native memory; no JS API returns audio bytes; a P0 alert fires
  on any network request **originating in the audio module**. Model-audio HTTP is issued by
  `loro-audio-cache`, not `loro-audio-speech`.

**Current implementation (2026-09-10).** `/listen-export` is a built Phrases utility.
`POST /tts/render` accepts `voice_id`, `model_id`, `asset_class`, and metadata-only JSON. A
mocked-allowlist API test proves listening-class `voice_id` + `asset_class: listening` with no PCM
in JSON and no live ElevenLabs credits; production `LISTENING_VOICE_DECISION` holds the 2026-09-10
Voice Library pins (in-app cache/playback only). `loro-audio-cache` downloads and pins listening
clips, verifies sha256 on lookup and batch restore, restores a complete batch across relaunch, and
keeps mux/share behind `LISTENING_SHARE_ENABLED = false`. `playFile` plays `file://` URIs and stops
when backgrounded on iOS and Android. JavaScript still never receives PCM. Filling
`LISTENING_VOICE_DECISION` is the licensed-generate switch; see the
[listening-voice packet](../docs/decisions/listening-voice-packet.md). Product docs pin listening
voices for in-app use; a decrypted API key is not a share licence. Native debug builds
(`FLAG_DEBUGGABLE` / iOS `DEBUG`, not Hermes `__DEV__`) seed a labeled silent AAC by serving it on
loopback HTTP and calling the same `download()` path (sha256 verify + listening pin). Copy must not
present it as licensed neural audio. The render client attaches an optional bearer session and maps
429 to quota; native download sends that Authorization header and refuses redirects so the token
cannot hop hosts. Node tests prove prepare → HTTP download → checksummed `sha256/{hex}.m4a` →
airplane replay from file URIs → restore, with share still gated. Learner listen-export E2E passed
inside `pnpm ci:local` (197 passed, 2026-09-10). `CI_BASE_REF=origin/main pnpm ci:local` passed at
`bcd35dc` after Docker install, a Linux workbench 310% snapshot refresh (310×442), and bundling
workspace TypeScript into the API image. An Android emulator (`loro_listen`, API 36) later exercised
the real cache path: wipe cache, generate via loopback HTTP `download()` + sha256 verify + listening
pin, then `cmd connectivity airplane-mode enable` and `playFile` of `file://…/sha256/7450e588….m4a`.
Copy still labels that clip a development snapshot. That is not physical-device 58/72 and not Q-15
licensed audio.

## Product shape (working assumptions)

Record these in `docs/` when the first slice lands. Change them only with an explicit product note;
do not silently match Stream or catalog-render policy.

1. **Online-first generation.** The primary path fetches or renders licensed neural voices over the
   network, then persists each clip on device. First-time generation **requires network**. A cache
   hit does not. This utility is not a practice surface under `F-03`; empty-cache airplane mode is
   an honest unavailable state, not a silent device-TTS “export anyway” flow.
2. **Batch.** First slice: every **active** phrase in the current target course (catalog-backed and
   learner-authored). Later presets (due today, tag, custom multi-select) reuse the same cache and
   exporter. Course isolation from plan 87 is mandatory; never mix courses or silently substitute
   Spanish.
3. **Repeats.** Default **3** takes per phrase, learner-selectable **2–5**. Named constants, not
   magic numbers. Independent of Stream’s `hard 4 · med 3 · easy 2` (`P3-02`) until product unifies
   them.
4. **Voices.** Rotate distinct **licensed neural** voices for the target locale (ElevenLabs voice
   IDs pinned after Q-15). The primary action requires **at least two** approved listening voices;
   one approved voice is an honest unavailable state, never fake variety. If voice count `<`
   repeats, rotate and show the actual sequence in the summary (`A, B, A`). Do not treat installed
   device voices as the variety source for this product.
5. **Device TTS fallback.** When a cache miss cannot be filled online, the UI may offer a labeled
   on-device voice so the learner can still hear the line **in-app**. Copy must say it is the device
   voice. Fallback must not mint extra implied neural voices, must not write a neural-branded file,
   and must not be the advertised offline recording. A device-TTS-only shareable export is **out of
   scope** for the first slices.
6. **Layout (in-app and export).** Concatenate
   `[phrase i · voice k][intra-gap]…[inter-phrase gap][phrase i+1 · …]`. Intra-phrase gap **400
   ms**, between-phrase gap **1200 ms**. Target-language text only; no native-language prompt in v1.
   Render/play at **1.0×**; the in-app player (plan 62) or the external player owns speed.
7. **Offline substrate = per-clip cache.** Export, when allowed, is concatenation of **already
   cached** clips. Do not re-render at share time if the cache is complete. Do not generate a second
   identity for the same phrase×voice×text.
8. **Artifact (Q-22).** One AAC 64 kbps mono 24 kHz `.m4a`, matching the catalog codec in
   [content-model.md](../docs/product/content-model.md#audio). Filename
   `loro-{targetLocale}-{localDay}-listen.m4a` using `clock.localDay()`. Share through the OS share
   sheet / Files. Per-phrase folders and M3U playlists are later, not the first slice.
9. **Privacy.** Learner PCM never leaves native memory and is never muxed into cache or file
   (`P3D-14`, AI-04). Catalog target text may be sent to the licensed TTS path under Q-15.
   Learner-authored **text** is sent to cloud TTS only after an explicit confirmation on this
   utility (copy in `copy.ts`). That consent is not a Q-15 or Q-22 resolution.
10. **Honesty.** Never fabricate voices, durations, scores, or cache completeness. Duration is
    measured from native synthesis/file length or `null`.

## Online generation and cache contract

### When generation runs

Generation is **user-initiated** from `/listen-export` (Prepare / Generate). It is not a silent
full-catalog prefetch and not a practice-queue side effect.

- Cache miss + reachable network → request render/fetch for that phrase×voice.
- Cache hit (verified file + matching key) → skip network.
- Cache miss + no network → do not pretend success; show unavailable; optional labeled device-TTS
  in-app play of that line only.
- Text change (new text digest) → previous clip is the wrong phrase; do not play it; treat as miss.

### What goes on the network

Text-only render or authorized download of **model audio**:

- target locale
- target-language text (or a server-side hash of it)
- pinned listening `voiceId` + model + output format
- asset class `listening` (never `reference`)
- content `phraseId` when the row is catalog-backed

Never: learner PCM, mic buffers, transcripts, progress JSON, or JS-held audio bytes.

`POST /tts/render` now carries a licensed listening `voice_id` / model pin and an asset-class
discriminator so listening clips cannot collide with `AS-01` reference audio. This plan consumes
that contract and must not call a one-voice catalog render and relabel it.

**Response shape (working assumption):**
`{ downloadUrl, uri: sha256/…, sha256, ms, voiceId, assetClass: 'listening' }`. The HTTP body that
JavaScript parses is **metadata**. Audio bytes travel on the download URL into the **native cache
downloader** (plan 62). Do not put AAC/PCM/base64 in a JSON field the JS runtime decodes.

Pre-rendered listening packs from plan 61, if they exist later, are cache **seeds** with the same
identity rules. They do not become a second clip class.

### On-disk identity

Address files by **content sha256** of the AAC bytes, same as catalog audio (`sha256/{hex}.m4a`).
The cache **index** (SQLite or plan 62’s cache catalog — do not invent a second store) keys a
logical clip:

| Field        | Role                                                             |
| ------------ | ---------------------------------------------------------------- |
| `assetClass` | `listening` — never stored as catalog `audio.sha256` / reference |
| `locale`     | Target BCP-47                                                    |
| `phraseId`   | Catalog or learner phrase id                                     |
| `textDigest` | sha256 of normalised target text; edits invalidate               |
| `voiceId`    | Pinned ElevenLabs (or later licensed) voice id                   |
| `modelId`    | Pinned model                                                     |
| `codec`      | `aac-64k-mono-24k`                                               |
| `sha256`     | Bytes on disk                                                    |
| `ms`         | Native-measured duration                                         |
| `pinned`     | Exempt from ordinary LRU while the batch is retained             |

A metadata row without a readable, checksum-matching file is a miss.

### Pin vs eviction

Plan 62 already specifies a practice cache (today’s Refrain, trip set, stream queue; 150 MB LRU).
Listening clips are a **separate pin class**:

- Pin every clip in the learner’s current prepared batch until they dismiss it or replace the batch.
- Do not evict plan 62 practice pins to make room for listening, and do not evict a pinned listening
  batch to make room for unpinned catalog prefetch.
- Unpinned listening clips follow LRU under a named listening budget (working assumption: **64 MB**,
  measured later; do not treat the 150 MB practice figure as evidence).
- Abandoned or failed prepares cannot grow without bound: delete partial files; cap temp.

### Resume, partial failure, cancellation

- Write each clip atomically (temp file → fsync → rename). Verify sha256 before indexing.
- A batch manifest lists intended phrase×voice rows and which sha256 values are present.
- Resume skips verified hits; retries only misses. Provider-side dedup is not assumed.
- Partial failure: keep good clips, report the failed ids, never mark the batch complete.
- Cancel: abort in-flight downloads in the cache downloader, delete partial files, **keep**
  completed clips (they remain useful cache).
- Disk-full: fail closed; leave the previous complete batch intact.

### Airplane mode after a successful cache

With a complete pinned batch on disk, in-app listen plays from file URIs with no network. Export
concatenation (Q-22) also needs no network. Force-quit and relaunch must still see the index +
files; a metadata-only row is not a hit.

## Native / JS boundary

Learner PCM stays in native memory (ADR-0011, ADR-0007). Model-audio **files** are a different
object: they are licensed TTS output, written to the app file cache, never a recording.

How online audio reaches disk without giving JS PCM:

1. JS asks the API for a listening render (text + voice + class). It receives metadata and a
   short-lived download URL — not bytes.
2. JS calls plan 62’s native cache API: `cache.download({ url, expectedSha256, logicalKey })`.
3. Native downloads, verifies, stores, returns `{ fileUri, ms, sha256 }`.
4. JS keeps only URIs and numbers. No base64, `ArrayBuffer`, or readable stream of audio.
5. In-app play: plan 62 `load(slot, fileUri)`.
6. Export (Q-22): native concatenate of file URIs → new file URI → OS share sheet. JS never reads
   the muxed bytes.

`loro-audio-speech` must not grow an HTTP client. ADR-0011’s P0 alert on audio-module network
requests still applies. Device-TTS fallback, if used, stays speaker-only until a synthesize-to-file
API exists; that API still returns a file URI only.

## Ownership

- **This plan** owns the listen-export route UX, batch/repeat/voice summary, listening-class cache
  keys and pins, prepare/resume/cancel, in-app listen-from-cache sequencing, concatenate+share
  (after Q-22), copy, E2E states, and the `AS-07` spec.
- **56** owns adding `/listen-export` to `SURFACES` / route laws (`push`, occasional, utility, not
  rail, not learner screen 24).
- **81** owns the More row (Phrases group) once the surface is `built`.
- **62** owns the native playback session, atomic download-to-disk cache, and file-URI playback.
  Listening prepare must serialize against that session (stop or wait) so two owners never fight
  `AVAudioSession`. 62 does not own multi-voice product policy.
- **61** owns catalog **reference** render, signed pack identity, and checksum policy. Listening
  variants must not share reference asset IDs. 61 does not own this UI.
- **86** owns the ElevenLabs transport and common controls. 99 does not add a second client.
- **66** hosts a live `POST /tts/render` (or successor) wired to 86; 99 consumes the contract.
- **67** owns JSON account export; never this AAC.

## Remaining work

1. [x] Keep
       [functional-spec.md](../docs/product/functional-spec.md#as-07-batch-phrase-listening-export)
       aligned as the UI is built. Copy lives in `copy.ts`; no learner-facing literals in `app/`.
2. [x] Declare `/listen-export` in plan 56’s surface table as a **utility** (`push`, occasional,
       Phrases / More). Do not number it as learner screen 24. Add the destination only when the
       route is `built`. Plan 81 consumes that declaration; do not create a second route table.
3. [x] Agree the listening-class extension to `POST /tts/render` (or successor) with 61/66/86: voice
       id, model pin, asset class, metadata-only JSON, native download of bytes. Fixture the client
       against recorded responses; normal CI must not call ElevenLabs.
4. [x] Consume plan 62’s cache downloader: atomic write, sha256 verify, file URI out, listening pin
       class, named budget, resume, cancel, disk-full. Pause or refuse if an in-app play/listen
       session is active. An Android emulator (`loro_listen`) downloaded the labeled fixture over
       loopback HTTP, verified sha256, pinned listening, and replayed `file://` in airplane mode
       (2026-09-10). Physical-device 58/72 and licensed Q-15 audio remain.
5. [x] Build the utility UI: course-scoped phrase count, repeat stepper (2–5), licensed voice roster
       (real pinned names/ids after Q-15; honest empty before), generate/prepare with progress,
       cancel, resume from partial, in-app listen from cache, share (hidden or disabled with Q-22
       copy while that question is open), measured duration or `null`, and honest empty /
       needs-network / quota / error states. Browser may preview the composer and must mark
       generate, cache, listen, and export unavailable until a real native/web encoder exists; do
       not fake a download.
6. [x] Add learner E2E states for empty course, needs-network cache miss, generating, partial
       failure, ready-to-listen (cache complete), in-app playing, share unavailable (Q-22), share
       ready (when allowed), cancellation, disk-full, session-busy, quota, and voices-single.
       Browser suites cover copy, a11y and text scale. Emulator airplane-mode listen of a
       **HTTP-downloaded** development fixture batch is evidenced (`playFile` from
       `sha256/{hex}.m4a` while `ping 8.8.8.8` is unreachable). Physical-device 58/72 and licensed
       Q-15 audio remain. Native share of the concatenated file is the acceptance for Q-22 export.
7. [x] Pin ≥2 listening voice IDs per enabled target, distinct from catalog `TTS_VOICE_*`, in
       `LISTENING_VOICE_DECISION` (2026-09-10). `licensed: true` is in-app cache/playback only.
       Pronunciation review remains before calling pins production-quality. After Q-22: enable share
       of concatenated cached clips and document personal-copy / deletion-on-licence-withdrawal
       behaviour. Never re-render a reference clip under a listening-variant ID.

## Acceptance criteria

- **Generate online, play offline:** with pinned voices, a configured key, and network present,
  preparing the active-course batch writes one verified clip per phrase×voice. After airplane mode,
  in-app play of that batch uses only disk. A cache miss in airplane mode is unavailable (or labeled
  device-TTS in-app), never a fabricated neural voice.
- Each phrase appears N times (the chosen 2–5) before the next phrase. Consecutive takes of the same
  phrase use different licensed voice IDs until the approved set is exhausted, then rotate. The
  on-screen roster matches the cache index and, when Q-22 allows, the shared file.
- Empty-batch, needs-network, quota, cancellation, disk-full, in-app-session-busy, and unapproved /
  single-voice states are truthful. No simulated duration, score, or voice name.
- Cache and file contain only synthesised model audio of the selected target texts. No learner
  recording, mic buffer, or progress JSON. JS never receives PCM, base64, or an audio buffer.
- Canonical catalog/reference audio, Stream repeat counts, and account JSON export are unchanged.
- Share-out-of-app of neural clips remains disabled while Q-22 is open. Enabling it requires the
  Q-22 answer plus native evidence of the shared file, not a green browser run.
- `pnpm check` and learner E2E pass for the new route/states. Native claims require physical-device
  evidence through 58/72.

## Delivery order and gates

1. **Route + composer + cache contract (landed).** `/listen-export` UI, keys, honest unavailable
   generate/listen/share. Development fixtures seed from native debug, not Hermes `__DEV__`. Browser
   remains an honest unavailable generator.
2. **On-demand render + native cache (Q-15 pins filled; pronunciation review and live key remain;
   86/61/66 for the live route).** Listening-class contract, ElevenLabs transport, and native
   file-URI cache/`playFile` landed. Prepare uses the pinned roster. Default stub/missing key still
   fail closed. `TTS_STUB_RENDER=1` is a labeled listening-class download path, not licensed neural
   quality and not catalog publish. With that flag, listening-class render and asset GET may omit a
   bearer so a local device can fill the native cache; ElevenLabs still requires a session. Debug
   APKs skip `installDevFixture` when licensed generate is available. Browser generate stays
   unavailable until a real native/web encoder exists. Device TTS fallback stays labeled. Live
   ElevenLabs must not run in CI.
3. **Airplane-mode in-app listen.** Emulator evidence (2026-09-10): debug APK with embedded bundle,
   loopback HTTP fixture `download()` + sha256 + pin, airplane mode, `playFile` from `file://`. This
   does **not** require Q-22. Physical-device 58/72 and pronunciation-reviewed generate remain open.
4. **Concatenated share (⛔ Q-22).** Native mux of cached clips exists behind
   `LISTENING_SHARE_ENABLED` and stays false. Share sheet copy is unavailable. Blocked until
   licensed neural audio may leave the app as a learner-owned file.

## Out of scope

In-app Stream/Refrain playback policy, background lock-screen transport, DSP/ASR, learner-recording
export, account JSON/erasure, playlist apps as a backend, changing the one-voice pronunciation
reference, implementing signed catalog packs, shipping a device-TTS-first export as the v1
companion, and fabricating voices when fewer than two licensed listening voices are approved. The
ElevenLabs transport uses the 2026-09-10 pins; live spend still needs a key. Pronunciation review
remains on Q-15.

## Review findings (2026-09-09)

Recorded so the next implementation pass does not re-discover them.

1. **Primary path flipped.** The previous specification made offline device TTS the first slice and
   parked neural packs behind Q-15/Q-22. Product now generates online and caches for offline listen.
   Device-TTS-first export is no longer unblocked work.
2. **Q-22 splits in-app vs share.** In-app cache of model audio is the same class as the planned
   catalog cache (still Q-15 for production voices). Q-22 only gates writing that audio to a
   learner-owned file outside the app. Treating “neural packs” as one gate hid a shippable in-app
   slice.
3. **Live TTS route has no remaining-work owner.** Draft `POST /tts/render` is owned by 61 in the
   contract, but plan 61’s catalog worker is `content:render` and the live endpoint is out of scope.
   99 must consume 66+86+61 rather than grow a client.
4. **Contract cannot express listening variety.** `TtsRequestSchema` has no voice id or asset class;
   catalog `audio` is one `{ uri, sha256, ms }`. Collision with `AS-01` is a silent product bug if
   ignored.
5. **JS-byte temptation vs ADR-0011.** Fetching AAC in JS would “work” and would violate the
   structural PCM/bytes rule. Native downloader returning a file URI is mandatory. The speech module
   must not be the HTTP client.
6. **F-03 does not make generation offline.** Practice stays offline-first. This companion’s offline
   promise is **cached playback**, not first render. Copy and the offline matrix must say so.
7. **P3-02 and one-voice-forever stay independent.** Repeats 2–5 default 3; Stream remains
   difficulty-based. Listening voices never write `f0_native`.
8. **Native module could not enumerate or mux at specification time.** Fallback in-app device TTS
   uses the existing speaker path. Cache download and concatenate live in `loro-audio-cache` (plan
   99 consuming plan 62), not a JS encoder. Mux/share stays behind Q-22.
9. **Browser cannot prove the product.** Composer E2E is copy/a11y only. Offline listen needs a
   device with a filled cache.
10. **Learner-authored text is a privacy event.** Catalog text is Q-15. User-typed lines need
    explicit send-to-cloud confirmation. Not a silent “same as catalog” decision.
