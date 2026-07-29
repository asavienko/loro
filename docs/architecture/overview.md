# Architecture overview

The system end to end. Read this before any other architecture document.

---

## Forces

What actually shapes this architecture, in priority order. Every significant decision traces back to
one of these.

| #   | Force                                                                                                                       | Consequence                                                                                                                                                         |
| --- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **A learner abroad has no network.** Survival mode is the product's most important moment.                                  | Offline-first is not a feature. The device is the source of truth; the server is a sync peer. [ADR-0003](adr/0003-offline-first-sqlite-sync.md)                     |
| 2   | **Speaking is the core loop.** Every practice surface has a mic.                                                            | ASR must work on-device with no network. [ADR-0005](adr/0005-on-device-asr-cloud-fallback.md)                                                                       |
| 3   | **🔒 "Your audio stays on your device"** — printed on screen (`Loro.dc.html:1281`).                                         | Pitch extraction, alignment, and scoring run on-device. Recorded audio never uploads without explicit per-use opt-in. [ADR-0011](adr/0011-analytics-and-privacy.md) |
| 4   | **Scoring must be identical everywhere** — the same take, scored on iOS, Android, or the server, must give the same number. | One implementation in Rust, shared. [ADR-0002](adr/0002-shared-rust-core.md)                                                                                        |
| 5   | **Three competing practice philosophies, unresolved.**                                                                      | The loop is a plug-in, and every engine maintains every progress signal. [ADR-0006](adr/0006-pluggable-practice-engines.md)                                         |
| 6   | **21 dense, animated screens for a small team.**                                                                            | One UI codebase. [ADR-0001](adr/0001-cross-platform-react-native-expo.md)                                                                                           |
| 7   | **Audio must survive backgrounding, calls, and headphone changes.**                                                         | A real native audio layer, not a JS player. [audio-speech.md](audio-speech.md)                                                                                      |
| 8   | **The catalog changes far more often than the app.**                                                                        | Content ships independently of releases. [ADR-0009](adr/0009-content-pipeline-and-packs.md)                                                                         |
| 9   | **AI is a garnish, never a dependency.**                                                                                    | Every AI path is cached, rate-limited, and has a bundled fallback. [ADR-0010](adr/0010-llm-roleplay-and-guardrails.md)                                              |

---

## C4 · Level 1 — Context

```mermaid
graph TB
  L["👤 Learner<br/>iOS or Android"]
  CL["✍️ Content lead<br/>authors the catalog"]

  LORO["<b>Loro</b><br/>phrase-based Spanish learning"]

  ASR["Platform speech recognition<br/>SFSpeechRecognizer · Android SR"]
  TTSP["Platform TTS<br/>fallback only"]
  NTTS["Neural TTS provider<br/>catalog audio + voice conversion"]
  LLM["Claude<br/>roleplay · coach notes · enrichment"]
  OCR["OCR<br/>on-device text recognition"]
  STORE["App Store · Play Store<br/>billing"]
  OBS["Crash + analytics"]

  L --> LORO
  CL --> LORO
  LORO --> ASR
  LORO --> TTSP
  LORO --> OCR
  LORO --> NTTS
  LORO --> LLM
  LORO --> STORE
  LORO --> OBS
```

Note what is **not** an external dependency of the learner's daily loop: the LLM, the neural TTS
provider, and the network itself. A learner can practise for weeks with none of them.

## C4 · Level 2 — Containers

```mermaid
graph TB
  subgraph device["📱 Device"]
    direction TB
    UI["<b>UI layer</b><br/>React Native · Expo Router<br/>Reanimated · Skia"]
    ENG["<b>Practice engines</b><br/>Stream · Refrain · SRS<br/>Prosody · Pron · Roleplay · Run"]
    DOM["<b>Domain services</b><br/>phrases · trips · progress<br/>content · settings"]
    CORE["<b>loro-core (Rust)</b><br/>FSRS · pitch/F0 · alignment<br/>GOP scoring · ladder · rank"]
    AUD["<b>Audio module</b> (Swift/Kotlin)<br/>AVAudioEngine · Oboe<br/>capture · playback · rate"]
    SPCH["<b>Speech module</b> (Swift/Kotlin)<br/>on-device ASR · TTS"]
    DB[("<b>SQLite</b><br/>phrases · state · schedules<br/>outbox · analytics queue")]
    FS[("<b>File cache</b><br/>audio clips")]
    WIDG["<b>Widgets</b><br/>WidgetKit · Glance"]
  end

  subgraph cloud["☁️ Cloud"]
    direction TB
    API["<b>api</b> (NestJS)<br/>auth · sync · content<br/>ai · tts · billing hooks"]
    PG[("<b>Postgres</b>")]
    RD[("<b>Redis</b><br/>cache · rate limits · jobs")]
    S3[("<b>Object storage</b><br/>audio · packs")]
    CDN["<b>CDN</b>"]
    WRK["<b>Workers</b><br/>content build · TTS render<br/>enrichment · analytics ETL"]
  end

  UI --> ENG --> DOM --> DB
  ENG --> CORE
  DOM --> CORE
  UI --> AUD
  ENG --> AUD
  ENG --> SPCH
  AUD --> FS
  DOM --> WIDG

  DB <-->|"delta sync<br/>HLC · per-field LWW"| API
  DOM -->|"catalog diff"| API
  FS <--|"prefetch"| CDN
  API --> PG
  API --> RD
  API --> S3 --> CDN
  WRK --> PG
  WRK --> S3
```

### Container responsibilities

| Container            | Owns                                                                          | Never does                                         |
| -------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------- |
| **UI layer**         | Rendering, navigation, gestures, animation                                    | Business rules, scheduling maths, direct DB access |
| **Practice engines** | Selecting, sequencing, and evaluating practice; writing progress              | Rendering; deciding _which_ engine is active       |
| **Domain services**  | The phrase graph, trips, settings, content sync, the outbox                   | Presentation; scoring maths                        |
| **loro-core (Rust)** | Every number that must be reproducible — intervals, scores, ranks, rungs      | I/O, networking, persistence                       |
| **Audio module**     | The audio graph, capture, playback, rate, routing, interruptions, lock screen | Any learning logic                                 |
| **Speech module**    | ASR sessions and device TTS                                                   | Matching or scoring (that's `loro-core`)           |
| **SQLite**           | The source of truth for learner data                                          | Content authoring                                  |
| **api**              | Sync arbitration, content distribution, AI/TTS proxying, billing verification | Being required for a practice session              |
| **Workers**          | Content builds, TTS rendering, enrichment, analytics ETL                      | Serving learner requests                           |

---

## The ten rules

Non-negotiable invariants. A PR that breaks one needs an ADR, not a review comment.

1. **The device is the source of truth for learner data.** The server arbitrates sync; it does not
   own state. Every write succeeds locally first.
2. **Every practice surface works with no network.** If a feature can't degrade gracefully offline,
   it isn't in the daily loop.
3. **Recorded audio never leaves the device** except on an explicit, per-use opt-in (voice
   conversion). No exceptions, no "anonymous quality sampling".
4. **Every number shown to a learner is real.** Latency is measured. Scores come from real signal
   processing. No simulated values, ever — not even as a placeholder behind a flag.
5. **Every engine maintains every progress signal**, including the ones it doesn't display. FSRS
   state, `rung`, and `automaticity` are always current, whichever loop is active.
6. **Nothing enters a learner's stream without an explicit tap.** Not a suggestion, not an import,
   not an AI generation.
7. **All reproducible maths lives in `loro-core`.** If two platforms could disagree about a number,
   the number is computed in Rust.
8. **Content ships independently of the app.** A phrase fix needs no release.
9. **AI has a bundled fallback on every learner-visible path.** Losing the LLM degrades roleplay to
   a curated scene set; it never breaks a screen.
10. **No screen shames a missed day.** This is an architectural rule because it constrains the
    notification scheduler, the widget content, and the streak model — not just copy.

---

## Request paths

### A practice session (the common case — no network involved)

```
tap Start wave
  → RefrainEngine.start(setId)
      → SQLite: today's set + per-phrase state
      → loro-core: mode for rep index, automaticity
  → AudioModule.play(clip, rate)          [local cache]
  → SpeechModule.listen()                  [on-device ASR]
  → loro-core: match(transcript, target) → revealed words, latency
  → SQLite: reps++, automaticity, latency sample   [single tx]
  → outbox row appended
  → UI updates from the DB (single source)
Later, on connectivity:
  → SyncService flushes the outbox
```

Zero network calls on the hot path. The outbox is drained opportunistically.

### A roleplay scene (the only AI path in a session)

```
tap Roleplay
  → cache lookup: scene for (theme, level, tag-profile, content_version)
      hit  → play immediately
      miss → api POST /ai/scene  (streamed)
               → Redis check → Claude → validate → persist → stream
      offline or error or over budget → bundled fallback scene
```

### Content update

```
launch (or every 24 h)
  → GET /content/manifest
  → local catalog_version < remote?
      → GET /content/diff?from=N        [phrase deltas only]
      → apply in one tx, bump version
      → enqueue audio prefetch for newly relevant packs
```

---

## Cross-cutting concerns

| Concern              | Approach                                                                                                              | Detail                                                        |
| -------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| **State management** | Zustand slices for ephemeral UI state; the DB (via live queries) for everything durable. No duplicated truth.         | [mobile-app.md](mobile-app.md#state)                          |
| **Navigation**       | Expo Router, file-based, typed routes. Deep links for widgets and notifications.                                      | [mobile-app.md](mobile-app.md#navigation)                     |
| **Error handling**   | Errors are values in the domain layer; boundaries at the screen level; a session never dies from a recoverable error. | [mobile-app.md](mobile-app.md#errors)                         |
| **Feature flags**    | Local defaults, remote overrides, per-engine gating. Flags resolve offline.                                           | [`process/experimentation.md`](../process/experimentation.md) |
| **Migrations**       | Forward-only, numbered, tested against a fixture DB from every prior version.                                         | [data-model.md](data-model.md#migrations)                     |
| **Time**             | HLC for sync ordering; device local date for day boundaries and trip transitions (so they work offline).              | [sync-protocol.md](sync-protocol.md#time)                     |
| **i18n**             | UI strings in ICU message format from day one, even while English-only.                                               | [`process/localization.md`](../process/localization.md)       |
| **Observability**    | Structured logs, OTel traces on the API, client crash + event pipeline, learning-quality telemetry.                   | [observability.md](observability.md)                          |
| **Security**         | Short-lived access tokens, rotating refresh, device-keychain storage, no PII in analytics.                            | [security-privacy.md](security-privacy.md)                    |

---

## Technology summary

Versions are the pins chosen at authoring time — **re-verify at kickoff**
([`process/onboarding.md`](../process/onboarding.md)).

### Mobile

| Concern         | Choice                                                     | Why                                                                          |
| --------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Framework       | React Native 0.81 + Expo SDK 54, New Architecture          | One codebase for 21 screens; Expo Modules for native work                    |
| Language        | TypeScript 5.6, `strict`                                   |                                                                              |
| Navigation      | Expo Router                                                | Typed, file-based, deep-link native                                          |
| Animation       | Reanimated 4 + Gesture Handler                             | The warming card, sheets, and press feedback run at 60 fps off the JS thread |
| Custom graphics | React Native Skia                                          | Pitch contours, waveforms, forgetting curve, ladder histogram                |
| State           | Zustand + live SQLite queries                              | Small, no boilerplate, no cache-invalidation layer                           |
| Local DB        | SQLite (`op-sqlite`) + Drizzle ORM                         | Synchronous JSI access; typed schema and migrations                          |
| Native audio    | Custom Expo Module — AVAudioEngine (iOS) / Oboe (Android)  | Rate control, capture, interruption handling, lock screen                    |
| Speech          | Custom Expo Module — SFSpeechRecognizer / SpeechRecognizer | On-device Spanish ASR                                                        |
| Shared maths    | `loro-core` (Rust) via UniFFI                              | Identical numbers on both platforms                                          |
| Widgets         | WidgetKit + ActivityKit (iOS), Glance (Android)            | Native only; no cross-platform option exists                                 |
| Testing         | Vitest, React Native Testing Library, Maestro              | [`process/testing-strategy.md`](../process/testing-strategy.md)              |

### Backend

| Concern        | Choice                                              | Why                                                     |
| -------------- | --------------------------------------------------- | ------------------------------------------------------- |
| Runtime        | Node 22 LTS                                         |                                                         |
| Framework      | NestJS 11                                           | Module boundaries that survive growth; team familiarity |
| DB             | Postgres 16 + Drizzle                               | Same ORM as the client → shared schema types            |
| Cache / queues | Redis 7 + BullMQ                                    | AI cache, rate limits, worker jobs                      |
| Storage / CDN  | S3-compatible + CDN                                 | Content-addressed audio                                 |
| AI             | Anthropic Claude                                    | Roleplay, coach notes, content enrichment               |
| TTS            | Managed neural TTS                                  | Catalog audio at build time; voice conversion in v2     |
| Auth           | Apple / Google / email magic link; own JWT issuance | Anonymous-first upgrade path                            |
| Deploy         | Containers, IaC, blue-green                         | [backend.md](backend.md#deployment)                     |

### Shared

| Package                  | Contents                                                                   |
| ------------------------ | -------------------------------------------------------------------------- |
| `packages/core`          | Domain types, engine contracts, validation schemas — shared by app and API |
| `packages/core-rs`       | The Rust core                                                              |
| `packages/design-tokens` | Tokens extracted from the blueprint, plus generators                       |
| `packages/content`       | Catalog schema and data                                                    |

---

## What we deliberately did not do

| Rejected                          | Why                                                                                                                                                                                                                       |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Flutter**                       | Better for custom graphics, but it isolates the codebase from the team's TS/Node work and from `packages/core` sharing with the API. [ADR-0001](adr/0001-cross-platform-react-native-expo.md)                             |
| **Fully native iOS + Android**    | Best audio access and feel, roughly double the UI cost for 21 dense screens. Rejected on team size.                                                                                                                       |
| **Server-side scoring**           | Simpler to build, but breaks force #1 (offline) and force #3 (the privacy promise). Non-starter.                                                                                                                          |
| **Supabase / Firebase**           | Faster to stand up; the sync semantics we need (per-field LWW over a phrase graph with an outbox) aren't a good fit, and the content pipeline would end up custom anyway. [ADR-0008](adr/0008-backend-nestjs-postgres.md) |
| **CRDTs for sync**                | Correct and elegant, but our conflict domain is small scalar fields on one owner's rows. Per-field LWW with HLC is far less machinery for the same result. [ADR-0003](adr/0003-offline-first-sqlite-sync.md)              |
| **A single "best" practice loop** | The blueprint left it open on purpose, and we don't have the data. [ADR-0006](adr/0006-pluggable-practice-engines.md)                                                                                                     |
| **GraphQL**                       | The client mostly syncs and fetches content diffs. REST plus a delta endpoint is a better fit and cheaper to cache.                                                                                                       |
| **Cloud ASR as primary**          | Latency, cost, and it would make the core loop network-dependent.                                                                                                                                                         |

---

## Architecture decision records

| #                                                    | Decision                                    | Status   |
| ---------------------------------------------------- | ------------------------------------------- | -------- |
| [0001](adr/0001-cross-platform-react-native-expo.md) | React Native + Expo                         | Accepted |
| [0002](adr/0002-shared-rust-core.md)                 | A shared Rust core via UniFFI               | Accepted |
| [0003](adr/0003-offline-first-sqlite-sync.md)        | Offline-first SQLite with delta sync        | Accepted |
| [0004](adr/0004-fsrs-scheduler.md)                   | FSRS as the scheduling algorithm            | Accepted |
| [0005](adr/0005-on-device-asr-cloud-fallback.md)     | On-device ASR with an opt-in cloud fallback | Accepted |
| [0006](adr/0006-pluggable-practice-engines.md)       | Pluggable practice engines                  | Accepted |
| [0007](adr/0007-audio-pipeline.md)                   | A native audio module, not a JS player      | Accepted |
| [0008](adr/0008-backend-nestjs-postgres.md)          | NestJS + Postgres over a BaaS               | Accepted |
| [0009](adr/0009-content-pipeline-and-packs.md)       | Content ships independently of the app      | Accepted |
| [0010](adr/0010-llm-roleplay-and-guardrails.md)      | LLM roleplay with hard guardrails           | Accepted |
| [0011](adr/0011-analytics-and-privacy.md)            | Privacy posture and the audio promise       | Accepted |
| [0012](adr/0012-state-management.md)                 | Zustand + live SQLite queries               | Accepted |
| [0013](adr/0013-design-tokens-pipeline.md)           | Design tokens as generated code             | Accepted |
| [0014](adr/0014-monorepo-tooling.md)                 | pnpm workspaces + Turborepo                 | Accepted |
